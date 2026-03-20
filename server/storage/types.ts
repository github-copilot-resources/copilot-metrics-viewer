/**
 * Storage interface definitions for Copilot Metrics Viewer
 */

import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { Seat } from '@/model/Seat';
import type { ReportDayTotals } from '../services/github-copilot-usage-api';

/**
 * Sync status for tracking data synchronization
 */
export interface SyncStatus {
  scope: string;
  scopeIdentifier: string;
  teamSlug?: string;
  metricsDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  errorMessage?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  completedAt?: string;
  createdAt: string;
}

/**
 * Stored metrics data — stores the new API report format (ReportDayTotals)
 * alongside the transformed CopilotMetrics for backward compatibility.
 */
export interface StoredMetrics {
  scope: string;
  scopeIdentifier: string;
  teamSlug?: string;
  metricsDate: string;
  /** Transformed CopilotMetrics for UI consumption */
  data: CopilotMetrics;
  /** Raw report data from new API — richer, supports future aggregations */
  reportData?: ReportDayTotals;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stored seats data with metadata
 */
export interface StoredSeats {
  scope: string;
  scopeIdentifier: string;
  snapshotDate: string;
  seats: Seat[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Query options for date range queries
 */
export interface DateRangeQuery {
  scope: string;
  scopeIdentifier: string;
  teamSlug?: string;
  startDate: string;
  endDate: string;
}
