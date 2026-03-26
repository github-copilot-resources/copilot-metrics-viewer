/**
 * Per-user metrics storage backed by PostgreSQL.
 *
 * Each row represents one GitHub user's Copilot activity for a single day.
 * Records are written at the org/enterprise scope level (never team-scoped),
 * so a single daily sync accumulates data for all users across all teams.
 * This enables time-series team queries far beyond the API's 28-day window.
 */

import type { UserDayRecord } from '../services/github-copilot-usage-api';
import { getPool } from './db';

/**
 * Normalize a scope to its base type (strip 'team-' prefix).
 * User metrics are always stored at the org/enterprise level.
 */
function baseScope(scope: string): string {
  if (scope === 'team-organization') return 'organization';
  if (scope === 'team-enterprise') return 'enterprise';
  return scope;
}

/**
 * Save a batch of per-user daily records.
 * Upsert — safe to call multiple times for the same (user, day).
 */
export async function saveUserMetricsBatch(
  scope: string,
  identifier: string,
  records: UserDayRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  for (const record of records) {
    await pool.query(
      `INSERT INTO user_metrics (scope, identifier, user_login, user_id, metrics_date, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (scope, identifier, user_login, metrics_date)
       DO UPDATE SET data = $6, updated_at = NOW()`,
      [normalizedScope, identifier, record.user_login, record.user_id ?? null, record.day, JSON.stringify(record)]
    );
  }
}

/**
 * Retrieve all per-user records for a scope/identifier within a date range.
 * Ordered by user_login then date to simplify downstream aggregation.
 */
export async function getUserMetricsByDateRange(
  scope: string,
  identifier: string,
  startDate: string,
  endDate: string
): Promise<UserDayRecord[]> {
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  const { rows } = await pool.query(
    `SELECT data FROM user_metrics
     WHERE scope = $1 AND identifier = $2
       AND metrics_date BETWEEN $3 AND $4
     ORDER BY user_login ASC, metrics_date ASC`,
    [normalizedScope, identifier, startDate, endDate]
  );
  return rows.map(r => r.data);
}

/**
 * Check whether any per-user records have been stored for a given date.
 * Used to avoid duplicate downloads during bulk sync.
 */
export async function hasUserMetricsForDate(
  scope: string,
  identifier: string,
  date: string
): Promise<boolean> {
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  const { rows } = await pool.query(
    `SELECT 1 FROM user_metrics
     WHERE scope = $1 AND identifier = $2 AND metrics_date = $3
     LIMIT 1`,
    [normalizedScope, identifier, date]
  );
  return rows.length > 0;
}
