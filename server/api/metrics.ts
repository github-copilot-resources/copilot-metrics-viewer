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
        // usage is the new API format
        const usageData = ensureCopilotMetrics(dataJson);
        // metrics is the old API format
        const metricsData = convertToMetrics(usageData);

        logger.info('Using mocked data');
        return { metrics: metricsData, usage: usageData } as MetricsApiResponse;
    }

    if (!event.context.headers.has('Authorization')) {
        logger.error('No Authentication provided');
        return new Response('No Authentication provided', { status: 401 });
    }

    logger.info(`Fetching metrics data from ${apiUrl}`);

    try {
        // Handle potential pagination for metrics API
        let allMetricsData: CopilotMetrics[] = [];
        let page = 1;
        const perPage = 100; // GitHub API typically uses 100 as max per_page
        
        while (true) {
            // Build URL with pagination parameters
            const paginatedUrl = new URL(apiUrl);
            paginatedUrl.searchParams.set('per_page', perPage.toString());
            paginatedUrl.searchParams.set('page', page.toString());
            
            logger.info(`Fetching metrics data page ${page} from ${paginatedUrl.toString()}`);
            
            const response = await $fetch(paginatedUrl.toString(), {
                headers: event.context.headers
            }) as unknown[];

            const pageData = response as CopilotMetrics[];
            
            // If we get less than perPage items, this is the last page
            if (pageData.length === 0) {
                break;
            }
            
            allMetricsData = allMetricsData.concat(pageData);
            
            // If we got less than perPage items, this is the last page
            if (pageData.length < perPage) {
                break;
            }
            
            page++;
        }

        // usage is the new API format
        const usageData = ensureCopilotMetrics(allMetricsData);
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