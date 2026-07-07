/**
 * Lightweight predicate for "is historical/DB mode enabled".
 *
 * Split out from ./db.ts so callers (middleware, API handlers) can gate on
 * DB availability without pulling in the `pg` module at import time. This
 * keeps middleware/test loads cheap and avoids ESM/CJS interop crashes with
 * `pg` in environments that don't need a live connection.
 *
 * Historical mode is controlled by a single variable: DATABASE_URL.
 * Set it → the app reads/writes from Postgres and exposes /*-history endpoints.
 * Unset → live-API mode only.
 */
export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}
