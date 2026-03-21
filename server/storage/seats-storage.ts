/**
 * Seats storage implementation backed by PostgreSQL.
 */

import type { Seat } from '@/model/Seat';
import { getPool } from './db';

/**
 * Aggregated seat statistics for one daily snapshot.
 */
export interface SeatHistoryEntry {
  snapshot_date: string;
  total_seats: number;
  never_active: number;
  inactive_7d: number;
  inactive_30d: number;
}

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

/**
 * Return aggregated seat statistics for every stored snapshot, ordered by date ascending.
 * Stats are computed in TypeScript from the stored JSONB array for pg-mem compatibility.
 */
export async function getSeatsHistorySummary(
  scope: string,
  scopeIdentifier: string
): Promise<SeatHistoryEntry[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT snapshot_date, seats
     FROM seats
     WHERE scope = $1 AND identifier = $2
     ORDER BY snapshot_date ASC`,
    [scope, scopeIdentifier]
  );

  const MS_7D  = 7  * 24 * 60 * 60 * 1000;
  const MS_30D = 30 * 24 * 60 * 60 * 1000;

  return rows.map(row => {
    const snapshotMs = new Date(row.snapshot_date).getTime();
    const seats: Array<{ last_activity_at?: string | null }> = row.seats;

    let never_active = 0;
    let inactive_7d  = 0;
    let inactive_30d = 0;

    for (const seat of seats) {
      if (!seat.last_activity_at) {
        never_active++;
        inactive_7d++;
        inactive_30d++;
      } else {
        const activityMs = new Date(seat.last_activity_at).getTime();
        if (snapshotMs - activityMs > MS_7D)  inactive_7d++;
        if (snapshotMs - activityMs > MS_30D) inactive_30d++;
      }
    }

    return {
      snapshot_date: new Date(row.snapshot_date).toISOString().split('T')[0],
      total_seats: seats.length,
      never_active,
      inactive_7d,
      inactive_30d,
    };
  });
}
