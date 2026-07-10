/**
 * Phase B reader — serve aggregated billing data from the `billing_credit_usage`
 * table written by the Phase A CSV ingester.
 *
 * Two responsibilities:
 *
 *  1. `decideSource(enterprise, windowStart, windowEnd)` — should the caller
 *     read from DB or fall back to GitHub's live JSON? The answer is `db` if
 *     and only if there exists a most-recent `status='completed'`
 *     `billing_csv_sync_status` row whose `[start_date, end_date]` window is
 *     a SUPERSET of the requested window. Otherwise → `live`.
 *
 *     This is **job-based**, not row-presence-based. An ingested window may
 *     legitimately have zero rows (no billable activity), and we must not
 *     mistake that for "missing data" and re-fetch live (which would just
 *     return the same zero rows but with a slow request).
 *
 *  2. `aggregateForBilling(...)` / `aggregateForBillingByUser(...)` — return
 *     a `BillingCreditsResponse` whose envelope is byte-identical to what
 *     GitHub's JSON endpoint returns, so the existing handlers and the
 *     frontend can branch on the source without reshaping data.
 *
 * Quantity-derivation note: GitHub's JSON exposes BOTH `discountQuantity`
 * and `netQuantity`; our CSV ingest only stores `quantity` (= grossQuantity),
 * `gross_amount`, `discount_amount`, `net_amount`, and the per-row
 * `applied_cost_per_quantity`. We derive the missing quantities by scaling
 * gross quantity by the amount ratios — this is exact when pricing is
 * linear (always true for AI credit SKUs as of 2026-06).
 */

import { getPool } from '../storage/db';
import type { BillingCreditsResponse, BillingUsageItem } from '../api/billing-credits.get';

export interface CoverageDecision {
  source: 'db' | 'live';
  /** Human-readable explanation, suitable for the X-Data-Source-Reason header. */
  reason: string;
  /** ISO timestamp of the most recent completed job covering the window, or null. */
  lastIngestAt: string | null;
  /** The job id whose window was used, or null when no covering job exists. */
  jobId: number | null;
}

/**
 * Window descriptor. All dates are inclusive YYYY-MM-DD strings (the same
 * shape stored in `billing_credit_usage.date` and `billing_csv_sync_status`).
 *
 * `timePeriod` is the partially-specified shape the caller passed in (e.g.
 * `{year: 2026, month: 6}` for an entire month) — preserved verbatim because
 * GitHub echoes it back unchanged on the JSON response and our DB-mode reply
 * must do the same so the frontend's "Showing billing usage for X" banner
 * keeps working without source-aware branching.
 */
export interface BillingWindow {
  startDate: string;
  endDate: string;
  timePeriod: { year?: number; month?: number; day?: number };
}

export interface AggregateFilters {
  user?: string;
  organization?: string;
  repository?: string;
  sku?: string;
  model?: string;
}

/**
 * Resolve `?year=&month=&day=` OR `?since=&until=` query params into an
 * inclusive date window. Mirrors how GitHub's billing endpoint interprets
 * partial specifications:
 *   - since+until      → arbitrary range (DB-only; live API can't serve it)
 *   - year+month+day   → that one day
 *   - year+month       → entire calendar month
 *   - year             → entire calendar year
 *   - none             → current calendar month (server "today" in UTC)
 *
 * `since/until` takes priority over year/month/day when both are supplied.
 * When since/until is used, `timePeriod` is returned empty so the client
 * knows the window is a custom range (not one of GitHub's standard buckets).
 *
 * Throws on invalid input (out-of-range month/day, malformed ISO dates,
 * since > until) so the handler surfaces a clean 400.
 */
export function resolveWindow(input: {
  year?: number;
  month?: number;
  day?: number;
  since?: string;
  until?: string;
}): BillingWindow {
  // Custom range takes precedence — used by the Billing tab's global
  // date-range picker (Month view unchecked). DB path only.
  if (input.since || input.until) {
    if (!input.since || !input.until) {
      throw new Error('Both `since` and `until` must be provided together');
    }
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(input.since) || !iso.test(input.until)) {
      throw new Error('Invalid since/until — must be YYYY-MM-DD');
    }
    if (input.since > input.until) {
      throw new Error(`since (${input.since}) must be <= until (${input.until})`);
    }
    return { startDate: input.since, endDate: input.until, timePeriod: {} };
  }

  const now = new Date();
  const y = input.year ?? now.getUTCFullYear();
  const m = input.month ?? (input.year ? undefined : now.getUTCMonth() + 1);
  const d = input.day;

  if (m !== undefined && (m < 1 || m > 12)) {
    throw new Error(`Invalid month: ${m}`);
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  if (d !== undefined) {
    if (m === undefined) throw new Error('Cannot specify day without month');
    if (d < 1 || d > 31) throw new Error(`Invalid day: ${d}`);
    const date = `${y}-${pad(m)}-${pad(d)}`;
    return { startDate: date, endDate: date, timePeriod: { year: y, month: m, day: d } };
  }

  if (m !== undefined) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day-0 of next month = last day of this month
    return {
      startDate: `${y}-${pad(m)}-01`,
      endDate: `${y}-${pad(m)}-${pad(last)}`,
      timePeriod: { year: y, month: m },
    };
  }

  return {
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
    timePeriod: { year: y },
  };
}

/**
 * Decide whether the requested window can be served from the DB.
 *
 * Rule: the most recent `status='completed'` job for this enterprise must
 * cover the entire window (start_date ≤ windowStart AND end_date ≥
 * windowEnd). If multiple jobs match, prefer the most recently completed
 * (i.e. freshest data). Partial overlaps fall back to `live` — we don't
 * splice DB + live responses (would double-count rows in the overlap).
 *
 * Returns `{source:'live'}` when `getPool()` throws (JSON mode, no DB
 * configured) — caller never needs to wrap this in try/catch.
 */
export async function decideSource(
  enterprise: string,
  windowStart: string,
  windowEnd: string,
): Promise<CoverageDecision> {
  if (!enterprise) {
    return { source: 'live', reason: 'no enterprise scope', lastIngestAt: null, jobId: null };
  }

  let pool;
  try {
    pool = getPool();
  } catch {
    return { source: 'live', reason: 'database not configured', lastIngestAt: null, jobId: null };
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, completed_at
         FROM billing_csv_sync_status
        WHERE enterprise = $1
          AND status = 'completed'
          AND start_date <= $2::date
          AND end_date   >= $3::date
        ORDER BY completed_at DESC NULLS LAST
        LIMIT 1`,
      [enterprise, windowStart, windowEnd],
    );
    const row = rows[0];
    if (!row) {
      return {
        source: 'live',
        reason: `no completed ingest job covers ${windowStart}..${windowEnd}`,
        lastIngestAt: null,
        jobId: null,
      };
    }
    const completedAt: Date | null = row.completed_at ?? null;
    return {
      source: 'db',
      reason: `covered by job #${row.id} completed ${completedAt?.toISOString?.() ?? 'unknown'}`,
      lastIngestAt: completedAt instanceof Date ? completedAt.toISOString() : (completedAt ?? null),
      jobId: row.id,
    };
  } catch (e) {
    // DB query failure — be defensive: fall back to live rather than 500.
    return {
      source: 'live',
      reason: `coverage query failed: ${e instanceof Error ? e.message : String(e)}`,
      lastIngestAt: null,
      jobId: null,
    };
  }
}

/**
 * Aggregate billing rows for the given window into a `BillingCreditsResponse`
 * envelope. Group key matches GitHub's JSON line-item shape:
 *   (product, sku, model, unit_type)
 *
 * Filters are AND-ed. The `enterprise` field on the response is always set
 * (since DB mode only operates on enterprise-scoped ingests); `organization`
 * is filled only when a `?organization=` filter narrowed the result.
 */
export async function aggregateForBilling(
  enterprise: string,
  window: BillingWindow,
  filters: AggregateFilters = {},
): Promise<BillingCreditsResponse> {
  const pool = getPool();

  const conds: string[] = ['enterprise = $1', 'date BETWEEN $2::date AND $3::date'];
  const params: unknown[] = [enterprise, window.startDate, window.endDate];
  const push = (col: string, val: string | undefined) => {
    if (val === undefined || val === '') return;
    params.push(val);
    conds.push(`${col} = $${params.length}`);
  };
  push('username', filters.user);
  push('organization', filters.organization);
  push('repository', filters.repository);
  push('sku', filters.sku);
  push('model', filters.model);

  const sql = `
    SELECT
      product,
      sku,
      model,
      unit_type,
      MAX(applied_cost_per_quantity)::float8 AS price_per_unit,
      SUM(quantity)::float8        AS gross_quantity,
      SUM(gross_amount)::float8    AS gross_amount,
      SUM(discount_amount)::float8 AS discount_amount,
      SUM(net_amount)::float8      AS net_amount
    FROM billing_credit_usage
    WHERE ${conds.join(' AND ')}
    GROUP BY product, sku, model, unit_type
    ORDER BY product, sku, model
  `;

  const { rows } = await pool.query(sql, params);
  const usageItems: BillingUsageItem[] = rows.map(mapAggregateRowToItem);

  return {
    timePeriod: window.timePeriod,
    enterprise,
    ...(filters.organization ? { organization: filters.organization } : {}),
    ...(filters.user ? { user: filters.user } : {}),
    usageItems,
  };
}

/**
 * Per-user aggregate. Adds `username` to the group key and tags each row
 * with the originating `user`. Used by `/api/billing-credits-by-user` to
 * replace the existing N-call fan-out with a single DB query.
 *
 * `logins` filter is REQUIRED — the by-user endpoint enforces it upstream
 * and we want the same contract here (full-table scans across all users
 * could be large on enterprise-scale deployments).
 */
export async function aggregateForBillingByUser(
  enterprise: string,
  window: BillingWindow,
  logins: string[],
  filters: AggregateFilters = {},
): Promise<BillingCreditsResponse> {
  if (logins.length === 0) {
    return { timePeriod: window.timePeriod, enterprise, usageItems: [] };
  }

  const pool = getPool();

  const conds: string[] = [
    'enterprise = $1',
    'date BETWEEN $2::date AND $3::date',
    `LOWER(username) = ANY($4::text[])`,
  ];
  const params: unknown[] = [
    enterprise,
    window.startDate,
    window.endDate,
    logins.map(l => l.toLowerCase()),
  ];
  const push = (col: string, val: string | undefined) => {
    if (val === undefined || val === '') return;
    params.push(val);
    conds.push(`${col} = $${params.length}`);
  };
  push('organization', filters.organization);
  push('repository', filters.repository);
  push('sku', filters.sku);
  push('model', filters.model);

  const sql = `
    SELECT
      username,
      product,
      sku,
      model,
      unit_type,
      MAX(applied_cost_per_quantity)::float8 AS price_per_unit,
      SUM(quantity)::float8        AS gross_quantity,
      SUM(gross_amount)::float8    AS gross_amount,
      SUM(discount_amount)::float8 AS discount_amount,
      SUM(net_amount)::float8      AS net_amount
    FROM billing_credit_usage
    WHERE ${conds.join(' AND ')}
    GROUP BY username, product, sku, model, unit_type
    ORDER BY username, product, sku, model
  `;

  const { rows } = await pool.query(sql, params);
  const usageItems: BillingUsageItem[] = rows.map(r => ({
    ...mapAggregateRowToItem(r),
    user: r.username || undefined,
  }));

  return {
    timePeriod: window.timePeriod,
    enterprise,
    usageItems,
  };
}

/**
 * Shared row-shape projection. Centralized so both the aggregate and
 * per-user paths derive `discountQuantity` / `netQuantity` identically.
 *
 * Quantity derivation: scale gross quantity by the (discount|net) /
 * gross-amount ratio. When grossAmount is 0 (free-tier rows), the ratio
 * is undefined; we degrade to "all quantity is net, zero discount" which
 * matches GitHub's JSON behavior on free-tier line items.
 */
interface AggregateRow {
  product: string;
  sku: string;
  model: string;
  unit_type: string;
  price_per_unit: number;
  gross_quantity: number;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
}

/**
 * Find ingest gaps within the requested window.
 *
 * Given a requested `[start, end]` and the set of completed
 * `billing_csv_sync_status` jobs whose windows intersect it, returns the
 * sub-ranges that are NOT yet covered. The caller (admin sync action) uses
 * this to only ask GitHub for CSVs over the missing days — much faster than
 * re-ingesting weeks of already-stored data, and avoids GitHub's per-job
 * generation cost for chunks we already have.
 *
 * Example:
 *   Requested:        2026-04-01..2026-06-29
 *   Existing jobs:    [2026-05-01..2026-06-27]
 *   Returned gaps:    [{start: 2026-04-01, end: 2026-04-30},
 *                      {start: 2026-06-28, end: 2026-06-29}]
 *
 * If the entire window is already covered, returns an empty array.
 * If no completed jobs exist, returns the entire window as a single gap.
 *
 * The pure shape-merging logic is extracted into `subtractRanges()` so it
 * can be unit-tested without a database.
 */
export async function findBillingCsvGaps(
  enterprise: string,
  windowStart: string,
  windowEnd: string,
): Promise<Array<{ start: string; end: string }>> {
  if (!enterprise) {
    return [{ start: windowStart, end: windowEnd }];
  }

  let pool;
  try {
    pool = getPool();
  } catch {
    // No DB → assume nothing is ingested → entire window is a gap.
    return [{ start: windowStart, end: windowEnd }];
  }

  try {
    const { rows } = await pool.query(
      `SELECT start_date, end_date
         FROM billing_csv_sync_status
        WHERE enterprise = $1
          AND status = 'completed'
          AND start_date <= $3::date
          AND end_date   >= $2::date`,
      [enterprise, windowStart, windowEnd],
    );
    const existing = rows.map((r: { start_date: Date | string; end_date: Date | string }) => ({
      start: toIsoDate(r.start_date),
      end: toIsoDate(r.end_date),
    }));
    return subtractRanges({ start: windowStart, end: windowEnd }, existing);
  } catch {
    // Be defensive: on any DB error, return the full window so the ingester
    // falls back to the legacy "fetch everything" behavior.
    return [{ start: windowStart, end: windowEnd }];
  }
}

/**
 * Pure shape: given a requested `[start, end]` window and a list of
 * already-covered ranges, return the sub-ranges of the window that aren't
 * covered by ANY existing range.
 *
 * Algorithm:
 *   1. Clip every existing range to the window (drop the parts outside it).
 *   2. Sort by start, merge overlaps.
 *   3. Walk the merged ranges, emitting the gaps between them.
 *
 * All dates are inclusive YYYY-MM-DD. "Adjacent" ranges (end of one =
 * start - 1 day of next) merge into one — there's no point creating a
 * one-day fetch between two abutting completed windows.
 */
export function subtractRanges(
  window: { start: string; end: string },
  covered: Array<{ start: string; end: string }>,
): Array<{ start: string; end: string }> {
  if (window.start > window.end) return [];

  const clipped = covered
    .map(r => ({
      start: r.start < window.start ? window.start : r.start,
      end: r.end > window.end ? window.end : r.end,
    }))
    .filter(r => r.start <= r.end)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  // Merge overlapping/adjacent ranges
  const merged: Array<{ start: string; end: string }> = [];
  for (const r of clipped) {
    const last = merged[merged.length - 1];
    if (last && r.start <= addDays(last.end, 1)) {
      if (r.end > last.end) last.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }

  const gaps: Array<{ start: string; end: string }> = [];
  let cursor = window.start;
  for (const r of merged) {
    if (cursor < r.start) {
      gaps.push({ start: cursor, end: addDays(r.start, -1) });
    }
    cursor = addDays(r.end, 1);
  }
  if (cursor <= window.end) {
    gaps.push({ start: cursor, end: window.end });
  }

  return gaps;
}

function toIsoDate(d: Date | string): string {
  if (typeof d === 'string') return d.length >= 10 ? d.slice(0, 10) : d;
  // pg returns DATE as a JS Date in local TZ — extract calendar parts in UTC
  // to match how dates were originally written (the ingester stores them as
  // calendar strings; pg parses on read).
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  // Treat the input as a calendar date in UTC to avoid DST/local-TZ drift.
  const parts = iso.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0]!, (parts[1]! - 1), parts[2]!));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mapAggregateRowToItem(r: AggregateRow): BillingUsageItem {
  const grossQuantity = Number(r.gross_quantity) || 0;
  const grossAmount = Number(r.gross_amount) || 0;
  const discountAmount = Number(r.discount_amount) || 0;
  const netAmount = Number(r.net_amount) || 0;

  let discountQuantity = 0;
  let netQuantity = grossQuantity;
  if (grossAmount > 0) {
    const ratio = discountAmount / grossAmount;
    discountQuantity = grossQuantity * ratio;
    netQuantity = grossQuantity - discountQuantity;
  }

  return {
    product: r.product || '',
    sku: r.sku || '',
    model: r.model || '',
    unitType: r.unit_type || '',
    pricePerUnit: Number(r.price_per_unit) || 0,
    grossQuantity,
    grossAmount,
    discountQuantity,
    discountAmount,
    netQuantity,
    netAmount,
  };
}
