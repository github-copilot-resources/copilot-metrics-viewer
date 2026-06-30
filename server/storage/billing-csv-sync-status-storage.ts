/**
 * Storage helpers for billing_csv_sync_status — audit + state for billing
 * CSV export jobs.
 *
 * Single-flight is enforced at the DB layer by a partial unique index on
 * (enterprise) WHERE status IN ('queued','processing','downloading','upserting'),
 * which matches GitHub's own enterprise-wide single-flight rule (verified A.0
 * probe — concurrent POST /reports returns 409).
 */

import { getPool } from './db';

export type BillingCsvJobStatus =
  | 'queued'
  | 'processing'
  | 'downloading'
  | 'upserting'
  | 'completed'
  | 'failed'
  | 'cancelled';

const IN_FLIGHT_STATUSES: ReadonlySet<BillingCsvJobStatus> = new Set([
  'queued', 'processing', 'downloading', 'upserting',
]);

export interface BillingCsvJob {
  id: number;
  enterprise: string;
  startDate: string;            // YYYY-MM-DD
  endDate: string;              // YYYY-MM-DD
  githubJobId: string | null;
  status: BillingCsvJobStatus;
  rowsIngested: number;
  downloadUrlCount: number;
  errorMessage: string | null;
  triggeredBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /**
   * Sub-ranges this job actually requested from GitHub. With gap-mode, this
   * is a strict subset of [startDate, endDate]; without it, equals the full
   * window. NULL on jobs that ran before v3.13 added the column.
   */
  chunksFetched: Array<{ start: string; end: string }> | null;
  /**
   * Sub-ranges within [startDate, endDate] that gap-mode determined were
   * already covered by an earlier completed job, and therefore were NOT
   * re-fetched. NULL on jobs that ran before v3.13 added the column, and
   * always [] for jobs that ran without fillGapsOnly.
   */
  gapsSkipped: Array<{ start: string; end: string }> | null;
}

/**
 * Thrown when the partial-unique-index trips because another job is in
 * flight for this enterprise. The API handler should translate this into a
 * 409 Conflict response.
 */
export class BillingCsvJobInFlightError extends Error {
  constructor(enterprise: string) {
    super(`A billing CSV export job is already in flight for enterprise ${enterprise}`);
    this.name = 'BillingCsvJobInFlightError';
  }
}

interface CreateJobInput {
  enterprise: string;
  startDate: string;
  endDate: string;
  triggeredBy: string;
}

/**
 * Insert a new job in 'queued' state. Throws BillingCsvJobInFlightError if
 * another job is already in flight for this enterprise (partial unique
 * index violation — Postgres error code 23505).
 */
export async function createBillingCsvJob(input: CreateJobInput): Promise<BillingCsvJob> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `INSERT INTO billing_csv_sync_status
         (enterprise, start_date, end_date, status, triggered_by)
       VALUES ($1, $2, $3, 'queued', $4)
       RETURNING *`,
      [input.enterprise, input.startDate, input.endDate, input.triggeredBy],
    );
    return rowToJob(rows[0]);
  } catch (err) {
    // Postgres unique_violation = 23505. Both the partial-unique-index and
    // (theoretically) the PK could trip — only the partial index matters here.
    if (isUniqueViolation(err)) {
      throw new BillingCsvJobInFlightError(input.enterprise);
    }
    throw err;
  }
}

export interface UpdateJobInput {
  status?: BillingCsvJobStatus;
  githubJobId?: string | null;
  rowsIngested?: number;
  downloadUrlCount?: number;
  errorMessage?: string | null;
  completedAt?: Date | null;
  chunksFetched?: Array<{ start: string; end: string }> | null;
  gapsSkipped?: Array<{ start: string; end: string }> | null;
}

/** Patch the mutable fields of a job. Always bumps updated_at. */
export async function updateBillingCsvJob(id: number, patch: UpdateJobInput): Promise<void> {
  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];

  if (patch.status !== undefined)            { params.push(patch.status);              sets.push(`status = $${params.length}`); }
  if (patch.githubJobId !== undefined)       { params.push(patch.githubJobId);         sets.push(`github_job_id = $${params.length}`); }
  if (patch.rowsIngested !== undefined)      { params.push(patch.rowsIngested);        sets.push(`rows_ingested = $${params.length}`); }
  if (patch.downloadUrlCount !== undefined)  { params.push(patch.downloadUrlCount);    sets.push(`download_url_count = $${params.length}`); }
  if (patch.errorMessage !== undefined)      { params.push(patch.errorMessage);        sets.push(`error_message = $${params.length}`); }
  if (patch.completedAt !== undefined)       { params.push(patch.completedAt);         sets.push(`completed_at = $${params.length}`); }
  if (patch.chunksFetched !== undefined)     { params.push(JSON.stringify(patch.chunksFetched)); sets.push(`chunks_fetched = $${params.length}::jsonb`); }
  if (patch.gapsSkipped !== undefined)       { params.push(JSON.stringify(patch.gapsSkipped));   sets.push(`gaps_skipped = $${params.length}::jsonb`); }

  params.push(id);
  const pool = getPool();
  await pool.query(
    `UPDATE billing_csv_sync_status SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params,
  );
}

/** Get a single job by id, or null if not found. */
export async function getBillingCsvJob(id: number): Promise<BillingCsvJob | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM billing_csv_sync_status WHERE id = $1`,
    [id],
  );
  return rows.length === 0 ? null : rowToJob(rows[0]);
}

/** Current in-flight job for this enterprise, or null. */
export async function getInFlightBillingCsvJob(enterprise: string): Promise<BillingCsvJob | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM billing_csv_sync_status
     WHERE enterprise = $1
       AND status IN ('queued','processing','downloading','upserting')
     ORDER BY created_at DESC
     LIMIT 1`,
    [enterprise],
  );
  return rows.length === 0 ? null : rowToJob(rows[0]);
}

/** Most recent N jobs (any status) for this enterprise. Excludes soft-dismissed rows. */
export async function listRecentBillingCsvJobs(
  enterprise: string,
  limit = 10,
): Promise<BillingCsvJob[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM billing_csv_sync_status
     WHERE enterprise = $1
       AND dismissed_at IS NULL
     ORDER BY created_at DESC
     LIMIT $2`,
    [enterprise, limit],
  );
  return rows.map(rowToJob);
}

/**
 * Soft-dismiss a job: hides it from the recent-jobs UI but keeps the row in
 * the DB so gap-mode coverage detection (which queries `status='completed'`
 * rows) continues to see it. Refuses to dismiss in-flight jobs — the user
 * should cancel those first.
 *
 * Returns true if the row was dismissed, false if the job was not found OR
 * was in-flight OR was already dismissed (caller can treat those as no-ops).
 */
export async function dismissBillingCsvJob(id: number): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE billing_csv_sync_status
     SET dismissed_at = NOW(), updated_at = NOW()
     WHERE id = $1
       AND status NOT IN ('queued','processing','downloading','upserting')
       AND dismissed_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Mark all in-flight jobs for an enterprise as 'cancelled'. Used by the
 * sync-billing-csv-cancel admin action. Returns the count of cancelled rows.
 *
 * Does NOT cancel anything on GitHub's side — the export job continues to run
 * upstream. This only clears the DB lock so the next POST can proceed.
 */
export async function cancelInFlightBillingCsvJobs(enterprise: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE billing_csv_sync_status
     SET status = 'cancelled',
         error_message = COALESCE(error_message, 'Cancelled by admin'),
         updated_at = NOW(),
         completed_at = NOW()
     WHERE enterprise = $1
       AND status IN ('queued','processing','downloading','upserting')`,
    [enterprise],
  );
  return result.rowCount ?? 0;
}

function rowToJob(row: Record<string, unknown>): BillingCsvJob {
  return {
    id: row.id as number,
    enterprise: row.enterprise as string,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    githubJobId: (row.github_job_id as string | null) ?? null,
    status: row.status as BillingCsvJobStatus,
    rowsIngested: (row.rows_ingested as number) ?? 0,
    downloadUrlCount: (row.download_url_count as number) ?? 0,
    errorMessage: (row.error_message as string | null) ?? null,
    triggeredBy: (row.triggered_by as string | null) ?? null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    completedAt: row.completed_at ? toIsoString(row.completed_at) : null,
    chunksFetched: parseRanges(row.chunks_fetched),
    gapsSkipped: parseRanges(row.gaps_skipped),
  };
}

function parseRanges(v: unknown): Array<{ start: string; end: string }> | null {
  if (v == null) return null;
  // pg returns JSONB as parsed JS values when oid types are configured; some
  // drivers return strings. Handle both.
  const parsed = typeof v === 'string' ? safeJsonParse(v) : v;
  if (!Array.isArray(parsed)) return null;
  return parsed.filter((r): r is { start: string; end: string } =>
    !!r && typeof r === 'object' && typeof (r as { start: unknown }).start === 'string'
        && typeof (r as { end: unknown }).end === 'string',
  );
}

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function toIsoString(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function isUniqueViolation(err: unknown): boolean {
  return !!(err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505');
}

// Test helper — also exports the in-flight status set so tests can assert
// the same authoritative list of states.
export { IN_FLIGHT_STATUSES };
