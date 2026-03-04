/**
 * Enhanced metrics utility with support for new Copilot Usage Metrics API
 * 
 * Controlled by COPILOT_METRICS_API env var:
 *   "new"    (default) — uses the download-based reports API
 *   "legacy" — uses the deprecated /copilot/metrics REST API (shuts down April 2, 2026)
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
import { transformReportToMetrics } from '../../server/services/report-transformer';
import { isMockMode } from '../../server/services/github-copilot-usage-api-mock';

type ApiMode = 'new' | 'legacy';

export interface MetricsDataResult {
  metrics: CopilotMetrics[];
  reportData: ReportDayTotals[];
}

/**
 * Get the configured API mode
 */
function getApiMode(): ApiMode {
  const mode = process.env.COPILOT_METRICS_API?.toLowerCase();
  if (mode === 'legacy') return 'legacy';
  return 'new';
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
    const apiMode = getApiMode();
    if (apiMode === 'new') {
      // Exercise the full mock pipeline: requestDownloadLinks → downloadReport (HTTP) → transform
      // Mock download links point to localhost static files in public/mock-data/new-api/
      logger.info('Using mocked data mode (new API format via HTTP download)');
      const identifier = options.githubOrg || options.githubEnt || 'mock-org';
      const scope = (options.scope || 'organization') as MetricsReportRequest['scope'];
      const report = await fetchLatestReport({ scope, identifier }, new Headers());
      const metrics = transformReportToMetrics(report);
      return { metrics, reportData: report.day_totals };
    }
    // Legacy mock mode — use old JSON files
    logger.info('Using mocked data mode (legacy format)');
    const metrics = await getLegacyMetricsData(event);
    return { metrics, reportData: [] };
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
        return { metrics: filteredMetrics, reportData };
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
      return { metrics: filteredMetrics, reportData: result.reportData };
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

  const apiMode = getApiMode();
  logger.info(`Using ${apiMode} Copilot Metrics API (direct, no DB)`);

  if (apiMode === 'legacy') {
    const metrics = await getLegacyMetricsData(event);
    return { metrics: filterHolidaysFromMetrics(metrics, options.excludeHolidays || false, options.locale), reportData: [] };
  }

  const result = await fetchFromNewApi(options, event.context.headers);
  return {
    metrics: filterHolidaysFromMetrics(result.metrics, options.excludeHolidays || false, options.locale),
    reportData: result.reportData
  };
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

  return { metrics, reportData };
}
