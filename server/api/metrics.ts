import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import { convertToMetrics } from '@/model/MetricsToUsageConverter';
import type { MetricsApiResponse } from "@/types/metricsApiResponse";
import type FetchError from 'ofetch';

// TODO: use for storage https://unstorage.unjs.io/drivers/azure

import { readFileSync } from 'fs';
import { Options } from '@/model/Options';

const cache = new Map<string, MetricsApiResponse>();

export default defineEventHandler(async (event) => {

    const logger = console;
    const query = getQuery(event);
    const options = Options.fromQuery(query);

    const apiUrl = options.getApiUrl();
    const mockedDataPath = options.getMockDataPath();

    if (options.isDataMocked && mockedDataPath) {
        const path = mockedDataPath;
        const data = readFileSync(path, 'utf8');
        const dataJson = JSON.parse(data);

        // Make mock data dynamic based on date range
        const dynamicData = updateMockDataDates(dataJson, options.since, options.until);

        // usage is the new API format
        const usageData = ensureCopilotMetrics(dynamicData);
        // metrics is the old API format
        const metricsData = convertToMetrics(usageData);

        logger.info('Using mocked data with dynamic date range');
        const result = { metrics: metricsData, usage: usageData } as MetricsApiResponse;
        return result;
    }

    if (cache.has(apiUrl)) {
        logger.info(`Returning cached data for ${apiUrl}`);
        const cachedData = cache.get(apiUrl);
        if (cachedData && cachedData.valid_until > Date.now() / 1000) {
            return cachedData;
        } else {
            logger.info(`Cached data for ${apiUrl} is expired, fetching new data`);
            cache.delete(apiUrl);
        }
    }

    if (!event.context.headers.has('Authorization')) {
        logger.error('No Authentication provided');
        return new Response('No Authentication provided', { status: 401 });
    }

    logger.info(`Fetching metrics data from ${apiUrl}`);

    try {
        const response = await $fetch(apiUrl, {
            headers: event.context.headers
        }) as unknown[];

        // usage is the new API format
        const usageData = ensureCopilotMetrics(response as CopilotMetrics[]);
        // metrics is the old API format
        const metricsData = convertToMetrics(usageData);
        const validUntil = Math.floor(Date.now() / 1000) + 5 * 60; // Cache for 5 minutes
        const result = { metrics: metricsData, usage: usageData, valid_until: validUntil } as MetricsApiResponse;
        cache.set(apiUrl, result);
        return result;
    } catch (error: FetchError) {
        logger.error('Error fetching metrics data:', error);
        return new Response('Error fetching metrics data: ' + error, { status: error.statusCode || 500 });
    }
})

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

function updateMockDataDates(originalData: CopilotMetrics[], since?: string, until?: string): CopilotMetrics[] {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    // If no dates provided, use last 28 days
    if (!since && !until) {
        startDate = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000);
        endDate = today;
    } else {
        startDate = since ? new Date(since) : new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000);
        endDate = until ? new Date(until) : today;
    }

    // Generate array of dates in the range
    const dateRange: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        dateRange.push(new Date(currentDate));
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