/**
 * Enhanced metrics utility with support for new API and storage
 * This extends the existing metrics-util.ts to support the new async API
 */

import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { H3Event, EventHandlerRequest } from 'h3';
import { Options } from '@/model/Options';
import { getLocale } from "./getLocale";
import { filterHolidaysFromMetrics } from '@/utils/dateUtils';
import { getMetricsData as getLegacyMetricsData } from './metrics-util';
import { getMetricsByDateRange } from '../../server/storage/metrics-storage';
import { fetchMetricsForDate, type MetricsReportRequest } from '../../server/services/github-copilot-usage-api';

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
 * Check if new API should be used
 */
function shouldUseNewApi(): boolean {
  const config = useRuntimeConfig();
  return config.public?.useNewApi === true ||
         config.public?.useNewApi === 'true' ||
         process.env.USE_NEW_API === 'true';
}

/**
 * Calculate the number of days between two dates
 */
function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Include both start and end dates
}

/**
 * Enhanced version of getMetricsData that supports both legacy and new API
 * 
 * Decision tree:
 * 1. If mocked data requested → use mock files (existing behavior)
 * 2. If storage mode enabled and date range > 7 days → try storage first
 * 3. If new API enabled → use new async download API
 * 4. Otherwise → fall back to legacy API (existing behavior)
 */
export async function getMetricsDataV2(event: H3Event<EventHandlerRequest>): Promise<CopilotMetrics[]> {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // Extract locale from headers if not provided in query
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
    
    // For larger date ranges, prefer storage
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
          
          // Filter holidays if requested
          const filtered = filterHolidaysFromMetrics(
            storedMetrics,
            options.excludeHolidays || false,
            options.locale
          );
          
          return filtered;
        } else {
          logger.info('No data in storage, falling back to API');
        }
      } catch (error) {
        logger.error('Storage query failed, falling back to API:', error);
        // Fall through to API fetch
      }
    }
  }

  // 3. Use new API if enabled
  if (shouldUseNewApi()) {
    logger.info('Using new Copilot Usage Metrics API');
    
    try {
      const results: CopilotMetrics[] = [];
      
      // If date range specified, fetch each day
      if (options.since && options.until) {
        const start = new Date(options.since);
        const end = new Date(options.until);
        
        const current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          
          const request: MetricsReportRequest = {
            scope: options.scope!,
            identifier,
            date: dateStr,
            teamSlug: options.githubTeam
          };
          
          const dayMetrics = await fetchMetricsForDate(request, event.context.headers);
          results.push(...(dayMetrics as CopilotMetrics[]));
          
          current.setDate(current.getDate() + 1);
        }
      } else {
        // Single day (today or until date)
        const date = options.until || new Date().toISOString().split('T')[0];
        
        const request: MetricsReportRequest = {
          scope: options.scope!,
          identifier,
          date,
          teamSlug: options.githubTeam
        };
        
        const dayMetrics = await fetchMetricsForDate(request, event.context.headers);
        results.push(...(dayMetrics as CopilotMetrics[]));
      }

      // Filter holidays if requested
      const filtered = filterHolidaysFromMetrics(
        results,
        options.excludeHolidays || false,
        options.locale
      );

      return filtered;
      
    } catch (error) {
      logger.error('New API failed, falling back to legacy:', error);
      // Fall through to legacy API
    }
  }

  // 4. Fall back to legacy API (existing implementation)
  logger.info('Using legacy Copilot Metrics API');
  return await getLegacyMetricsData(event);
}
