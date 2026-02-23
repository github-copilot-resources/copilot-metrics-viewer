/**
 * Sync status storage implementation using Nitro's unstorage
 * Tracks the status of data synchronization jobs
 */

import type { SyncStatus } from './types';
import { buildSyncStatusKey } from './types';

/**
 * Save or update sync status
 */
export async function saveSyncStatus(status: SyncStatus): Promise<void> {
  const storage = useStorage('metrics');
  const key = buildSyncStatusKey(
    status.scope,
    status.scopeIdentifier,
    status.metricsDate,
    status.teamSlug
  );
  
  await storage.setItem(key, status);
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
  const storage = useStorage('metrics');
  const key = buildSyncStatusKey(scope, scopeIdentifier, metricsDate, teamSlug);
  
  return await storage.getItem<SyncStatus>(key);
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
  const status = await getSyncStatus(scope, scopeIdentifier, metricsDate, teamSlug);
  if (!status) {
    throw new Error('Sync status not found');
  }
  
  status.status = 'in_progress';
  status.attemptCount += 1;
  status.lastAttemptAt = new Date().toISOString();
  
  await saveSyncStatus(status);
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
  const status = await getSyncStatus(scope, scopeIdentifier, metricsDate, teamSlug);
  if (!status) {
    throw new Error('Sync status not found');
  }
  
  status.status = 'completed';
  status.completedAt = new Date().toISOString();
  
  await saveSyncStatus(status);
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
  const status = await getSyncStatus(scope, scopeIdentifier, metricsDate, teamSlug);
  if (!status) {
    throw new Error('Sync status not found');
  }
  
  status.status = 'failed';
  status.errorMessage = errorMessage;
  
  await saveSyncStatus(status);
}

/**
 * Get all pending syncs
 */
export async function getPendingSyncs(): Promise<SyncStatus[]> {
  const storage = useStorage('metrics');
  const keys = await storage.getKeys('sync:');
  const results: SyncStatus[] = [];
  
  for (const key of keys) {
    const status = await storage.getItem<SyncStatus>(key);
    if (status && status.status === 'pending') {
      results.push(status);
    }
  }
  
  return results;
}

/**
 * Get all failed syncs
 */
export async function getFailedSyncs(): Promise<SyncStatus[]> {
  const storage = useStorage('metrics');
  const keys = await storage.getKeys('sync:');
  const results: SyncStatus[] = [];
  
  for (const key of keys) {
    const status = await storage.getItem<SyncStatus>(key);
    if (status && status.status === 'failed') {
      results.push(status);
    }
  }
  
  return results;
}
