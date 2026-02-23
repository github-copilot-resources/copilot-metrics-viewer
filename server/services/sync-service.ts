/**
 * Data Sync Service
 * Orchestrates syncing metrics from GitHub API to storage
 */

import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import { fetchMetricsForDate, type MetricsReportRequest } from './github-copilot-usage-api';
import { saveMetrics, hasMetrics, getMetrics } from '../storage/metrics-storage';
import { 
  createPendingSyncStatus, 
  markSyncInProgress, 
  markSyncCompleted, 
  markSyncFailed,
  getSyncStatus
} from '../storage/sync-storage';

export interface SyncRequest {
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise';
  identifier: string;
  date: string;
  teamSlug?: string;
  headers: HeadersInit;
}

export interface SyncResult {
  success: boolean;
  date: string;
  error?: string;
  metricsCount: number;
}

/**
 * Sync metrics for a single date
 */
export async function syncMetricsForDate(request: SyncRequest): Promise<SyncResult> {
  const { scope, identifier, date, teamSlug, headers } = request;
  const logger = console;

  try {
    // Check if already synced
    const exists = await hasMetrics(scope, identifier, date, teamSlug);
    if (exists) {
      logger.info(`Metrics for ${date} already synced, skipping`);
      return {
        success: true,
        date,
        metricsCount: 1
      };
    }

    // Create sync status
    const syncStatus = await getSyncStatus(scope, identifier, date, teamSlug);
    if (!syncStatus) {
      await createPendingSyncStatus(scope, identifier, date, teamSlug);
    }

    // Mark as in progress
    await markSyncInProgress(scope, identifier, date, teamSlug);

    // Fetch from GitHub API
    logger.info(`Fetching metrics for ${scope}:${identifier} on ${date}`);
    const metricsRequest: MetricsReportRequest = {
      scope,
      identifier,
      date,
      teamSlug
    };

    const metricsArray = await fetchMetricsForDate(metricsRequest, headers);

    // Handle NDJSON response - typically one object per day
    // but the new API might return multiple entries
    let syncedCount = 0;
    for (const metricsData of metricsArray) {
      const metrics = metricsData as CopilotMetrics;
      
      // Verify the date matches
      if (metrics.date === date) {
        await saveMetrics(scope, identifier, date, metrics, teamSlug);
        syncedCount++;
        logger.info(`Saved metrics for ${date}`);
      }
    }

    // Mark as completed
    await markSyncCompleted(scope, identifier, date, teamSlug);

    return {
      success: true,
      date,
      metricsCount: syncedCount
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to sync metrics for ${date}:`, errorMessage);

    // Mark as failed
    try {
      await markSyncFailed(scope, identifier, date, errorMessage, teamSlug);
    } catch (statusError) {
      logger.error('Failed to update sync status:', statusError);
    }

    return {
      success: false,
      date,
      error: errorMessage,
      metricsCount: 0
    };
  }
}

/**
 * Sync metrics for a date range
 */
export async function syncMetricsForDateRange(
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise',
  identifier: string,
  startDate: string,
  endDate: string,
  headers: HeadersInit,
  teamSlug?: string
): Promise<SyncResult[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results: SyncResult[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    
    const result = await syncMetricsForDate({
      scope,
      identifier,
      date: dateStr,
      teamSlug,
      headers
    });

    results.push(result);
    current.setDate(current.getDate() + 1);
  }

  return results;
}

/**
 * Detect gaps in synced data and return missing dates
 */
export async function detectGaps(
  scope: string,
  identifier: string,
  startDate: string,
  endDate: string,
  teamSlug?: string
): Promise<string[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const missingDates: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const exists = await hasMetrics(scope, identifier, dateStr, teamSlug);
    
    if (!exists) {
      missingDates.push(dateStr);
    }
    
    current.setDate(current.getDate() + 1);
  }

  return missingDates;
}

/**
 * Sync only missing dates (gap filling)
 */
export async function syncGaps(
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise',
  identifier: string,
  startDate: string,
  endDate: string,
  headers: HeadersInit,
  teamSlug?: string
): Promise<SyncResult[]> {
  const missingDates = await detectGaps(scope, identifier, startDate, endDate, teamSlug);
  
  if (missingDates.length === 0) {
    console.log('No gaps detected, all dates already synced');
    return [];
  }

  console.log(`Found ${missingDates.length} missing dates, syncing...`);

  const results: SyncResult[] = [];
  for (const date of missingDates) {
    const result = await syncMetricsForDate({
      scope,
      identifier,
      date,
      teamSlug,
      headers
    });
    results.push(result);
  }

  return results;
}

/**
 * Get sync statistics for a scope
 */
export async function getSyncStats(
  scope: string,
  identifier: string,
  startDate: string,
  endDate: string,
  teamSlug?: string
): Promise<{
  totalDays: number;
  syncedDays: number;
  missingDays: number;
  missingDates: string[];
}> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let totalDays = 0;
  let syncedDays = 0;

  const current = new Date(start);
  const missingDates: string[] = [];

  while (current <= end) {
    totalDays++;
    const dateStr = current.toISOString().split('T')[0];
    const exists = await hasMetrics(scope, identifier, dateStr, teamSlug);
    
    if (exists) {
      syncedDays++;
    } else {
      missingDates.push(dateStr);
    }
    
    current.setDate(current.getDate() + 1);
  }

  return {
    totalDays,
    syncedDays,
    missingDays: totalDays - syncedDays,
    missingDates
  };
}
