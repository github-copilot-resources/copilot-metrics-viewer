/**
 * Enhanced metrics utility with support for new Copilot Usage Metrics API
 * 
 * The new API (download-based reports) is the PRIMARY source.
 * Falls back to legacy /copilot/metrics API on failure.
 * Legacy API shuts down April 2, 2026.
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
 * Check if legacy API should be forced (skip new API)
 */
function shouldForceLegacyApi(): boolean {
  return process.env.FORCE_LEGACY_API === 'true';
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
 * Enhanced version of getMetricsData that uses the new download-based API by default.
 * 
 * Decision tree:
 * 1. If mocked data requested → use mock files (existing behavior)
 * 2. If storage mode enabled and date range > 7 days → try storage first
 * 3. Try new download-based API (28-day report) → transform to CopilotMetrics
 * 4. On failure → fall back to legacy API
 */
export async function getMetricsDataV2(event: H3Event<EventHandlerRequest>): Promise<CopilotMetrics[]> {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  if (!options.locale) {
    options.locale = getLocale(event);
  }

  // 1. Handle mocked data (existing behavior)
  if (options.isDataMocked) {
    logger.info('Using mocked data mode');
    return await getLegacyMetricsData(event);
  }

  // Check authorization early
  const authHeader = event.context.headers.get('Authorization');
  if (!authHeader && !options.isDataMocked) {
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
          logger.info('No data in storage, falling back to API');
        }
      } catch (error) {
        logger.error('Storage query failed, falling back to API:', error);
      }
    }
  }

  // 3. Try new download-based API (unless legacy is forced)
  if (!shouldForceLegacyApi()) {
    try {
      logger.info('Using new Copilot Usage Metrics API (download-based)');

      const request: MetricsReportRequest = {
        scope: options.scope!,
        identifier,
        teamSlug: options.githubTeam
      };

      const report = await fetchLatestReport(request, event.context.headers);
      let metrics = transformReportToMetrics(report);

      // Filter by date range if specified
      if (options.since || options.until) {
        metrics = metrics.filter(m => {
          if (options.since && m.date < options.since) return false;
          if (options.until && m.date > options.until) return false;
          return true;
        });
      }

      // Filter holidays if requested
      const filtered = filterHolidaysFromMetrics(
        metrics,
        options.excludeHolidays || false,
        options.locale
      );

      logger.info(`New API: Got ${filtered.length} days of metrics`);
      return filtered;

    } catch (error) {
      logger.warn('New API failed, falling back to legacy:', error instanceof Error ? error.message : error);
    }
  }

  // 4. Fall back to legacy API
  logger.info('Using legacy Copilot Metrics API (deprecated April 2, 2026)');
  return await getLegacyMetricsData(event);
}
