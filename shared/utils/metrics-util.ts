import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { H3Event, EventHandlerRequest } from 'h3';
import { Options } from '@/model/Options';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getLocale } from "./getLocale";
import { filterHolidaysFromMetrics, isHoliday, parseUtcDate } from '@/utils/dateUtils';
import { createHash } from 'crypto';

const cache = new Map<string, CacheData>();

interface CacheData {
  data: CopilotMetrics[];
  valid_until: number;
}

class MetricsError extends Error {

  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "MetricsError";
    this.statusCode = statusCode
  }
}

/**
 * Builds a cache key for metrics data that is bound to the caller's Authorization header (hashed) + path + query.
 * Exported for unit testing.
 */
type QueryParamValue = string | string[] | undefined;
type QueryParams = Record<string, QueryParamValue>;

export function buildMetricsCacheKey(path: string, query: QueryParams, authHeader: string): string {
  // Split existing query params from provided path (if any)
  const [rawPath, existingQueryString] = path.split('?');
  const merged = new Map<string, string>();

  // Add existing params first
  if (existingQueryString) {
    const existingParams = new URLSearchParams(existingQueryString);
    existingParams.forEach((value, key) => {
      merged.set(key, value);
    });
  }

  // Merge in provided query object (overrides existing)
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      merged.set(k, v.join(','));
    } else if (v !== '') {
      merged.set(k, v);
    }
  });

  // Build stable, sorted query string
  const sortedKeys = Array.from(merged.keys()).sort();
  const finalParams = new URLSearchParams();
  sortedKeys.forEach(k => {
    const val = merged.get(k);
    if (val !== undefined) finalParams.set(k, val);
  });
  const finalQueryString = finalParams.toString();

  const authFingerprint = createHash('sha256').update(authHeader).digest('hex').slice(0, 16); // short fingerprint
  return `${authFingerprint}:${rawPath}${finalQueryString ? `?${finalQueryString}` : ''}`;
}

export async function getMetricsData(event: H3Event<EventHandlerRequest>): Promise<CopilotMetrics[]> {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // Extract locale from headers if not provided in query
  if (!options.locale) {
    options.locale = getLocale(event);
  }

  const apiUrl = options.getApiUrl();
  const mockedDataPath = options.getMockDataPath();

  if (options.isDataMocked && mockedDataPath) {
    const path = resolve(mockedDataPath);
    const data = readFileSync(path, 'utf8');
    const dataJson = JSON.parse(data);

    // Make mock data dynamic based on date range
    const dynamicData = updateMockDataDates(dataJson, options.since, options.until, options.excludeHolidays, options.locale);

    // usage is the new API format
    const usageData = ensureCopilotMetrics(dynamicData);
    logger.info('Using mocked data with dynamic date range');

    return usageData;
  }

  // Authorization must be validated BEFORE any cache lookup to prevent leakage of cached data
  const authHeader = event.context.headers.get('Authorization');
  if (!authHeader) {
    logger.error('No Authentication provided');
    throw new MetricsError('No Authentication provided', 401);
  }

  // Build auth-bound cache key
  const path = event.path || '/api/metrics'; // fallback path (should always exist in practice)
  const cacheKey = buildMetricsCacheKey(path, query as QueryParams, authHeader);

  // Attempt cache lookup with auth fingerprint validation
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    if (cachedData.valid_until > Date.now() / 1000) {
      logger.info(`Returning cached data for ${cacheKey}`);
      return cachedData.data;
    } else {
      logger.info(`Cached data for ${cacheKey} is expired or fingerprint mismatch, fetching new data`);
      cache.delete(cacheKey);
    }
  }

  logger.info(`Fetching metrics data from ${apiUrl}`);

  try {
  const response = await $fetch(apiUrl, {
      headers: event.context.headers
    }) as unknown[];

    // usage is the new API format
    const usageData = ensureCopilotMetrics(response as CopilotMetrics[]);
    // Filter holidays if requested
    const filteredUsageData = filterHolidaysFromMetrics(usageData, options.excludeHolidays || false, options.locale);
    // metrics is the old API format
    const validUntil = Math.floor(Date.now() / 1000) + 5 * 60; // Cache for 5 minutes
  cache.set(cacheKey, { data: filteredUsageData, valid_until: validUntil });
    return filteredUsageData;
  } catch (error: unknown) {
    logger.error('Error fetching metrics data:', error);
    // Clear any cached data for this request to prevent stale data on retry
    cache.delete(cacheKey);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error && typeof error === 'object' && 'statusCode' in error)
      ? (error as { statusCode: number }).statusCode
      : 500;
    throw new MetricsError(`Error fetching metrics data: ${errorMessage}`, statusCode);
  }
}

function updateMockDataDates(originalData: CopilotMetrics[], since?: string, until?: string, excludeHolidays?: boolean, locale?: string): CopilotMetrics[] {
  const today = new Date();
  let startDate: Date;
  let endDate: Date;

  // If no dates provided, use last 28 days
  if (!since && !until) {
    startDate = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000);
    endDate = today;
  } else {
    startDate = since ? parseUtcDate(since) : new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000);
    endDate = until ? parseUtcDate(until) : today;
  }

  // Generate array of dates in the range
  const dateRange: Date[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateToCheck = new Date(currentDate);

    // Skip holidays if excludeHolidays is true
    if (excludeHolidays && locale && isHoliday(dateToCheck, locale)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    dateRange.push(dateToCheck);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Update dates in the dataset, copying existing entries when needed
  const result: CopilotMetrics[] = dateRange.map((date, index) => {
    const dataIndex = index % originalData.length;
    const src = originalData[dataIndex];
    const newDate = date.toISOString().split('T')[0];
    return { ...src, date: newDate };
  });
  return result;
}

function ensureCopilotMetrics(data: CopilotMetrics[]): CopilotMetrics[] {
  return data.map(item => {
    if (!item.copilot_ide_code_completions) {
      item.copilot_ide_code_completions = { editors: [], total_engaged_users: 0, languages: [] };
    }
    item.copilot_ide_code_completions.editors?.forEach((editor) => {
      editor.models?.forEach((model) => {
        if (!model.languages) {
          model.languages = [];
        }
      });
    });
    return item as CopilotMetrics;
  });
};
