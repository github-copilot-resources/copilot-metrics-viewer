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
import { Options } from '@/model/Options';
import { getLocale } from "./getLocale";
import { filterHolidaysFromMetrics } from '@/utils/dateUtils';
import { getMetricsData as getLegacyMetricsData } from './metrics-util';
import { getMetricsByDateRange, getReportDataByDateRange, saveMetrics } from '../../server/storage/metrics-storage';
import { fetchLatestReport, type MetricsReportRequest } from '../../server/services/github-copilot-usage-api';
import {
  sortCopilotMetricsByDate,
  sortReportDayTotalsByDay,
  transformReportToMetrics,
} from '../../server/services/report-transformer';
import { isMockMode } from '../../server/services/github-copilot-usage-api-mock';

export interface MetricsDataResult {
  metrics: CopilotMetrics[];
  reportData: ReportDayTotals[];
}

function sortMetricsDataResult(result: MetricsDataResult): MetricsDataResult {
  return {
    metrics: sortCopilotMetricsByDate(result.metrics),
    reportData: sortReportDayTotalsByDay(result.reportData),
  };
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
 * Fetch metrics using the new download-based API
 */
async function fetchFromNewApi(
  options: Options,
  headers: Headers
): Promise<MetricsDataResult> {
  const identifier = options.githubOrg || options.githubEnt || '';

  const request: MetricsReportRequest = {
    scope: options.scope!,
    identifier,
    teamSlug: options.githubTeam
  };

  const report = await fetchLatestReport(request, headers);
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

  return sortMetricsDataResult({ metrics, reportData });
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
      return sortMetricsDataResult({ metrics, reportData: [] });
    }
    // Default: exercise full new-API mock pipeline
    logger.info('Using mocked data mode (new API format via HTTP download)');
    const identifier = options.githubOrg || options.githubEnt || 'mock-org';
    const scope = (options.scope || 'organization') as MetricsReportRequest['scope'];
    const report = await fetchLatestReport({ scope, identifier }, new Headers());
    const metrics = transformReportToMetrics(report);
    return sortMetricsDataResult({ metrics, reportData: report.day_totals });
  }

  const identifier = options.githubOrg || options.githubEnt || '';

  // 2. Historical mode — DB is the source of truth, sync on miss
  if (isStorageModeEnabled()) {
    // Default to last 28 days if no date range specified
    const endDate = options.until || new Date().toISOString().split('T')[0];
    const startDate = options.since || new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    logger.info(`Historical mode: checking DB for ${identifier} (${startDate} to ${endDate})`);

    try {
      const storedMetrics = await getMetricsByDateRange({
        scope: options.scope!,
        scopeIdentifier: identifier,
        teamSlug: options.githubTeam,
        startDate,
        endDate
      });

      if (storedMetrics.length > 0) {
        logger.info(`Retrieved ${storedMetrics.length} days from DB`);
        // Also get report data from DB
        const reportData = await getReportDataByDateRange(
          options.scope!, identifier, startDate, endDate, options.githubTeam
        );
        const filteredMetrics = filterHolidaysFromMetrics(
          storedMetrics,
          options.excludeHolidays || false,
          options.locale
        );
        return sortMetricsDataResult({ metrics: filteredMetrics, reportData });
      }

      // DB empty — sync on miss: fetch from API, store, return
      logger.info('No data in DB, syncing from API...');
      const authHeader = event.context.headers.get('Authorization');
      if (!authHeader) {
        throw createError({
          statusCode: 401,
          statusMessage: 'No data in DB and no token to sync from API'
        });
      }

      const result = await fetchAndStore(options, event.context.headers);
      const filteredMetrics = filterHolidaysFromMetrics(
        result.metrics,
        options.excludeHolidays || false,
        options.locale
      );
      return sortMetricsDataResult({ metrics: filteredMetrics, reportData: result.reportData });
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
    return sortMetricsDataResult({
      metrics: filterHolidaysFromMetrics(metrics, options.excludeHolidays || false, options.locale),
      reportData: []
    });
  }

  logger.info('Using new Copilot Metrics API (direct, no DB)');
  const result = await fetchFromNewApi(options, event.context.headers);
  return sortMetricsDataResult({
    metrics: filterHolidaysFromMetrics(result.metrics, options.excludeHolidays || false, options.locale),
    reportData: result.reportData
  });
}

/**
 * Fetch from API and store to DB (sync-on-miss).
 * Used when historical mode is enabled but DB is empty for the requested range.
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
    teamSlug: options.githubTeam
  };

  const report = await fetchLatestReport(request, headers);
  let metrics = transformReportToMetrics(report);
  let reportData = report.day_totals;

  // Store each day to DB
  for (let i = 0; i < report.day_totals.length; i++) {
    const dayData = report.day_totals[i];
    try {
      await saveMetrics(
        options.scope!,
        identifier,
        dayData.day,
        metrics[i],
        options.githubTeam,
        dayData
      );
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

  return sortMetricsDataResult({ metrics, reportData });
}
