/**
 * Seats storage implementation backed by PostgreSQL.
 */

import type { Seat } from '@/model/Seat';
import { getPool } from './db';

/**
 * Save seats data to storage (upsert)
 */
export async function saveSeats(
  scope: string,
  scopeIdentifier: string,
  snapshotDate: string,
  seats: Seat[]
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO seats (scope, identifier, snapshot_date, seats)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (scope, identifier, snapshot_date)
     DO UPDATE SET seats = $4, updated_at = NOW()`,
    [scope, scopeIdentifier, snapshotDate, JSON.stringify(seats)]
  );
}

/**
 * Get seats for a specific date
 */
export async function getSeats(
  scope: string,
  scopeIdentifier: string,
  snapshotDate: string
): Promise<Seat[] | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT seats FROM seats WHERE scope = $1 AND identifier = $2 AND snapshot_date = $3`,
    [scope, scopeIdentifier, snapshotDate]
  );
  return rows.length > 0 ? rows[0].seats : null;
}

/**
 * Get latest seats (most recent snapshot)
 */
export async function getLatestSeats(
  scope: string,
  scopeIdentifier: string
): Promise<Seat[] | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT seats FROM seats WHERE scope = $1 AND identifier = $2
     ORDER BY snapshot_date DESC LIMIT 1`,
    [scope, scopeIdentifier]
  );
  return rows.length > 0 ? rows[0].seats : null;
}

/**
 * Check if seats exist for a specific date
 */
export async function hasSeats(
  scope: string,
  scopeIdentifier: string,
  snapshotDate: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM seats WHERE scope = $1 AND identifier = $2 AND snapshot_date = $3 LIMIT 1`,
    [scope, scopeIdentifier, snapshotDate]
  );
  return rows.length > 0;
}
