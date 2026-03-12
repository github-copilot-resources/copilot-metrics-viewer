/**
 * Metrics storage implementation backed by PostgreSQL.
 * Provides persistence for daily Copilot usage metrics.
 */

import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { DateRangeQuery } from './types';
import type { ReportDayTotals } from '../services/github-copilot-usage-api';
import { getPool } from './db';

/**
 * Save metrics data to storage.
 * Stores both the CopilotMetrics (for UI) and raw ReportDayTotals (for aggregation).
 * Uses upsert — safe to call multiple times for the same day.
 */
export async function saveMetrics(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  data: CopilotMetrics,
  teamSlug?: string,
  reportData?: ReportDayTotals
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO metrics (scope, identifier, team_slug, metrics_date, data, report_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (scope, identifier, team_slug, metrics_date)
     DO UPDATE SET data = $5, report_data = $6, updated_at = NOW()`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate, JSON.stringify(data), reportData ? JSON.stringify(reportData) : null]
  );
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
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT data FROM metrics
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3 AND metrics_date = $4`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate]
  );
  return rows.length > 0 ? rows[0].data : null;
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
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT report_data FROM metrics
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3 AND metrics_date = $4`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate]
  );
  return rows.length > 0 ? rows[0].report_data : null;
}

/**
 * Get raw report data for a date range — returns ReportDayTotals[] for new API consumers
 */
export async function getReportDataByDateRange(
  scope: string,
  scopeIdentifier: string,
  startDate: string,
  endDate: string,
  teamSlug?: string
): Promise<ReportDayTotals[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT report_data FROM metrics
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3
       AND metrics_date BETWEEN $4 AND $5
       AND report_data IS NOT NULL
     ORDER BY metrics_date ASC`,
    [scope, scopeIdentifier, teamSlug || '', startDate, endDate]
  );
  return rows.map(r => r.report_data);
}

/**
 * Get metrics for a date range — single SQL query instead of N file reads
 */
export async function getMetricsByDateRange(query: DateRangeQuery): Promise<CopilotMetrics[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT data FROM metrics
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3
       AND metrics_date BETWEEN $4 AND $5
     ORDER BY metrics_date ASC`,
    [query.scope, query.scopeIdentifier, query.teamSlug || '', query.startDate, query.endDate]
  );
  return rows.map(r => r.data);
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
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM metrics
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3 AND metrics_date = $4
       AND report_data IS NOT NULL
     LIMIT 1`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate]
  );
  return rows.length > 0;
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
  const pool = getPool();
  await pool.query(
    `DELETE FROM metrics
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3 AND metrics_date = $4`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate]
  );
}

/**
 * Count stored metrics for a scope (useful for sync-status)
 */
export async function countMetrics(
  scope: string,
  scopeIdentifier: string,
  startDate: string,
  endDate: string,
  teamSlug?: string
): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM metrics
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3
       AND metrics_date BETWEEN $4 AND $5`,
    [scope, scopeIdentifier, teamSlug || '', startDate, endDate]
  );
  return rows[0].count;
}
