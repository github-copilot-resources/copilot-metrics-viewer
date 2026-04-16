/**
 * Per-day per-user metrics storage backed by PostgreSQL.
 *
 * Each row represents one GitHub user's Copilot activity for a single day.
 * Records are always written at the org/enterprise scope level so a single
 * daily sync covers all teams in the org.
 *
 * This enables time-series team queries for any arbitrary date range,
 * far beyond the GitHub API's 28-day rolling window.
 */

import type { UserDayRecord } from '../services/github-copilot-usage-api';
import { getPool } from './db';

/**
 * Normalize a scope to its base type (strip 'team-' prefix).
 * Per-day records are always stored at the org/enterprise level.
 */
export function baseScope(scope: string): string {
  if (scope === 'team-organization') return 'organization';
  if (scope === 'team-enterprise') return 'enterprise';
  return scope;
}

/** Number of columns in a single user_day_metrics INSERT row. */
const USER_DAY_METRICS_COLUMNS = 6;

/**
 * Maximum rows per single INSERT statement.
 * 65535 / USER_DAY_METRICS_COLUMNS = 10922; keeping well below that.
 */
const MAX_ROWS_PER_INSERT = 1000;

/**
 * Save a batch of per-user daily records.
 * Upsert — safe to call multiple times for the same (user, day).
 * Internally chunked to stay within PostgreSQL's bind-parameter limit.
 */
export async function saveUserDayMetricsBatch(
  scope: string,
  identifier: string,
  records: UserDayRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const pool = getPool();
  const normalizedScope = baseScope(scope);

  // Process in chunks to avoid exceeding PostgreSQL's 65535 bind-parameter limit
  for (let offset = 0; offset < records.length; offset += MAX_ROWS_PER_INSERT) {
    const chunk = records.slice(offset, offset + MAX_ROWS_PER_INSERT);

    // Build a single multi-row INSERT: ($1,$2,$3,$4,$5,$6), ($7,$8,$9,$10,$11,$12), ...
    const values: unknown[] = [];
    const placeholders: string[] = [];
    chunk.forEach((record, i) => {
      const base = i * USER_DAY_METRICS_COLUMNS;
      placeholders.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`);
      values.push(normalizedScope, identifier, record.user_login, record.user_id ?? null, record.day, JSON.stringify(record));
    });

    await pool.query(
      `INSERT INTO user_day_metrics (scope, identifier, user_login, user_id, metrics_date, data)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (scope, identifier, user_login, metrics_date)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      values
    );
  }
}

/**
 * Retrieve all per-user daily records for a scope/identifier within a date range.
 * Ordered by user_login then date to simplify downstream aggregation.
 */
export async function getUserDayMetricsByDateRange(
  scope: string,
  identifier: string,
  startDate: string,
  endDate: string
): Promise<UserDayRecord[]> {
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  const { rows } = await pool.query(
    `SELECT data FROM user_day_metrics
     WHERE scope = $1 AND identifier = $2
       AND metrics_date BETWEEN $3 AND $4
     ORDER BY user_login ASC, metrics_date ASC`,
    [normalizedScope, identifier, startDate, endDate]
  );
  return rows.map(r => r.data);
}

/**
 * Check whether any per-day user records have been stored for a given date.
 * Used to avoid duplicate downloads during bulk sync.
 */
export async function hasUserDayMetricsForDate(
  scope: string,
  identifier: string,
  date: string
): Promise<boolean> {
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  const { rows } = await pool.query(
    `SELECT 1 FROM user_day_metrics
     WHERE scope = $1 AND identifier = $2 AND metrics_date = $3
     LIMIT 1`,
    [normalizedScope, identifier, date]
  );
  return rows.length > 0;
}
