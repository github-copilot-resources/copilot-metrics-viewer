/**
 * Metrics storage implementation using Nitro's unstorage
 * Provides database-agnostic persistence for metrics data
 */

import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { StoredMetrics, DateRangeQuery } from './types';
import type { ReportDayTotals } from '../services/github-copilot-usage-api';
import { buildMetricsKey } from './types';

/**
 * Save metrics data to storage.
 * Stores both the CopilotMetrics (for UI) and raw ReportDayTotals (for aggregation).
 */
export async function saveMetrics(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  data: CopilotMetrics,
  teamSlug?: string,
  reportData?: ReportDayTotals
): Promise<void> {
  const storage = useStorage('metrics');
  const key = buildMetricsKey(scope, scopeIdentifier, metricsDate, teamSlug);
  
  const storedMetrics: StoredMetrics = {
    scope,
    scopeIdentifier,
    teamSlug,
    metricsDate,
    data,
    reportData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await storage.setItem(key, storedMetrics);
}

/**
 * Get metrics for a specific date
 */
export async function getMetrics(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  teamSlug?: string
): Promise<CopilotMetrics | null> {
  const storage = useStorage('metrics');
  const key = buildMetricsKey(scope, scopeIdentifier, metricsDate, teamSlug);
  
  const stored = await storage.getItem<StoredMetrics>(key);
  return stored ? stored.data : null;
}

/**
 * Get raw report data for a specific date (richer than CopilotMetrics)
 */
export async function getReportData(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  teamSlug?: string
): Promise<ReportDayTotals | null> {
  const storage = useStorage('metrics');
  const key = buildMetricsKey(scope, scopeIdentifier, metricsDate, teamSlug);
  
  const stored = await storage.getItem<StoredMetrics>(key);
  return stored?.reportData ?? null;
}

/**
 * Get metrics for a date range
 */
export async function getMetricsByDateRange(query: DateRangeQuery): Promise<CopilotMetrics[]> {
  const { scope, scopeIdentifier, teamSlug, startDate, endDate } = query;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results: CopilotMetrics[] = [];
  
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const metrics = await getMetrics(scope, scopeIdentifier, dateStr, teamSlug);
    
    if (metrics) {
      results.push(metrics);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return results;
}

/**
 * Check if metrics exist for a specific date
 */
export async function hasMetrics(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  teamSlug?: string
): Promise<boolean> {
  const storage = useStorage('metrics');
  const key = buildMetricsKey(scope, scopeIdentifier, metricsDate, teamSlug);
  return await storage.hasItem(key);
}

/**
 * Delete metrics for a specific date
 */
export async function deleteMetrics(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  teamSlug?: string
): Promise<void> {
  const storage = useStorage('metrics');
  const key = buildMetricsKey(scope, scopeIdentifier, metricsDate, teamSlug);
  await storage.removeItem(key);
}

/**
 * Get all keys for metrics (useful for listing/debugging)
 */
export async function listMetricsKeys(): Promise<string[]> {
  const storage = useStorage('metrics');
  return await storage.getKeys('metrics:');
}
