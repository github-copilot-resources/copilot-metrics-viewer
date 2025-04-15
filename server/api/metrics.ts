import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import { convertToMetrics } from '@/model/MetricsToUsageConverter';
import { ensureCopilotMetrics } from '@/model/Copilot_Metrics'; // Import the ensureCopilotMetrics function from model
import type { MetricsApiResponse } from "@/types/metricsApiResponse";
import type FetchError from 'ofetch';
import { getTeamSlugByName } from './teams'; // Import getTeamSlugByName function

// TODO: use for storage https://unstorage.unjs.io/drivers/azure

import { readFileSync } from 'fs';
import { resolve } from 'path';

export default defineEventHandler(async (event) => {

    const logger = console;
    const config = useRuntimeConfig(event);
    let apiUrl = '';
    let mockedDataPath: string;

    switch (event.context.scope) {
        case 'team':

            // get team slug by name, then use it to get the metrics
            const teamSlug = await getTeamSlugByName(event, event.context.team, event.context.org);
            if (!teamSlug) {
                logger.error(`Team slug not found for team: ${event.context.team}`);
                return new Response(`Team slug not found for team: ${event.context.team}`, { status: 404 });
            }
            apiUrl = `https://api.github.com/orgs/${event.context.org}/team/${teamSlug}/copilot/metrics`;
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
        const response = await $fetch(apiUrl, {
            headers: event.context.headers
        }) as unknown[];

        // usage is the new API format
        // Define a proper type for the response to maintain type safety
        const usageData = ensureCopilotMetrics(response as CopilotMetrics[]);
        // metrics is the old API format
        const metricsData = convertToMetrics(usageData);
        return { metrics: metricsData, usage: usageData } as MetricsApiResponse;
    } catch (error: any) {
        logger.error('Error fetching metrics data:', error);
        return new Response('Error fetching metrics data: ' + error, { status: error.statusCode || 500 });
    }
})