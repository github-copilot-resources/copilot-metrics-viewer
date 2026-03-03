/**
 * Enhanced metrics utility with support for new Copilot Usage Metrics API
 * 
 * Controlled by COPILOT_METRICS_API env var:
 *   "new"    (default) — uses the download-based reports API
 *   "legacy" — uses the deprecated /copilot/metrics REST API (shuts down April 2, 2026)
 */

import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { H3Event, EventHandlerRequest } from 'h3';
import { Options } from '@/model/Options';
import { getLocale } from "./getLocale";
import { filterHolidaysFromMetrics } from '@/utils/dateUtils';
import { getMetricsData as getLegacyMetricsData } from './metrics-util';
import { getMetricsByDateRange } from '../../server/storage/metrics-storage';
import { fetchLatestReport, type MetricsReportRequest } from '../../server/services/github-copilot-usage-api';
import { transformReportToMetrics } from '../../server/services/report-transformer';

type ApiMode = 'new' | 'legacy';

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
 * Calculate the number of days between two dates
 */
function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

/**
 * Fetch metrics using the new download-based API
 */
async function fetchFromNewApi(
  options: Options,
  headers: Headers
): Promise<CopilotMetrics[]> {
  const identifier = options.githubOrg || options.githubEnt || '';

  const request: MetricsReportRequest = {
    scope: options.scope!,
    identifier,
    teamSlug: options.githubTeam
  };

  const report = await fetchLatestReport(request, headers);
  let metrics = transformReportToMetrics(report);

  // Filter by date range if specified
  if (options.since || options.until) {
    metrics = metrics.filter(m => {
      if (options.since && m.date < options.since) return false;
      if (options.until && m.date > options.until) return false;
      return true;
    });
  }

  return metrics;
}

/**
 * Get metrics data using the configured API mode.
 * 
 * Decision tree:
 * 1. Mocked data → use mock files
 * 2. Storage mode enabled → try storage first
 * 3. COPILOT_METRICS_API=legacy → use deprecated REST API
 * 4. COPILOT_METRICS_API=new (default) → use download-based API
 */
export async function getMetricsDataV2(event: H3Event<EventHandlerRequest>): Promise<CopilotMetrics[]> {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  if (!options.locale) {
    options.locale = getLocale(event);
  }

  // 1. Handle mocked data
  if (options.isDataMocked) {
    logger.info('Using mocked data mode');
    return await getLegacyMetricsData(event);
  }

  // Check authorization early
  const authHeader = event.context.headers.get('Authorization');
  if (!authHeader) {
    logger.error('No Authentication provided');
    throw createError({
      statusCode: 401,
      statusMessage: 'No Authentication provided'
    });
  }

  const identifier = options.githubOrg || options.githubEnt || '';

  // 2. Try storage for date ranges if storage mode is enabled
  if (isStorageModeEnabled() && options.since && options.until) {
    const days = getDaysBetween(options.since, options.until);
    
    if (days > 7) {
      logger.info(`Storage mode: Querying storage for ${days} days`);
      
      try {
        const storedMetrics = await getMetricsByDateRange({
          scope: options.scope!,
          scopeIdentifier: identifier,
          teamSlug: options.githubTeam,
          startDate: options.since,
          endDate: options.until
        });

        if (storedMetrics.length > 0) {
          logger.info(`Retrieved ${storedMetrics.length} days from storage`);
          return filterHolidaysFromMetrics(
            storedMetrics,
            options.excludeHolidays || false,
            options.locale
          );
        } else {
          logger.info('No data in storage, continuing to API');
        }
      } catch (error) {
        logger.error('Storage query failed, continuing to API:', error);
      }
    }
  }

  // 3. Use the configured API mode
  const apiMode = getApiMode();
  logger.info(`Using ${apiMode} Copilot Metrics API`);

  let metrics: CopilotMetrics[];

  if (apiMode === 'legacy') {
    metrics = await getLegacyMetricsData(event);
  } else {
    metrics = await fetchFromNewApi(options, event.context.headers);
  }

  // Filter holidays if requested
  const filtered = filterHolidaysFromMetrics(
    metrics,
    options.excludeHolidays || false,
    options.locale
  );

  logger.info(`Got ${filtered.length} days of metrics via ${apiMode} API`);
  return filtered;
}
