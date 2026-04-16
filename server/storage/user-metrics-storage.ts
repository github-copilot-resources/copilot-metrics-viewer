/**
 * User Metrics storage — backed entirely by the `user_day_metrics` table.
 *
 * There is no longer a separate `user_metrics` period-aggregate table.
 * All analytics (latest snapshot, historical trends, per-user time series)
 * are derived on-the-fly from the per-day per-user records that are written
 * by `saveUserDayMetricsBatch` during the daily sync.
 *
 * Windowing strategy for history / time series:
 *   Records are grouped by calendar month so that charts show one data point
 *   per month regardless of how many days of activity were stored.
 */

import type { UserDayRecord, UserTotals } from '../services/github-copilot-usage-api';
import { aggregateUserDayRecords } from '../services/github-copilot-usage-api';
import { baseScope } from './user-day-metrics-storage';
import { getPool } from './db';

/**
 * Aggregated user-metrics statistics for one stored window (calendar month).
 */
export interface UserMetricsHistoryEntry {
  report_start_day: string;
  report_end_day: string;
  total_users: number;
  active_users: number;
  avg_acceptance_rate: number;
}

/**
 * One data point in a single user's time series (one per calendar month).
 */
export interface UserTimeSeriesEntry {
  report_end_day: string;
  total_active_days: number;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_added_sum: number;
  acceptance_rate: number;
}

/**
 * Compute acceptance rate as a percentage (0–100), rounded to one decimal place.
 */
function calcAcceptanceRate(generated: number, accepted: number): number {
  return generated > 0 ? parseFloat(((accepted / generated) * 100).toFixed(1)) : 0;
}

/** Number of days in the "latest" user metrics window (inclusive). */
const LATEST_WINDOW_DAYS = 28;

/**
 * Get the latest user metrics by aggregating all records in the most recent
 * 28-day window stored in user_day_metrics.
 */
export async function getLatestUserMetrics(
  scope: string,
  scopeIdentifier: string
): Promise<{ reportStartDay: string; reportEndDay: string; userTotals: UserTotals[] } | null> {
  const pool = getPool();
  const normalizedScope = baseScope(scope);

  // Find the latest date stored
  const { rows: maxRows } = await pool.query(
    `SELECT MAX(metrics_date) AS max_date FROM user_day_metrics
     WHERE scope = $1 AND identifier = $2`,
    [normalizedScope, scopeIdentifier]
  );
  if (!maxRows[0].max_date) return null;

  const maxDate = new Date(maxRows[0].max_date).toISOString().slice(0, 10);
  // LATEST_WINDOW_DAYS - 1 prior days plus the max date itself = 28-day inclusive window
  const minDate = new Date(new Date(maxDate).getTime() - (LATEST_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const { rows } = await pool.query(
    `SELECT data FROM user_day_metrics
     WHERE scope = $1 AND identifier = $2
       AND metrics_date BETWEEN $3 AND $4`,
    [normalizedScope, scopeIdentifier, minDate, maxDate]
  );
  if (rows.length === 0) return null;

  const records: UserDayRecord[] = rows.map(r => r.data);
  return {
    reportStartDay: minDate,
    reportEndDay: maxDate,
    userTotals: aggregateUserDayRecords(records),
  };
}

/**
 * Return aggregated user-metrics statistics for every calendar-month window
 * that has stored records, ordered by window end date ascending.
 */
export async function getUserMetricsHistory(
  scope: string,
  scopeIdentifier: string
): Promise<UserMetricsHistoryEntry[]> {
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  const { rows } = await pool.query(
    `SELECT data, metrics_date FROM user_day_metrics
     WHERE scope = $1 AND identifier = $2
     ORDER BY metrics_date ASC`,
    [normalizedScope, scopeIdentifier]
  );
  if (rows.length === 0) return [];

  // Group by calendar month (YYYY-MM)
  const byMonth = new Map<string, UserDayRecord[]>();
  for (const row of rows) {
    const date = new Date(row.metrics_date).toISOString().slice(0, 10);
    const month = date.slice(0, 7);
    const existing = byMonth.get(month) ?? [];
    existing.push(row.data as UserDayRecord);
    byMonth.set(month, existing);
  }

  const result: UserMetricsHistoryEntry[] = [];
  for (const [, monthRecords] of byMonth) {
    const dates = monthRecords.map(r => r.day).sort();
    const totals = aggregateUserDayRecords(monthRecords);
    const totalGen = totals.reduce((s, u) => s + u.code_generation_activity_count, 0);
    const totalAcc = totals.reduce((s, u) => s + u.code_acceptance_activity_count, 0);

    result.push({
      report_start_day: dates[0],
      report_end_day: dates[dates.length - 1],
      total_users: totals.length,
      // A user is "active" if they appear in any stored record for this month.
      // (The original 7-day threshold was designed for a fixed 28-day window;
      // in monthly grouping every stored record represents at least one active day.)
      active_users: totals.filter(u => u.total_active_days >= 1).length,
      avg_acceptance_rate: calcAcceptanceRate(totalGen, totalAcc),
    });
  }

  return result.sort((a, b) => a.report_end_day.localeCompare(b.report_end_day));
}

/**
 * Return the per-month stats for a single user, ordered by window end date ascending.
 * Only months where the user has at least one record are included.
 */
export async function getUserTimeSeries(
  scope: string,
  scopeIdentifier: string,
  login: string
): Promise<UserTimeSeriesEntry[]> {
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  const { rows } = await pool.query(
    `SELECT data, metrics_date FROM user_day_metrics
     WHERE scope = $1 AND identifier = $2 AND user_login = $3
     ORDER BY metrics_date ASC`,
    [normalizedScope, scopeIdentifier, login]
  );
  if (rows.length === 0) return [];

  // Group by calendar month (YYYY-MM)
  const byMonth = new Map<string, { records: UserDayRecord[]; dates: string[] }>();
  for (const row of rows) {
    const date = new Date(row.metrics_date).toISOString().slice(0, 10);
    const month = date.slice(0, 7);
    const existing = byMonth.get(month) ?? { records: [], dates: [] };
    existing.records.push(row.data as UserDayRecord);
    existing.dates.push(date);
    byMonth.set(month, existing);
  }

  const series: UserTimeSeriesEntry[] = [];
  for (const [, { records, dates }] of byMonth) {
    const totals = aggregateUserDayRecords(records);
    const user = totals.find(u => u.login === login);
    if (!user) continue;

    const gen = user.code_generation_activity_count;
    const acc = user.code_acceptance_activity_count;

    series.push({
      report_end_day: dates[dates.length - 1],
      total_active_days: user.total_active_days,
      user_initiated_interaction_count: user.user_initiated_interaction_count,
      code_generation_activity_count: gen,
      code_acceptance_activity_count: acc,
      loc_added_sum: user.loc_added_sum,
      acceptance_rate: calcAcceptanceRate(gen, acc),
    });
  }

  return series.sort((a, b) => a.report_end_day.localeCompare(b.report_end_day));
}
