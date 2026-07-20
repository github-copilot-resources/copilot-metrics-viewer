/**
 * Data-range API endpoint
 * GET /api/data-range
 *
 * Returns the date range for which Copilot metrics data is available, so the
 * frontend date picker can be clamped accordingly.
 *
 * Behavior by mode:
 *   - Mock mode: returns the min/max `day` across the bundled mock JSON files.
 *   - Historical mode: returns MIN/MAX(metrics_date) across `metrics` and
 *     `user_day_metrics` for the requested scope/identifier. Falls back to the
 *     live window when the storage is empty or unreachable.
 *   - Live mode: returns a rolling 28-day window ending yesterday (the GitHub
 *     metrics API has roughly a 1-day lag, so today is not yet available).
 */

import { Options } from '@/model/Options';
import { baseScope } from '../storage/user-day-metrics-storage';
import { getPool } from '../storage/db';
import { yesterdayIso, liveWindow, mockRange as buildMockRange } from '../utils/data-range-utils';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockOrgMetrics from '../../public/mock-data/new-api/organization-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockEntMetrics from '../../public/mock-data/new-api/enterprise-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockOrgUsers from '../../public/mock-data/new-api/organization-users-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockEntUsers from '../../public/mock-data/new-api/enterprise-users-28-day-report.json';

export interface DataRange {
  /** ISO 8601 YYYY-MM-DD — earliest day with data (inclusive). */
  earliest: string;
  /** ISO 8601 YYYY-MM-DD — latest day with data (inclusive). */
  latest: string;
  /** Which mode produced this range. */
  mode: 'mock' | 'historical' | 'live';
}

async function historicalRange(
  scope: string,
  identifier: string
): Promise<{ earliest: string; latest: string } | null> {
  if (!identifier) return null;
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  // Union of metrics (aggregated daily) and user_day_metrics (per-user daily)
  const { rows } = await pool.query(
    `SELECT
       LEAST(
         (SELECT MIN(metrics_date) FROM metrics
          WHERE scope = $1 AND identifier = $2),
         (SELECT MIN(metrics_date) FROM user_day_metrics
          WHERE scope = $1 AND identifier = $2)
       ) AS earliest,
       GREATEST(
         (SELECT MAX(metrics_date) FROM metrics
          WHERE scope = $1 AND identifier = $2),
         (SELECT MAX(metrics_date) FROM user_day_metrics
          WHERE scope = $1 AND identifier = $2)
       ) AS latest`,
    [normalizedScope, identifier]
  );
  const row = rows[0];
  if (!row?.earliest || !row?.latest) return null;
  return {
    earliest: new Date(row.earliest).toISOString().slice(0, 10),
    latest: new Date(row.latest).toISOString().slice(0, 10),
  };
}

export default defineEventHandler(async (event): Promise<DataRange> => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  const scope = options.scope || 'organization';
  const identifier = options.githubOrg || options.githubEnt || '';

  if (options.isDataMocked) {
    return { ...buildMockRange(scope, mockOrgMetrics, mockEntMetrics, mockOrgUsers, mockEntUsers), mode: 'mock' };
  }

  // Whenever the DB is reachable and has data for this scope, use it.
  // We don't gate this on DATABASE_URL — writes happen via the
  // sync pipeline regardless of the mode label.
  try {
    const stored = await historicalRange(scope, identifier);
    if (stored) {
      // Bug #412: the sync container ingests once/day, so MAX(metrics_date)
      // can lag 1–2 days behind the calendar. Meanwhile the billing tile on
      // My Usage pulls live from GitHub and already shows yesterday's spend.
      // Widen `latest` to at least yesterday so the date picker doesn't
      // block users from selecting a day that the billing endpoint (and the
      // live-API fallback in my-usage / metrics handlers) will happily serve.
      const widenedLatest = stored.latest < yesterdayIso() ? yesterdayIso() : stored.latest;
      return { earliest: stored.earliest, latest: widenedLatest, mode: 'historical' };
    }
    logger.info('[data-range] No stored data yet, falling back to live window');
  } catch (err) {
    logger.warn('[data-range] Storage lookup failed, falling back to live window:', err);
  }

  return { ...liveWindow(), mode: 'live' };
});
