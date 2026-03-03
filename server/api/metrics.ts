import { convertToMetrics } from '@/model/MetricsToUsageConverter';
import type { MetricsApiResponse } from "@/types/metricsApiResponse";
import { getMetricsDataV2 } from '../../shared/utils/metrics-util-v2';

export default defineEventHandler(async (event) => {

    const logger = console;

    try {
        // Always use v2 handler which tries new API first, falls back to legacy
        const usageData = await getMetricsDataV2(event);

        // metrics is the old API format
        const metricsData = convertToMetrics(usageData);

        const result = { metrics: metricsData, usage: usageData } as MetricsApiResponse;
        return result;
    } catch (error: unknown) {
        logger.error('Error fetching metrics data:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const statusCode = (error && typeof error === 'object' && 'statusCode' in error)
            ? (error as { statusCode: number }).statusCode
            : 500;
        return new Response('Error fetching metrics data: ' + errorMessage, { status: statusCode });
    }
})

