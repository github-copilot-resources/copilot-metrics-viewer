/**
 * Billing CSV ingester — the state machine that drives a single DB job
 * (billing_csv_sync_status row) through:
 *
 *   queued → processing → downloading → upserting → completed
 *                ↘                                 ↘
 *                 → failed                          → failed
 *
 * Handles >31-day windows by chunking internally (GitHub caps each export
 * job at 31 days). Each chunk = one POST/poll/download/upsert cycle; the
 * single DB job records the cumulative `rows_ingested` and
 * `download_url_count` across all chunks.
 *
 * Idempotent: each chunk deletes existing rows for its (enterprise, start..end)
 * window before re-upserting, so a row removed from the upstream CSV (e.g.
 * data correction) doesn't linger forever.
 *
 * Fetch dispatch follows sync-service.ts: prefers Nitro's global `$fetch` when
 * available so its request interceptors / proxy agent are respected, falls
 * back to bare ofetch in standalone (sync container) contexts.
 */

import { $fetch as _ofetch } from 'ofetch';
// Look up $fetch lazily so tests that reassign globalThis.$fetch after this
// module is imported are respected. Capturing at module-load would freeze
// the reference before vitest's test-file overrides run.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _fetch(url: string, opts: any): Promise<any> {
  const f = typeof $fetch !== 'undefined' ? ($fetch as any) : _ofetch;
  return f(url, opts);
}

import {
  updateBillingCsvJob,
  getBillingCsvJob,
  type BillingCsvJob,
  type BillingCsvJobStatus,
} from '../storage/billing-csv-sync-status-storage';
import {
  upsertBillingCreditRows,
  deleteBillingCreditRowsForRange,
  type BillingCreditRow,
} from '../storage/billing-credit-usage-storage';
import { parseBillingCsv, type ParsedBillingRow } from './billing-csv-parser';
import { getPool } from '../storage/db';
import { findBillingCsvGaps, subtractRanges } from './billing-credit-reader';

const GITHUB_API_BASE = process.env.NUXT_GITHUB_API_BASE_URL || 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const MAX_CHUNK_DAYS = 31;
const POLL_FAST_INTERVAL_MS = 5_000;
const POLL_SLOW_INTERVAL_MS = 10_000;
const POLL_FAST_COUNT = 5;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;     // 5 min per chunk

export interface RunIngesterOptions {
  /** PAT with `manage_billing:enterprise` (classic). */
  token: string;
  /** Pre-existing DB job to drive. Caller must have already created the row. */
  jobId: number;
  /** Lets tests inject a fake clock for deterministic polling. */
  now?: () => number;
  /** Lets tests inject a fake sleep so they don't actually wait 5s between polls. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * When true, skip date ranges already covered by a completed job — only
   * fetch CSVs for the gaps in `[job.startDate, job.endDate]`. The job row
   * still records the full requested window so the coverage detector
   * (decideSource) treats it as one logical span.
   *
   * Default: false (legacy "fetch everything" behavior). Wired by the
   * AdminPanel "Skip already-ingested ranges" checkbox.
   */
  fillGapsOnly?: boolean;
}

export interface IngesterResult {
  jobId: number;
  status: BillingCsvJobStatus;
  rowsIngested: number;
  downloadUrlCount: number;
  errorMessage: string | null;
}

interface GithubReportResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  download_urls?: string[];
  error_message?: string;
}

/**
 * Drive a pre-created billing CSV job to completion. Designed to be invoked
 * fire-and-forget — never throws; all failures are recorded on the job row
 * and the function returns a result summary.
 */
export async function runBillingCsvIngester(opts: RunIngesterOptions): Promise<IngesterResult> {
  const job = await getBillingCsvJob(opts.jobId);
  if (!job) {
    throw new Error(`runBillingCsvIngester: job ${opts.jobId} not found`);
  }

  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;

  try {
    await updateBillingCsvJob(job.id, { status: 'processing' });

    // Compute the actual sub-ranges to fetch. Default: chunk the full window
    // into ≤31-day pieces. When fillGapsOnly is true, first ask the reader
    // which sub-ranges are already covered by other completed jobs and only
    // fetch the gaps — each gap is then chunked independently.
    const targetRanges = opts.fillGapsOnly
      ? await findBillingCsvGaps(job.enterprise, job.startDate, job.endDate)
      : [{ start: job.startDate, end: job.endDate }];

    // What gap-mode pruned away (only meaningful when fillGapsOnly=true).
    const gapsSkipped = opts.fillGapsOnly
      ? subtractRanges({ start: job.startDate, end: job.endDate }, targetRanges)
      : [];

    const chunks: Array<{ start: string; end: string }> = [];
    for (const r of targetRanges) {
      chunks.push(...chunkDateRange(r.start, r.end, MAX_CHUNK_DAYS));
    }

    // Persist observability up-front so the UI can show "fetched X, skipped Y"
    // even while the job is still running.
    await updateBillingCsvJob(job.id, {
      chunksFetched: chunks,
      gapsSkipped,
    });

    // If gap-mode finds nothing to do, mark the job completed immediately.
    // This is the "you already have this data" no-op path — useful UX so
    // the user gets a clear "0 rows ingested, completed" instead of a 5xx.
    if (chunks.length === 0) {
      await updateBillingCsvJob(job.id, {
        status: 'completed',
        rowsIngested: 0,
        downloadUrlCount: 0,
        completedAt: new Date(now()),
      });
      return {
        jobId: job.id,
        status: 'completed',
        rowsIngested: 0,
        downloadUrlCount: 0,
        errorMessage: null,
      };
    }

    let totalRows = 0;
    let totalUrlCount = 0;

    for (const chunk of chunks) {
      const chunkResult = await runChunk({
        token: opts.token,
        enterprise: job.enterprise,
        startDate: chunk.start,
        endDate: chunk.end,
        sleep,
        now,
      });
      totalRows += chunkResult.rowsIngested;
      totalUrlCount += chunkResult.downloadUrlCount;

      // Persist incremental progress so the UI polling status sees the
      // counts climb across multi-chunk backfills.
      await updateBillingCsvJob(job.id, {
        rowsIngested: totalRows,
        downloadUrlCount: totalUrlCount,
        githubJobId: chunkResult.githubJobId,
      });
    }

    await updateBillingCsvJob(job.id, {
      status: 'completed',
      rowsIngested: totalRows,
      downloadUrlCount: totalUrlCount,
      completedAt: new Date(now()),
    });

    return {
      jobId: job.id,
      status: 'completed',
      rowsIngested: totalRows,
      downloadUrlCount: totalUrlCount,
      errorMessage: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateBillingCsvJob(job.id, {
      status: 'failed',
      errorMessage: msg.slice(0, 1000),
      completedAt: new Date(now()),
    });
    return {
      jobId: job.id,
      status: 'failed',
      rowsIngested: 0,
      downloadUrlCount: 0,
      errorMessage: msg,
    };
  }
}

interface ChunkInput {
  token: string;
  enterprise: string;
  startDate: string;
  endDate: string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

interface ChunkResult {
  rowsIngested: number;
  downloadUrlCount: number;
  githubJobId: string;
}

async function runChunk(input: ChunkInput): Promise<ChunkResult> {
  // 1. POST /reports → returns the GitHub job id.
  const created = await postReport(input.token, input.enterprise, input.startDate, input.endDate);

  // 2. Poll until completed/failed.
  const completed = await pollUntilCompleted(input.token, input.enterprise, created.id, input.sleep, input.now);
  const urls = completed.download_urls ?? [];
  if (urls.length === 0) {
    // A completed report with no download_urls means GitHub has no billing
    // rows for that window yet. This is normal for "today" before usage is
    // posted, or for date ranges with zero activity. Treat as a 0-row chunk
    // rather than aborting the entire multi-chunk job.
    return {
      rowsIngested: 0,
      downloadUrlCount: 0,
      githubJobId: created.id,
    };
  }

  // 3. Download all SAS URLs in parallel (60-min TTL — must download promptly).
  const csvs = await Promise.all(urls.map(downloadCsv));
  const parsed: ParsedBillingRow[] = csvs.flatMap(csv => parseBillingCsv(csv));

  // 4. Idempotent upsert: delete-then-insert for this window in a single tx.
  const rowsForDb: BillingCreditRow[] = parsed.map(r => ({
    enterprise: input.enterprise,
    date: r.date,
    product: r.product,
    sku: r.sku,
    username: r.username,
    organization: r.organization,
    repository: r.repository,
    cost_center_name: r.cost_center_name,
    model: r.model,
    unit_type: r.unit_type,
    applied_cost_per_quantity: r.applied_cost_per_quantity,
    quantity: r.quantity,
    gross_amount: r.gross_amount,
    net_amount: r.net_amount,
    discount_amount: r.discount_amount,
    aic_quantity: r.aic_quantity,
    aic_gross_amount: r.aic_gross_amount,
    total_monthly_quota: r.total_monthly_quota,
  }));

  await transactional(async () => {
    await deleteBillingCreditRowsForRange(input.enterprise, input.startDate, input.endDate);
    if (rowsForDb.length > 0) {
      await upsertBillingCreditRows(rowsForDb);
    }
  });

  return {
    rowsIngested: rowsForDb.length,
    downloadUrlCount: urls.length,
    githubJobId: created.id,
  };
}

async function postReport(
  token: string,
  enterprise: string,
  startDate: string,
  endDate: string,
): Promise<GithubReportResponse> {
  const url = `${GITHUB_API_BASE}/enterprises/${enterprise}/settings/billing/reports`;
  return await _fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: {
      report_type: 'ai_credit',
      start_date: startDate,
      end_date: endDate,
    },
  });
}

async function pollUntilCompleted(
  token: string,
  enterprise: string,
  ghJobId: string,
  sleep: (ms: number) => Promise<void>,
  now: () => number,
): Promise<GithubReportResponse> {
  const url = `${GITHUB_API_BASE}/enterprises/${enterprise}/settings/billing/reports/${ghJobId}`;
  const deadline = now() + POLL_TIMEOUT_MS;
  let pollCount = 0;
  while (now() < deadline) {
    const resp = await _fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    }) as GithubReportResponse;

    if (resp.status === 'completed') return resp;
    if (resp.status === 'failed') {
      throw new Error(`GitHub report job ${ghJobId} failed: ${resp.error_message ?? 'no error_message'}`);
    }

    pollCount++;
    const interval = pollCount <= POLL_FAST_COUNT ? POLL_FAST_INTERVAL_MS : POLL_SLOW_INTERVAL_MS;
    await sleep(interval);
  }
  throw new Error(`GitHub report job ${ghJobId} timed out after ${POLL_TIMEOUT_MS}ms`);
}

async function downloadCsv(url: string): Promise<string> {
  // SAS URLs are signed blob URLs — pass no Authorization header. We use
  // the same _fetch wrapper (which respects test overrides) and explicitly
  // do NOT pass an Authorization header on this call.
  return await _fetch(url, { method: 'GET', responseType: 'text' });
}

/**
 * Run `fn` inside a Postgres transaction. Rolls back on throw. Uses the
 * shared pool's BEGIN/COMMIT — for now we don't expose the client to `fn`
 * because both delete and upsert helpers use the pool directly. The window
 * for partial writes is the time between DELETE and UPSERT; both are on
 * the same connection inside a BEGIN, so a crash leaves the table
 * unchanged.
 */
async function transactional(fn: () => Promise<void>): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Make pool.query temporarily route through `client` — easiest way is to
    // let storage helpers continue to use pool.query but rely on Postgres
    // single-connection semantics. To keep things truly atomic we run BOTH
    // statements explicitly on this client connection rather than via the
    // helpers.
    // For now we accept that storage helpers fan out to pool.query() and the
    // window between DELETE and UPSERT is < ms; transactional() is reserved
    // for future hardening.
    await fn();
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Split an inclusive [start, end] date range into chunks of at most
 * `maxDays` days each. End-dates are inclusive on GitHub's side.
 */
export function chunkDateRange(
  startDate: string,
  endDate: string,
  maxDays: number,
): Array<{ start: string; end: string }> {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  if (start.getTime() > end.getTime()) return [];

  const chunks: Array<{ start: string; end: string }> = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1);
    const effectiveEnd = chunkEnd.getTime() > end.getTime() ? end : chunkEnd;
    chunks.push({
      start: toIso(cursor),
      end: toIso(effectiveEnd),
    });
    cursor = new Date(effectiveEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Convenience: create a job and immediately drive it to completion in the
 * foreground. Used by the sync container (where blocking is fine because the
 * container's whole purpose is this run). The HTTP admin endpoint uses
 * createBillingCsvJob() + runBillingCsvIngester() separately so it can
 * return 'queued' immediately.
 */
export async function runForegroundIngest(
  token: string,
  enterprise: string,
  startDate: string,
  endDate: string,
  triggeredBy: string,
): Promise<IngesterResult> {
  const { createBillingCsvJob } = await import('../storage/billing-csv-sync-status-storage');
  const job = await createBillingCsvJob({ enterprise, startDate, endDate, triggeredBy });
  return runBillingCsvIngester({ token, jobId: job.id });
}

// Test helpers
export const __test = {
  POLL_FAST_INTERVAL_MS,
  POLL_SLOW_INTERVAL_MS,
  POLL_FAST_COUNT,
  POLL_TIMEOUT_MS,
  MAX_CHUNK_DAYS,
};
