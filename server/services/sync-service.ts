/**
 * Data Sync Service
 * Orchestrates syncing metrics from GitHub API to storage.
 *
 * Uses the new download-based Copilot Usage Metrics API:
 *   - 28-day bulk download: one API call for up to 28 days of data
 *   - Stores both raw ReportDayTotals (for future aggregation) and
 *     transformed CopilotMetrics (for UI consumption)
 */

import { fetchLatestReport, fetchReportForDate, fetchLatestUserReport, type MetricsReportRequest, type ReportDayTotals } from './github-copilot-usage-api';
import { transformDayToMetrics } from './report-transformer';
import { saveMetrics, hasMetrics } from '../storage/metrics-storage';
import { saveUserMetrics, hasUserMetrics } from '../storage/user-metrics-storage';
import { saveSeats, hasSeats, getLatestSeats } from '../storage/seats-storage';
import { Seat } from '@/model/Seat';
// ofetch fallback for standalone (non-Nitro) environments
import { $fetch as _ofetch } from 'ofetch';
const _fetch = typeof $fetch !== 'undefined' ? $fetch : _ofetch;
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

export interface BulkSyncResult {
  success: boolean;
  totalDays: number;
  savedDays: number;
  skippedDays: number;
  errors: Array<{ date: string; error: string }>;
}

/**
 * Save a single day's report data to storage.
 * Stores both the transformed CopilotMetrics and the raw ReportDayTotals.
 */
async function saveDayData(
  scope: string,
  identifier: string,
  dayData: ReportDayTotals,
  teamSlug?: string
): Promise<void> {
  const metrics = transformDayToMetrics(dayData);
  await saveMetrics(scope, identifier, dayData.day, metrics, teamSlug, dayData);
}

/**
 * Sync metrics using the 28-day bulk download.
 * One API call fetches up to 28 days, then saves each day individually.
 * Skips days that are already stored.
 */
export async function syncBulk(
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise',
  identifier: string,
  headers: HeadersInit,
  teamSlug?: string
): Promise<BulkSyncResult> {
  const logger = console;
  const result: BulkSyncResult = {
    success: true,
    totalDays: 0,
    savedDays: 0,
    skippedDays: 0,
    errors: [],
  };

  try {
    const request: MetricsReportRequest = { scope, identifier, teamSlug };
    logger.info(`Starting bulk sync for ${scope}:${identifier}`);

    const report = await fetchLatestReport(request, headers);
    result.totalDays = report.day_totals.length;
    logger.info(`Downloaded report with ${result.totalDays} days (${report.report_start_day} to ${report.report_end_day})`);

    for (const dayData of report.day_totals) {
      try {
        const exists = await hasMetrics(scope, identifier, dayData.day, teamSlug);
        if (exists) {
          result.skippedDays++;
          continue;
        }

        await saveDayData(scope, identifier, dayData, teamSlug);
        result.savedDays++;
        logger.info(`Saved metrics for ${dayData.day}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push({ date: dayData.day, error: msg });
        logger.error(`Failed to save ${dayData.day}: ${msg}`);
      }
    }

    result.success = result.errors.length === 0;
    logger.info(`Bulk sync complete: ${result.savedDays} saved, ${result.skippedDays} skipped, ${result.errors.length} errors`);
    return result;

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Bulk sync failed: ${msg}`);
    return { ...result, success: false, errors: [{ date: 'bulk', error: msg }] };
  }
}

/**
 * Sync metrics for a single date using the 1-day endpoint.
 * Used by daily cron job for yesterday's data.
 */
export async function syncMetricsForDate(request: SyncRequest): Promise<SyncResult> {
  const { scope, identifier, date, teamSlug, headers } = request;
  const logger = console;

  try {
    // Check if already synced
    const exists = await hasMetrics(scope, identifier, date, teamSlug);
    if (exists) {
      logger.info(`Metrics for ${date} already synced, skipping`);
      return { success: true, date, metricsCount: 1 };
    }

    // Update sync status
    const syncStatus = await getSyncStatus(scope, identifier, date, teamSlug);
    if (!syncStatus) {
      await createPendingSyncStatus(scope, identifier, date, teamSlug);
    }
    await markSyncInProgress(scope, identifier, date, teamSlug);

    // Fetch from new API (1-day endpoint)
    logger.info(`Fetching metrics for ${scope}:${identifier} on ${date}`);
    const apiRequest: MetricsReportRequest = { scope, identifier, teamSlug };
    const report = await fetchReportForDate(apiRequest, headers, date);

    let syncedCount = 0;
    for (const dayData of report.day_totals) {
      if (dayData.day === date) {
        await saveDayData(scope, identifier, dayData, teamSlug);
        syncedCount++;
        logger.info(`Saved metrics for ${date}`);
      }
    }

    await markSyncCompleted(scope, identifier, date, teamSlug);
    return { success: true, date, metricsCount: syncedCount };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to sync metrics for ${date}:`, errorMessage);

    try {
      await markSyncFailed(scope, identifier, date, errorMessage, teamSlug);
    } catch (statusError) {
      logger.error('Failed to update sync status:', statusError);
    }

    return { success: false, date, error: errorMessage, metricsCount: 0 };
  }
}

/**
 * Sync metrics for a date range.
 * Uses 28-day bulk download and filters to the requested range.
 */
export async function syncMetricsForDateRange(
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise',
  identifier: string,
  startDate: string,
  endDate: string,
  headers: HeadersInit,
  teamSlug?: string
): Promise<SyncResult[]> {
  const logger = console;

  // Use bulk download (28-day) and filter to requested range
  const request: MetricsReportRequest = { scope, identifier, teamSlug };
  const report = await fetchLatestReport(request, headers);

  const results: SyncResult[] = [];
  for (const dayData of report.day_totals) {
    if (dayData.day < startDate || dayData.day > endDate) continue;

    try {
      const exists = await hasMetrics(scope, identifier, dayData.day, teamSlug);
      if (exists) {
        results.push({ success: true, date: dayData.day, metricsCount: 1 });
        continue;
      }

      await saveDayData(scope, identifier, dayData, teamSlug);
      results.push({ success: true, date: dayData.day, metricsCount: 1 });
      logger.info(`Saved metrics for ${dayData.day}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ success: false, date: dayData.day, error: msg, metricsCount: 0 });
    }
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
 * Sync only missing dates using bulk download.
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

  console.log(`Found ${missingDates.length} missing dates, syncing via bulk download...`);

  // Use bulk download and filter to missing dates
  const request: MetricsReportRequest = { scope, identifier, teamSlug };
  const report = await fetchLatestReport(request, headers);
  const missingSet = new Set(missingDates);

  const results: SyncResult[] = [];
  for (const dayData of report.day_totals) {
    if (!missingSet.has(dayData.day)) continue;

    try {
      await saveDayData(scope, identifier, dayData, teamSlug);
      results.push({ success: true, date: dayData.day, metricsCount: 1 });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ success: false, date: dayData.day, error: msg, metricsCount: 0 });
    }
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
  const missingDates: string[] = [];

  const current = new Date(start);
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

  return { totalDays, syncedDays, missingDays: totalDays - syncedDays, missingDates };
}

export interface UserMetricsSyncResult {
  success: boolean;
  reportStartDay: string;
  reportEndDay: string;
  userCount: number;
  error?: string;
}

/**
 * Sync per-user metrics using the 28-day bulk download.
 * Designed for large enterprises: handles multiple download links in parallel.
 * Skips the period if already stored.
 */
export async function syncUserMetrics(
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise',
  identifier: string,
  headers: HeadersInit,
  teamSlug?: string
): Promise<UserMetricsSyncResult> {
  const logger = console;

  try {
    const request: MetricsReportRequest = { scope, identifier, teamSlug };
    logger.info(`Starting user metrics sync for ${scope}:${identifier}`);

    const report = await fetchLatestUserReport(request, headers);

    if (!report.user_totals || report.user_totals.length === 0) {
      logger.info('No user totals in report, skipping save');
      return {
        success: true,
        reportStartDay: report.report_start_day,
        reportEndDay: report.report_end_day,
        userCount: 0
      };
    }

    const alreadySynced = await hasUserMetrics(
      scope,
      identifier,
      report.report_start_day,
      report.report_end_day
    );

    if (alreadySynced) {
      logger.info(`User metrics for ${report.report_start_day}–${report.report_end_day} already synced, skipping`);
      return {
        success: true,
        reportStartDay: report.report_start_day,
        reportEndDay: report.report_end_day,
        userCount: report.user_totals.length
      };
    }

    await saveUserMetrics(scope, identifier, report.report_start_day, report.report_end_day, report.user_totals);

    logger.info(`Saved user metrics: ${report.user_totals.length} users for ${report.report_start_day}–${report.report_end_day}`);

    return {
      success: true,
      reportStartDay: report.report_start_day,
      reportEndDay: report.report_end_day,
      userCount: report.user_totals.length
    };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`User metrics sync failed: ${msg}`);
    return {
      success: false,
      reportStartDay: '',
      reportEndDay: '',
      userCount: 0,
      error: msg
    };
  }
}

export interface SeatsSyncResult {
  success: boolean;
  snapshotDate: string;
  seatCount: number;
  error?: string;
}

/**
 * Sync today's seat snapshot for a scope.
 * Fetches all billing-seats pages from GitHub and stores them as a single daily
 * snapshot.  Skips if today's snapshot is already stored.
 */
export async function syncSeats(
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise',
  identifier: string,
  headers: HeadersInit
): Promise<SeatsSyncResult> {
  const logger = console;
  const today = new Date().toISOString().split('T')[0];

  try {
    const alreadySynced = await hasSeats(scope, identifier, today);
    if (alreadySynced) {
      logger.info(`Seats snapshot for ${today} already stored, skipping`);
      const existing = await getLatestSeats(scope, identifier);
      return { success: true, snapshotDate: today, seatCount: existing?.length ?? 0 };
    }

    const baseUrl = 'https://api.github.com';
    const apiUrl = (scope === 'enterprise' || scope === 'team-enterprise')
      ? `${baseUrl}/enterprises/${identifier}/copilot/billing/seats`
      : `${baseUrl}/orgs/${identifier}/copilot/billing/seats`;

    const GITHUB_PER_PAGE = 100;
    let page = 1;
    const allSeats: Seat[] = [];

    logger.info(`Syncing seats for ${scope}:${identifier}`);

    const first = await _fetch(apiUrl, {
      headers,
      params: { per_page: GITHUB_PER_PAGE, page }
    }) as { seats: unknown[]; total_seats: number };

    allSeats.push(...first.seats.map((item: unknown) => new Seat(item)));
    const totalPages = Math.ceil(first.total_seats / GITHUB_PER_PAGE);

    for (page = 2; page <= totalPages; page++) {
      const resp = await _fetch(apiUrl, {
        headers,
        params: { per_page: GITHUB_PER_PAGE, page }
      }) as { seats: unknown[]; total_seats: number };
      allSeats.push(...resp.seats.map((item: unknown) => new Seat(item)));
    }

    await saveSeats(scope, identifier, today, allSeats);
    logger.info(`Saved ${allSeats.length} seats snapshot for ${today}`);

    return { success: true, snapshotDate: today, seatCount: allSeats.length };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Seats sync failed: ${msg}`);
    return { success: false, snapshotDate: today, seatCount: 0, error: msg };
  }
}
