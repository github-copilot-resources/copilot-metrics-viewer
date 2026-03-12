/**
 * Sync status storage implementation backed by PostgreSQL.
 * Tracks the status of data synchronization jobs.
 */

import type { SyncStatus } from './types';
import { getPool } from './db';

/**
 * Save or update sync status (upsert)
 */
export async function saveSyncStatus(status: SyncStatus): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO sync_status (scope, identifier, team_slug, metrics_date, status, error_message, attempt_count, last_attempt_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (scope, identifier, team_slug, metrics_date)
     DO UPDATE SET status = $5, error_message = $6, attempt_count = $7, last_attempt_at = $8, completed_at = $9`,
    [
      status.scope, status.scopeIdentifier, status.teamSlug || '',
      status.metricsDate, status.status, status.errorMessage ?? null,
      status.attemptCount, status.lastAttemptAt ?? null, status.completedAt ?? null
    ]
  );
}

/**
 * Get sync status for a specific date
 */
export async function getSyncStatus(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  teamSlug?: string
): Promise<SyncStatus | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT scope, identifier, team_slug, metrics_date, status, error_message,
            attempt_count, last_attempt_at, completed_at, created_at
     FROM sync_status
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3 AND metrics_date = $4`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate]
  );
  if (rows.length === 0) return null;
  return rowToSyncStatus(rows[0]);
}

/**
 * Create initial sync status for pending sync
 */
export async function createPendingSyncStatus(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  teamSlug?: string
): Promise<SyncStatus> {
  const status: SyncStatus = {
    scope,
    scopeIdentifier,
    teamSlug,
    metricsDate,
    status: 'pending',
    attemptCount: 0,
    createdAt: new Date().toISOString(),
  };
  await saveSyncStatus(status);
  return status;
}

/**
 * Update sync status to in_progress
 */
export async function markSyncInProgress(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  teamSlug?: string
): Promise<void> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE sync_status SET status = 'in_progress', attempt_count = attempt_count + 1, last_attempt_at = NOW()
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3 AND metrics_date = $4`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate]
  );
  if (rowCount === 0) throw new Error('Sync status not found');
}

/**
 * Update sync status to completed
 */
export async function markSyncCompleted(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  teamSlug?: string
): Promise<void> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE sync_status SET status = 'completed', completed_at = NOW()
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3 AND metrics_date = $4`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate]
  );
  if (rowCount === 0) throw new Error('Sync status not found');
}

/**
 * Update sync status to failed with error message
 */
export async function markSyncFailed(
  scope: string,
  scopeIdentifier: string,
  metricsDate: string,
  errorMessage: string,
  teamSlug?: string
): Promise<void> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE sync_status SET status = 'failed', error_message = $5
     WHERE scope = $1 AND identifier = $2 AND team_slug = $3 AND metrics_date = $4`,
    [scope, scopeIdentifier, teamSlug || '', metricsDate, errorMessage]
  );
  if (rowCount === 0) throw new Error('Sync status not found');
}

/**
 * Get all pending syncs
 */
export async function getPendingSyncs(): Promise<SyncStatus[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM sync_status WHERE status = 'pending' ORDER BY created_at DESC`
  );
  return rows.map(rowToSyncStatus);
}

/**
 * Get all failed syncs
 */
export async function getFailedSyncs(): Promise<SyncStatus[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM sync_status WHERE status = 'failed' ORDER BY created_at DESC`
  );
  return rows.map(rowToSyncStatus);
}

// Map DB row to SyncStatus interface
function rowToSyncStatus(row: Record<string, unknown>): SyncStatus {
  return {
    scope: row.scope as string,
    scopeIdentifier: row.identifier as string,
    teamSlug: (row.team_slug as string) || undefined,
    metricsDate: (row.metrics_date as Date).toISOString().split('T')[0],
    status: row.status as SyncStatus['status'],
    errorMessage: row.error_message as string | undefined,
    attemptCount: row.attempt_count as number,
    lastAttemptAt: row.last_attempt_at ? (row.last_attempt_at as Date).toISOString() : undefined,
    completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : undefined,
    createdAt: (row.created_at as Date).toISOString(),
  };
}
