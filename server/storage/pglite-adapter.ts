/**
 * PGlite adapter — wraps @electric-sql/pglite in the same pool interface as pg.Pool.
 *
 * Activated by setting PGLITE_DATA_DIR to a local directory path.
 * PGlite stores the full Postgres database in that directory (no server required).
 * The schema (JSONB, TIMESTAMPTZ, SERIAL, ON CONFLICT, etc.) is used unchanged
 * because PGlite is a real Postgres engine compiled to WASM.
 *
 * Concurrent queries are serialised internally by PGlite — safe for server use.
 */

import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { DbPool } from './types';

export function createPglitePool(dataDir: string): DbPool {
  mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  return {
    async query(sql: string, params?: unknown[]) {
      const result = await db.query(sql, params as any[]);
      return {
        rows: result.rows as any[],
        // affectedRows covers DML; fall back to rows.length for SELECT
        rowCount: result.affectedRows ?? result.rows.length,
      };
    },
    async end() {
      await db.close();
    },
  };
}
