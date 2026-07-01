/**
 * PostgreSQL connection pool and schema initialization.
 *
 * Connection string is read from DATABASE_URL env var.
 * Falls back to individual PG* env vars or docker-compose defaults.
 */

import pg from 'pg';
const { Pool } = pg;

let _pool: pg.Pool | null = null;

/**
 * Get or create the shared connection pool.
 * Safe to call repeatedly — returns the same pool instance.
 */
export function getPool(): pg.Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      _pool = new Pool({ connectionString });
    } else {
      _pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE || 'copilot_metrics',
        user: process.env.PGUSER || 'metrics_user',
        password: process.env.PGPASSWORD || 'metrics_password',
      });
    }
  }
  return _pool;
}

/**
 * Whether DB-backed historical storage is enabled. When false, endpoints
 * that have a DB-backed path should fall back to the live GitHub API.
 */
export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL || process.env.ENABLE_HISTORICAL_MODE === 'true';
}

/**
 * Close the connection pool (for graceful shutdown).
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * Initialize database schema. Idempotent — safe to call on every startup.
 */
export async function initSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS metrics (
      id            SERIAL PRIMARY KEY,
      scope         TEXT NOT NULL,
      identifier    TEXT NOT NULL,
      team_slug     TEXT NOT NULL DEFAULT '',
      metrics_date  DATE NOT NULL,
      data          JSONB NOT NULL,
      report_data   JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (scope, identifier, team_slug, metrics_date)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_metrics_lookup
    ON metrics (scope, identifier, metrics_date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_metrics_team_lookup
    ON metrics (scope, identifier, team_slug, metrics_date);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id              SERIAL PRIMARY KEY,
      scope           TEXT NOT NULL,
      identifier      TEXT NOT NULL,
      team_slug       TEXT NOT NULL DEFAULT '',
      metrics_date    DATE NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      error_message   TEXT,
      attempt_count   INT NOT NULL DEFAULT 0,
      last_attempt_at TIMESTAMPTZ,
      completed_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (scope, identifier, team_slug, metrics_date)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seats (
      id              SERIAL PRIMARY KEY,
      scope           TEXT NOT NULL,
      identifier      TEXT NOT NULL,
      snapshot_date   DATE NOT NULL,
      seats           JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (scope, identifier, snapshot_date)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_day_metrics (
      id            SERIAL PRIMARY KEY,
      scope         TEXT NOT NULL,
      identifier    TEXT NOT NULL,
      user_login    TEXT NOT NULL,
      user_id       BIGINT,
      metrics_date  DATE NOT NULL,
      data          JSONB NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (scope, identifier, user_login, metrics_date)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_day_metrics_lookup
    ON user_day_metrics (scope, identifier, metrics_date);
  `);

  // ── Billing CSV ingest (Phase A) ───────────────────────────────────────────
  // Stores line-level rows downloaded from GitHub's async billing CSV export
  // (POST /enterprises/{ent}/settings/billing/reports). One row per CSV line:
  // (enterprise, date, sku, username, organization, repository, model) is
  // unique in the source CSV (verified empirically against ghms-mfg-us-app-inno).
  // Overlapping re-runs are idempotent via ON CONFLICT DO UPDATE.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_credit_usage (
      enterprise                TEXT NOT NULL,
      date                      DATE NOT NULL,
      product                   TEXT NOT NULL,
      sku                       TEXT NOT NULL,
      username                  TEXT NOT NULL,
      organization              TEXT NOT NULL DEFAULT '',
      repository                TEXT NOT NULL DEFAULT '',
      cost_center_name          TEXT NOT NULL DEFAULT '',
      model                     TEXT NOT NULL DEFAULT '',
      unit_type                 TEXT NOT NULL DEFAULT '',
      applied_cost_per_quantity NUMERIC(20,6) NOT NULL DEFAULT 0,
      quantity                  NUMERIC(20,6) NOT NULL DEFAULT 0,
      gross_amount              NUMERIC(20,6) NOT NULL DEFAULT 0,
      net_amount                NUMERIC(20,6) NOT NULL DEFAULT 0,
      discount_amount           NUMERIC(20,6) NOT NULL DEFAULT 0,
      aic_quantity              NUMERIC(20,6) NOT NULL DEFAULT 0,
      aic_gross_amount          NUMERIC(20,6) NOT NULL DEFAULT 0,
      total_monthly_quota       NUMERIC(20,6) NOT NULL DEFAULT 0,
      ingested_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (enterprise, date, sku, username, organization, repository, model)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bcu_ent_date
    ON billing_credit_usage (enterprise, date);
  `);

  // Partial index so the username-filtered queries used by the per-user
  // breakdown never have to scan un-attributed rows.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bcu_ent_user
    ON billing_credit_usage (enterprise, username)
    WHERE username <> '';
  `);

  // Audit / state for billing CSV export jobs. Mirrors the sync_status pattern.
  // Single-flight is enforced at the DB layer by the partial unique index
  // below — concurrent insert attempts collide and we surface a 409 instead.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_csv_sync_status (
      id                  SERIAL PRIMARY KEY,
      enterprise          TEXT NOT NULL,
      start_date          DATE NOT NULL,
      end_date            DATE NOT NULL,
      github_job_id       TEXT,
      status              TEXT NOT NULL,
      rows_ingested       INTEGER NOT NULL DEFAULT 0,
      download_url_count  INTEGER NOT NULL DEFAULT 0,
      error_message       TEXT,
      triggered_by        TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at        TIMESTAMPTZ
    );
  `);

  // Observability columns added in v3.13: surface which sub-ranges this job
  // actually fetched vs skipped (because gap-mode found existing coverage).
  // Both are arrays of {start, end} ISO date ranges. NULL = "data predates
  // this column" (don't infer anything).
  await pool.query(`
    ALTER TABLE billing_csv_sync_status
    ADD COLUMN IF NOT EXISTS chunks_fetched JSONB,
    ADD COLUMN IF NOT EXISTS gaps_skipped   JSONB;
  `);

  // Soft-dismiss column (v3.13): admins can hide noisy/old job rows from the
  // recent-jobs UI without deleting them — the row stays so gap-mode coverage
  // detection (which keys off status='completed' rows) keeps working.
  await pool.query(`
    ALTER TABLE billing_csv_sync_status
    ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bcss_ent_created
    ON billing_csv_sync_status (enterprise, created_at DESC);
  `);

  // Partial unique index — at most one in-flight job per enterprise.
  // GitHub also enforces enterprise-wide single-flight server-side
  // (verified A.0 probe — concurrent POST returns 409); our DB index aligns.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bcss_one_inflight
    ON billing_csv_sync_status (enterprise)
    WHERE status IN ('queued','processing','downloading','upserting');
  `);
}
