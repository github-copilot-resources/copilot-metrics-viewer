import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { H3Event, EventHandlerRequest } from 'h3';
import { Options } from '@/model/Options';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getLocale } from "./getLocale";
import { filterHolidaysFromMetrics, isHoliday, parseUtcDate } from '@/utils/dateUtils';

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

  if (cache.has(event.path)) {
    const cachedData = cache.get(event.path);
    if (cachedData && cachedData.valid_until > Date.now() / 1000) {
      logger.info(`Returning cached data for ${event.path}`);
      return cachedData.data;
    } else {
      logger.info(`Cached data for ${event.path} is expired, fetching new data`);
      cache.delete(event.path);
    }
  }

  if (!event.context.headers.has('Authorization')) {
    logger.error('No Authentication provided');
    throw new MetricsError('No Authentication provided', 401);
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
    cache.set(event.path, { data: filteredUsageData, valid_until: validUntil });
    return filteredUsageData;
  } catch (error: unknown) {
    logger.error('Error fetching metrics data:', error);
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
  const result = dateRange.map((date, index) => {
    // Use existing data entries, cycling through them
    const dataIndex = index % originalData.length;
    const entry = { ...originalData[dataIndex] };

    // Update the date
    entry.date = date.toISOString().split('T')[0];

    return entry;
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
