/**
 * Seats storage implementation using Nitro's unstorage
 */

import type { Seat } from '@/model/Seat';
import type { StoredSeats } from './types';
import { buildSeatsKey } from './types';

/**
 * Save seats data to storage
 */
export async function saveSeats(
  scope: string,
  scopeIdentifier: string,
  snapshotDate: string,
  seats: Seat[]
): Promise<void> {
  const storage = useStorage('metrics');
  const key = buildSeatsKey(scope, scopeIdentifier, snapshotDate);
  
  const storedSeats: StoredSeats = {
    scope,
    scopeIdentifier,
    snapshotDate,
    seats,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await storage.setItem(key, storedSeats);
}

/**
 * Get seats for a specific date
 */
export async function getSeats(
  scope: string,
  scopeIdentifier: string,
  snapshotDate: string
): Promise<Seat[] | null> {
  const storage = useStorage('metrics');
  const key = buildSeatsKey(scope, scopeIdentifier, snapshotDate);
  
  const stored = await storage.getItem<StoredSeats>(key);
  return stored ? stored.seats : null;
}

/**
 * Get latest seats (most recent snapshot)
 */
export async function getLatestSeats(
  scope: string,
  scopeIdentifier: string
): Promise<Seat[] | null> {
  const storage = useStorage('metrics');
  const prefix = `seats:${scope}:${scopeIdentifier}:`;
  const keys = await storage.getKeys(prefix);
  
  if (keys.length === 0) {
    return null;
  }
  
  // Sort keys to get the most recent date
  keys.sort().reverse();
  const latestKey = keys[0];
  
  const stored = await storage.getItem<StoredSeats>(latestKey);
  return stored ? stored.seats : null;
}

/**
 * Check if seats exist for a specific date
 */
export async function hasSeats(
  scope: string,
  scopeIdentifier: string,
  snapshotDate: string
): Promise<boolean> {
  const storage = useStorage('metrics');
  const key = buildSeatsKey(scope, scopeIdentifier, snapshotDate);
  return await storage.hasItem(key);
}
