/**
 * PostgreSQL connection pool and schema initialization.
 *
 * Connection string is read from DATABASE_URL env var.
 * Falls back to individual PG* env vars or docker-compose defaults.
 *
 * Set PGLITE_DATA_DIR to a local directory path to use PGlite instead
 * (embedded Postgres, no server required — see pglite-adapter.ts).
 */

import pg from 'pg';
const { Pool } = pg;
import { createPglitePool } from './pglite-adapter';
import type { DbPool } from './types';

let _pool: DbPool | null = null;

/**
 * Get or create the shared connection pool.
 * Safe to call repeatedly — returns the same pool instance.
 */
export function getPool(): DbPool {
  if (!_pool) {
    if (process.env.PGLITE_DATA_DIR) {
      _pool = createPglitePool(process.env.PGLITE_DATA_DIR);
    } else {
      const connectionString = process.env.DATABASE_URL;
      if (connectionString) {
        _pool = new Pool({ connectionString }) as unknown as DbPool;
      } else {
        _pool = new Pool({
          host: process.env.PGHOST || 'localhost',
          port: parseInt(process.env.PGPORT || '5432', 10),
          database: process.env.PGDATABASE || 'copilot_metrics',
          user: process.env.PGUSER || 'metrics_user',
          password: process.env.PGPASSWORD || 'metrics_password',
        }) as unknown as DbPool;
      }
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
}
