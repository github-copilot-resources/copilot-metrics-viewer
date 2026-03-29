/**
 * User Metrics storage implementation backed by PostgreSQL.
 * Stores per-user Copilot usage metrics aggregated over date ranges.
 */

import type { UserTotals } from '../services/github-copilot-usage-api';
import { getPool } from './db';

/**
 * Aggregated user-metrics statistics for one stored 28-day snapshot.
 */
export interface UserMetricsHistoryEntry {
  report_start_day: string;
  report_end_day: string;
  total_users: number;
  active_users: number;
  total_premium_requests: number;
  avg_acceptance_rate: number;
}

/**
 * Save user metrics data to storage (upsert).
 * Each record covers a report period identified by report_start_day + report_end_day.
 */
export async function saveUserMetrics(
  scope: string,
  scopeIdentifier: string,
  reportStartDay: string,
  reportEndDay: string,
  userTotals: UserTotals[]
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO user_metrics (scope, identifier, report_start_day, report_end_day, user_totals)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (scope, identifier, report_start_day, report_end_day)
     DO UPDATE SET user_totals = $5, updated_at = NOW()`,
    [scope, scopeIdentifier, reportStartDay, reportEndDay, JSON.stringify(userTotals)]
  );
}

/**
 * Get user metrics for a specific report period.
 */
export async function getUserMetrics(
  scope: string,
  scopeIdentifier: string,
  reportStartDay: string,
  reportEndDay: string
): Promise<UserTotals[] | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_totals FROM user_metrics
     WHERE scope = $1 AND identifier = $2
       AND report_start_day = $3 AND report_end_day = $4`,
    [scope, scopeIdentifier, reportStartDay, reportEndDay]
  );
  return rows.length > 0 ? rows[0].user_totals : null;
}

/**
 * Get the latest user metrics (most recent report_end_day).
 */
export async function getLatestUserMetrics(
  scope: string,
  scopeIdentifier: string
): Promise<{ reportStartDay: string; reportEndDay: string; userTotals: UserTotals[] } | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT report_start_day, report_end_day, user_totals
     FROM user_metrics
     WHERE scope = $1 AND identifier = $2
     ORDER BY report_end_day DESC LIMIT 1`,
    [scope, scopeIdentifier]
  );
  if (rows.length === 0) return null;
  return {
    reportStartDay: rows[0].report_start_day,
    reportEndDay: rows[0].report_end_day,
    userTotals: rows[0].user_totals
  };
}

/**
 * Check if user metrics exist for a specific report period.
 */
export async function hasUserMetrics(
  scope: string,
  scopeIdentifier: string,
  reportStartDay: string,
  reportEndDay: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM user_metrics
     WHERE scope = $1 AND identifier = $2
       AND report_start_day = $3 AND report_end_day = $4
     LIMIT 1`,
    [scope, scopeIdentifier, reportStartDay, reportEndDay]
  );
  return rows.length > 0;
}

/**
 * Compute acceptance rate as a percentage (0–100), rounded to one decimal place.
 */
function calcAcceptanceRate(generated: number, accepted: number): number {
  return generated > 0 ? parseFloat(((accepted / generated) * 100).toFixed(1)) : 0;
}

/**
 * One data point in a single user's time series.
 */
export interface UserTimeSeriesEntry {
  report_end_day: string;
  total_active_days: number;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_added_sum: number;
  premium_requests_total: number;
  acceptance_rate: number;
}

/**
 * Return the per-snapshot stats for a single user, ordered by report_end_day ascending.
 * Each stored 28-day snapshot contains a full user_totals array; this function
 * extracts the named user from every snapshot where they appear.
 */
export async function getUserTimeSeries(
  scope: string,
  scopeIdentifier: string,
  login: string
): Promise<UserTimeSeriesEntry[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT report_end_day, user_totals
     FROM user_metrics
     WHERE scope = $1 AND identifier = $2
     ORDER BY report_end_day ASC`,
    [scope, scopeIdentifier]
  );

  const series: UserTimeSeriesEntry[] = [];

  for (const row of rows) {
    const totals: UserTotals[] = row.user_totals;
    const user = totals.find(u => u.login === login);
    if (!user) continue; // user not present in this snapshot — skip

    const gen = user.code_generation_activity_count;
    const acc = user.code_acceptance_activity_count;

    series.push({
      report_end_day:   new Date(row.report_end_day).toISOString().slice(0, 10),
      total_active_days: user.total_active_days,
      user_initiated_interaction_count: user.user_initiated_interaction_count,
      code_generation_activity_count:   gen,
      code_acceptance_activity_count:   acc,
      loc_added_sum:          user.loc_added_sum,
      premium_requests_total: user.premium_requests_total ?? 0,
      acceptance_rate: calcAcceptanceRate(gen, acc),
    });
  }

  return series;
}

/**
 * Return aggregated user-metrics statistics for every stored snapshot,
 * ordered by report_end_day ascending.
 * Stats (totals, acceptance rate) are computed in TypeScript for compatibility.
 */
export async function getUserMetricsHistory(
  scope: string,
  scopeIdentifier: string
): Promise<UserMetricsHistoryEntry[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT report_start_day, report_end_day, user_totals
     FROM user_metrics
     WHERE scope = $1 AND identifier = $2
     ORDER BY report_end_day ASC`,
    [scope, scopeIdentifier]
  );

  return rows.map(row => {
    const totals: UserTotals[] = row.user_totals;
    const total_gen = totals.reduce((s, u) => s + u.code_generation_activity_count, 0);
    const total_acc = totals.reduce((s, u) => s + u.code_acceptance_activity_count, 0);

    return {
      report_start_day: new Date(row.report_start_day).toISOString().slice(0, 10),
      report_end_day:   new Date(row.report_end_day).toISOString().slice(0, 10),
      total_users:      totals.length,
      active_users:     totals.filter(u => u.total_active_days >= 7).length,
      total_premium_requests: totals.reduce((s, u) => s + (u.premium_requests_total ?? 0), 0),
      avg_acceptance_rate: calcAcceptanceRate(total_gen, total_acc),
    };
  });
}
