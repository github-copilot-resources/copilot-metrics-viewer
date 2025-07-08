import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import { convertToMetrics } from '@/model/MetricsToUsageConverter';
import type { MetricsApiResponse } from "@/types/metricsApiResponse";
import type FetchError from 'ofetch';

// TODO: use for storage https://unstorage.unjs.io/drivers/azure

import { readFileSync } from 'fs';
import { resolve } from 'path';

export default defineEventHandler(async (event) => {

    const logger = console;
    const config = useRuntimeConfig(event);
    const query = getQuery(event);
    
    let apiUrl = '';
    let mockedDataPath: string;

    // Extract date parameters from query
    const since = query.since as string | undefined;
    const until = query.until as string | undefined;

    switch (event.context.scope) {
        case 'team':
            apiUrl = `https://api.github.com/orgs/${event.context.org}/team/${event.context.team}/copilot/metrics`;
            // no team test data available, using org data
            // '../../app/mock-data/organization_metrics_response_sample.json'
            mockedDataPath = resolve('public/mock-data/organization_metrics_response_sample.json');
            break;
        case 'org':
            apiUrl = `https://api.github.com/orgs/${event.context.org}/copilot/metrics`;
            mockedDataPath = resolve('public/mock-data/organization_metrics_response_sample.json');
            break;
        case 'ent':
            apiUrl = `https://api.github.com/enterprises/${event.context.ent}/copilot/metrics`;
            mockedDataPath = resolve('public/mock-data/enterprise_metrics_response_sample.json');
            break;
        default:
            return new Response('Invalid configuration/parameters for the request', { status: 400 });
    }

    // Add query parameters for date filtering if provided
    if (since || until) {
        const urlParams = new URLSearchParams();
        if (since) urlParams.append('since', since);
        if (until) urlParams.append('until', until);
        apiUrl += `?${urlParams.toString()}`;
    }

    if (config.public.isDataMocked && mockedDataPath) {
        const path = mockedDataPath;
        const data = readFileSync(path, 'utf8');
        const dataJson = JSON.parse(data);
        
        // Make mock data dynamic based on date range
        const dynamicData = updateMockDataDates(dataJson, since, until);
        
        // usage is the new API format
        const usageData = ensureCopilotMetrics(dynamicData);
        // metrics is the old API format
        const metricsData = convertToMetrics(usageData);

        logger.info('Using mocked data with dynamic date range');
        return { metrics: metricsData, usage: usageData } as MetricsApiResponse;
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
        return { metrics: metricsData, usage: usageData } as MetricsApiResponse;
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