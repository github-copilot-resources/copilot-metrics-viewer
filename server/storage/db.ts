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
    CREATE TABLE IF NOT EXISTS user_metrics (
      id               SERIAL PRIMARY KEY,
      scope            TEXT NOT NULL,
      identifier       TEXT NOT NULL,
      report_start_day DATE NOT NULL,
      report_end_day   DATE NOT NULL,
      user_totals      JSONB NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (scope, identifier, report_start_day, report_end_day)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_metrics_lookup
    ON user_metrics (scope, identifier, report_end_day DESC);
  `);
}
