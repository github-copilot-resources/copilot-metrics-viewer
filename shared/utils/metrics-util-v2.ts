/**
 * Enhanced metrics utility — uses the new Copilot Usage Metrics API by default.
 *
 * The new download-based reports API is the default and ONLY path unless
 * USE_LEGACY_API=true is explicitly set. This ensures the new implementation
 * is fully exercised and no silent fallback to legacy code occurs.
 *
 * Legacy API shuts down April 2, 2026. Set USE_LEGACY_API=true only if you
 * have a specific reason to use the deprecated /copilot/metrics REST endpoint.
 */

import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { H3Event, EventHandlerRequest } from 'h3';
import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';
import type { OrgReport } from '../../server/services/github-copilot-usage-api';
import { Options } from '@/model/Options';
import { getLocale } from "./getLocale";
import { filterHolidaysFromMetrics } from '@/utils/dateUtils';
import { getMetricsData as getLegacyMetricsData } from './metrics-util';
import { getMetricsByDateRange, getReportDataByDateRange, saveMetrics } from '../../server/storage/metrics-storage';
import { saveUserMetricsBatch, getUserMetricsByDateRange } from '../../server/storage/user-metrics-storage';
import { fetchLatestReport, fetchUsersLatestReport, type MetricsReportRequest } from '../../server/services/github-copilot-usage-api';
import { transformReportToMetrics } from '../../server/services/report-transformer';
import { isMockMode } from '../../server/services/github-copilot-usage-api-mock';
import { aggregateTeamMetrics } from '../../server/services/user-metrics-aggregator';
import { fetchAllTeamMembers } from '../../server/api/seats';

export interface MetricsDataResult {
  metrics: CopilotMetrics[];
  reportData: ReportDayTotals[];
}

/**
 * Returns true ONLY when USE_LEGACY_API is explicitly set to "true".
 * Default behavior is new API — no legacy calls unless opted in.
 */
function isLegacyMode(): boolean {
  return process.env.USE_LEGACY_API?.toLowerCase() === 'true';
}

/**
 * Check if storage mode is enabled
 */
function isStorageModeEnabled(): boolean {
  const config = useRuntimeConfig();
  return config.public?.enableHistoricalMode === true || 
         config.public?.enableHistoricalMode === 'true' ||
         process.env.ENABLE_HISTORICAL_MODE === 'true';
}

/**
 * Fetch metrics using the new download-based API.
 * For team scopes, fetches per-user data and aggregates it for team members only.
 */
async function fetchFromNewApi(
  options: Options,
  headers: Headers
): Promise<MetricsDataResult> {
  const identifier = options.githubOrg || options.githubEnt || '';
  const isTeamScope = options.scope === 'team-organization' || options.scope === 'team-enterprise';

  const request: MetricsReportRequest = {
    scope: options.scope!,
    identifier,
    teamSlug: options.githubTeam
  };

  let report;
  if (isTeamScope && options.githubTeam) {
    // Fetch team members first; only fetch user report if the team has members.
    // This avoids an expensive download when the team is empty or doesn't exist.
    const teamMembers = await fetchAllTeamMembers(options, headers);
    if (teamMembers.length === 0) {
      return { metrics: [], reportData: [] };
    }
    const userRecords = await fetchUsersLatestReport(request, headers);
    const teamLogins = new Set(teamMembers.map(m => m.login));
    report = aggregateTeamMetrics(userRecords, teamLogins);
  } else {
    report = await fetchLatestReport(request, headers);
  }

  let metrics = transformReportToMetrics(report);
  let reportData = report.day_totals;

  // Filter by date range if specified
  if (options.since || options.until) {
    metrics = metrics.filter(m => {
      if (options.since && m.date < options.since) return false;
      if (options.until && m.date > options.until) return false;
      return true;
    });
    reportData = reportData.filter(d => {
      if (options.since && d.day < options.since) return false;
      if (options.until && d.day > options.until) return false;
      return true;
    });
  }

  return { metrics, reportData };
}

/**
 * Get metrics data using the configured API mode.
 * 
 * Decision tree:
 * 1. Mock mode (IS_DATA_MOCKED=true) → return mock files, no DB, no API
 * 2. Historical mode (ENABLE_HISTORICAL_MODE=true) → read from DB, sync-on-miss from API
 * 3. Direct API mode → fetch from GitHub API (no DB)
 *
 * Mock mode never touches DB or real API.
 * Historical mode always uses DB, syncing missing data automatically.
 */
export async function getMetricsDataV2(event: H3Event<EventHandlerRequest>): Promise<MetricsDataResult> {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  if (!options.locale) {
    options.locale = getLocale(event);
  }

  // 1. Mock mode — return immediately, no DB, no API
  //    Controlled by NUXT_PUBLIC_IS_DATA_MOCKED env var, not per-request params
  if (isMockMode()) {
    if (isLegacyMode()) {
      logger.info('Using mocked data mode (legacy format — USE_LEGACY_API=true)');
      const metrics = await getLegacyMetricsData(event);
      return { metrics, reportData: [] };
    }
    // Default: exercise full new-API mock pipeline (including team aggregation)
    logger.info('Using mocked data mode (new API format via HTTP download)');
    const result = await fetchFromNewApi(options, new Headers());
    return { metrics: result.metrics, reportData: result.reportData };
  }

  const identifier = options.githubOrg || options.githubEnt || '';

  // 2. Historical mode — DB is the source of truth, sync on miss
  if (isStorageModeEnabled()) {
    // Default to last 28 days if no date range specified
    const endDate = options.until || new Date().toISOString().split('T')[0];
    const startDate = options.since || new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    logger.info(`Historical mode: checking DB for ${identifier} (${startDate} to ${endDate})`);

    const isTeamScope = options.scope === 'team-organization' || options.scope === 'team-enterprise';

    try {
      if (isTeamScope && options.githubTeam) {
        // Team path:
        //   1. Resolve team members server-side (always — ensures current membership)
        //   2. Read per-user records from user_metrics DB
        //   3. Aggregate in-memory for the team
        //   4. Fall back to live API only when DB has no data yet
        const teamMembers = await fetchAllTeamMembers(options, event.context.headers);
        if (teamMembers.length === 0) {
          return { metrics: [], reportData: [] };
        }
        const teamLogins = new Set(teamMembers.map(m => m.login));

        const request: MetricsReportRequest = { scope: options.scope!, identifier, teamSlug: options.githubTeam };

        const userRecords = await getUserMetricsByDateRange(options.scope!, identifier, startDate, endDate);
        if (userRecords.length > 0) {
          logger.info(`Aggregating team metrics from ${userRecords.length} per-user DB records`);
          const report = aggregateTeamMetrics(userRecords, teamLogins);
          return buildFilteredResult(report, options);
        }

        // No per-user data in DB — fetch from API, persist all user records, then aggregate
        const authHeader = event.context.headers.get('Authorization');
        if (!authHeader) {
          throw createError({ statusCode: 401, statusMessage: 'No data in DB and no token to sync from API' });
        }
        logger.info('No per-user data in DB, fetching from API...');
        const liveUserRecords = await fetchUsersLatestReport(request, event.context.headers);
        try {
          await saveUserMetricsBatch(options.scope!, identifier, liveUserRecords);
        } catch (err) {
          logger.error('Failed to store per-user records:', err);
        }
        const report = aggregateTeamMetrics(liveUserRecords, teamLogins);
        return buildFilteredResult(report, options);

      } else {
        // Org/Enterprise path: serve pre-aggregated metrics from DB (fast path)
        const storedMetrics = await getMetricsByDateRange({
          scope: options.scope!,
          scopeIdentifier: identifier,
          teamSlug: '',
          startDate,
          endDate
        });

        if (storedMetrics.length > 0) {
          logger.info(`Retrieved ${storedMetrics.length} days from DB`);
          const reportData = await getReportDataByDateRange(options.scope!, identifier, startDate, endDate);
          const filteredMetrics = filterHolidaysFromMetrics(storedMetrics, options.excludeHolidays || false, options.locale);
          return { metrics: filteredMetrics, reportData };
        }

        // DB empty — sync on miss: fetch org aggregate + per-user records, store, return
        logger.info('No data in DB, syncing from API...');
        const authHeader = event.context.headers.get('Authorization');
        if (!authHeader) {
          throw createError({ statusCode: 401, statusMessage: 'No data in DB and no token to sync from API' });
        }
        const result = await fetchAndStore(options, event.context.headers);
        const filteredMetrics = filterHolidaysFromMetrics(result.metrics, options.excludeHolidays || false, options.locale);
        return { metrics: filteredMetrics, reportData: result.reportData };
      }
    } catch (error) {
      // If it's already an H3 error (like 401), re-throw
      if (error && typeof error === 'object' && 'statusCode' in error) throw error;
      logger.error('Historical mode failed:', error);
      throw createError({
        statusCode: 500,
        statusMessage: `Storage error: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  // 3. Direct API mode (no DB)
  const authHeader = event.context.headers.get('Authorization');
  if (!authHeader) {
    throw createError({
      statusCode: 401,
      statusMessage: 'No Authentication provided'
    });
  }

  if (isLegacyMode()) {
    logger.info('Using legacy Copilot Metrics API (USE_LEGACY_API=true, direct, no DB)');
    const metrics = await getLegacyMetricsData(event);
    return { metrics: filterHolidaysFromMetrics(metrics, options.excludeHolidays || false, options.locale), reportData: [] };
  }

  logger.info('Using new Copilot Metrics API (direct, no DB)');
  const result = await fetchFromNewApi(options, event.context.headers);
  return {
    metrics: filterHolidaysFromMetrics(result.metrics, options.excludeHolidays || false, options.locale),
    reportData: result.reportData
  };
}

/**
 * Build a MetricsDataResult from an OrgReport, applying date-range filtering and
 * holiday exclusion from the options.
 */
function buildFilteredResult(report: OrgReport, options: Options): MetricsDataResult {
  let metrics = transformReportToMetrics(report);
  let reportData = report.day_totals;
  if (options.since || options.until) {
    metrics = metrics.filter(m => {
      if (options.since && m.date < options.since) return false;
      if (options.until && m.date > options.until) return false;
      return true;
    });
    reportData = reportData.filter(d => {
      if (options.since && d.day < options.since) return false;
      if (options.until && d.day > options.until) return false;
      return true;
    });
  }
  const filteredMetrics = filterHolidaysFromMetrics(metrics, options.excludeHolidays || false, options.locale);
  return { metrics: filteredMetrics, reportData };
}

/**
 * Fetch org/enterprise metrics from API and store to DB (sync-on-miss).
 * Also saves per-user records to user_metrics so team queries can be served
 * from DB on subsequent requests.
 *
 * NOTE: This function is only called from the non-team (organization / enterprise)
 * path in getMetricsDataV2. Team-scope queries are fully handled inline in
 * getMetricsDataV2 so that member resolution always precedes data retrieval.
 */
async function fetchAndStore(
  options: Options,
  headers: Headers
): Promise<MetricsDataResult> {
  const logger = console;
  const identifier = options.githubOrg || options.githubEnt || '';

  const request: MetricsReportRequest = {
    scope: options.scope!,
    identifier,
  };

  // Fetch org/enterprise aggregate
  const report = await fetchLatestReport(request, headers);

  // Also save per-user records so team queries can use DB history
  try {
    const userRecords = await fetchUsersLatestReport(request, headers);
    await saveUserMetricsBatch(options.scope!, identifier, userRecords);
    logger.info(`Stored ${userRecords.length} per-user records for ${identifier}`);
  } catch (err) {
    logger.error('Failed to store per-user records (non-fatal):', err);
  }

  let metrics = transformReportToMetrics(report);
  let reportData = report.day_totals;

  // Store each day's aggregate to DB (no team slug — org/enterprise scope only)
  const teamSlug = '';
  for (let i = 0; i < report.day_totals.length; i++) {
    const dayData = report.day_totals[i];
    try {
      await saveMetrics(options.scope!, identifier, dayData.day, metrics[i], teamSlug, dayData);
    } catch (err) {
      logger.error(`Failed to store ${dayData.day}:`, err);
    }
  }

  logger.info(`Synced and stored ${report.day_totals.length} days to DB`);

  // Filter by date range
  if (options.since || options.until) {
    metrics = metrics.filter(m => {
      if (options.since && m.date < options.since) return false;
      if (options.until && m.date > options.until) return false;
      return true;
    });
    reportData = reportData.filter(d => {
      if (options.since && d.day < options.since) return false;
      if (options.until && d.day > options.until) return false;
      return true;
    });
  }

  return { metrics, reportData };
}
