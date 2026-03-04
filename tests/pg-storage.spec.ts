/**
 * Tests for PostgreSQL storage layer using pg-mem (in-memory PostgreSQL).
 * Validates that actual SQL queries work correctly for metrics, sync status, and seats.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { newDb } from 'pg-mem';

// Create in-memory PG and mock the db module before importing storage
const memDb = newDb();
const pool = memDb.adapters.createPg().Pool;
const mockPool = new pool();

vi.mock('../server/storage/db', () => ({
  getPool: () => mockPool,
  initSchema: vi.fn(),
  closePool: vi.fn(),
}));

import { initSchema } from '../server/storage/db';
import {
  saveMetrics, getMetrics, getReportData, getMetricsByDateRange,
  hasMetrics, deleteMetrics, countMetrics,
} from '../server/storage/metrics-storage';
import {
  saveSyncStatus, getSyncStatus, createPendingSyncStatus,
  markSyncInProgress, markSyncCompleted, markSyncFailed,
  getPendingSyncs, getFailedSyncs,
} from '../server/storage/sync-storage';
import {
  saveSeats, getSeats, getLatestSeats, hasSeats,
} from '../server/storage/seats-storage';
import type { CopilotMetrics } from '../app/model/Copilot_Metrics';

// Run real schema SQL against pg-mem
async function setupSchema() {
  await mockPool.query(`
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
    )
  `);
  await mockPool.query(`
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
    )
  `);
  await mockPool.query(`
    CREATE TABLE IF NOT EXISTS seats (
      id              SERIAL PRIMARY KEY,
      scope           TEXT NOT NULL,
      identifier      TEXT NOT NULL,
      snapshot_date   DATE NOT NULL,
      seats           JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (scope, identifier, snapshot_date)
    )
  `);
}

// Minimal CopilotMetrics fixture
function mockMetrics(date: string): CopilotMetrics {
  return {
    date,
    total_active_users: 50,
    total_engaged_users: 40,
    copilot_ide_code_completions: { editors: [], languages: [], total_code_acceptances: 100, total_code_suggestions: 200, total_code_lines_accepted: 500, total_code_lines_suggested: 1000 },
    copilot_ide_chat: { editors: [], total_chats: 30, total_chat_copy_events: 5, total_chat_insertion_events: 10 },
    copilot_dotcom_chat: { models: [], total_chats: 20 },
    copilot_dotcom_pull_requests: { repositories: [], total_pr_summaries_created: 5 },
    total_suggestions_count: 200,
    total_acceptances_count: 100,
    total_lines_suggested: 1000,
    total_lines_accepted: 500,
    total_active_chat_users: 25,
    total_chat_acceptances: 15,
    total_chat_turns: 30,
  } as CopilotMetrics;
}

describe('PostgreSQL Storage Layer', () => {
  beforeAll(async () => {
    await setupSchema();
  });

  beforeEach(async () => {
    // Clear tables between tests
    await mockPool.query('DELETE FROM metrics');
    await mockPool.query('DELETE FROM sync_status');
    await mockPool.query('DELETE FROM seats');
  });

  describe('metrics-storage', () => {
    it('should save and retrieve metrics', async () => {
      const data = mockMetrics('2026-02-15');
      await saveMetrics('organization', 'test-org', '2026-02-15', data);

      const result = await getMetrics('organization', 'test-org', '2026-02-15');
      expect(result).not.toBeNull();
      expect(result!.date).toBe('2026-02-15');
      expect(result!.total_active_users).toBe(50);
    });

    it('should upsert on duplicate date', async () => {
      const data1 = mockMetrics('2026-02-15');
      const data2 = { ...mockMetrics('2026-02-15'), total_active_users: 99 };

      await saveMetrics('organization', 'test-org', '2026-02-15', data1);
      await saveMetrics('organization', 'test-org', '2026-02-15', data2 as CopilotMetrics);

      const result = await getMetrics('organization', 'test-org', '2026-02-15');
      expect(result!.total_active_users).toBe(99);
    });

    it('should save and retrieve report data', async () => {
      const data = mockMetrics('2026-02-15');
      const reportData = { day: '2026-02-15', daily_active_users: 50, totals_by_ide: [] };

      await saveMetrics('organization', 'test-org', '2026-02-15', data, undefined, reportData as any);

      const result = await getReportData('organization', 'test-org', '2026-02-15');
      expect(result).not.toBeNull();
      expect(result!.day).toBe('2026-02-15');
    });

    it('should query date range in single SQL call', async () => {
      for (let d = 10; d <= 15; d++) {
        const date = `2026-02-${d}`;
        await saveMetrics('organization', 'test-org', date, mockMetrics(date));
      }

      const results = await getMetricsByDateRange({
        scope: 'organization',
        scopeIdentifier: 'test-org',
        startDate: '2026-02-11',
        endDate: '2026-02-14',
      });

      expect(results).toHaveLength(4);
      expect(results[0].date).toBe('2026-02-11');
      expect(results[3].date).toBe('2026-02-14');
    }, 15000);

    it('should check existence with hasMetrics', async () => {
      expect(await hasMetrics('organization', 'test-org', '2026-02-15')).toBe(false);
      await saveMetrics('organization', 'test-org', '2026-02-15', mockMetrics('2026-02-15'));
      expect(await hasMetrics('organization', 'test-org', '2026-02-15')).toBe(true);
    });

    it('should delete metrics', async () => {
      await saveMetrics('organization', 'test-org', '2026-02-15', mockMetrics('2026-02-15'));
      expect(await hasMetrics('organization', 'test-org', '2026-02-15')).toBe(true);

      await deleteMetrics('organization', 'test-org', '2026-02-15');
      expect(await hasMetrics('organization', 'test-org', '2026-02-15')).toBe(false);
    });

    it('should isolate by scope and identifier', async () => {
      await saveMetrics('organization', 'org-a', '2026-02-15', mockMetrics('2026-02-15'));
      await saveMetrics('organization', 'org-b', '2026-02-15', mockMetrics('2026-02-15'));
      await saveMetrics('enterprise', 'org-a', '2026-02-15', mockMetrics('2026-02-15'));

      expect(await hasMetrics('organization', 'org-a', '2026-02-15')).toBe(true);
      expect(await hasMetrics('organization', 'org-b', '2026-02-15')).toBe(true);
      expect(await hasMetrics('enterprise', 'org-a', '2026-02-15')).toBe(true);
      expect(await hasMetrics('organization', 'org-c', '2026-02-15')).toBe(false);
    });

    it('should isolate by team slug', async () => {
      await saveMetrics('organization', 'test-org', '2026-02-15', mockMetrics('2026-02-15'));
      await saveMetrics('organization', 'test-org', '2026-02-15', mockMetrics('2026-02-15'), 'team-a');

      expect(await hasMetrics('organization', 'test-org', '2026-02-15')).toBe(true);
      expect(await hasMetrics('organization', 'test-org', '2026-02-15', 'team-a')).toBe(true);
      expect(await hasMetrics('organization', 'test-org', '2026-02-15', 'team-b')).toBe(false);
    });

    it('should count metrics in date range', async () => {
      for (let d = 10; d <= 15; d++) {
        await saveMetrics('organization', 'test-org', `2026-02-${d}`, mockMetrics(`2026-02-${d}`));
      }

      const count = await countMetrics('organization', 'test-org', '2026-02-11', '2026-02-14');
      expect(count).toBe(4);
    });
  });

  describe('sync-storage', () => {
    it('should create pending sync status', async () => {
      const status = await createPendingSyncStatus('organization', 'test-org', '2026-02-15');
      expect(status.status).toBe('pending');
      expect(status.attemptCount).toBe(0);

      const retrieved = await getSyncStatus('organization', 'test-org', '2026-02-15');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.status).toBe('pending');
    });

    it('should mark sync in progress', async () => {
      await createPendingSyncStatus('organization', 'test-org', '2026-02-15');
      await markSyncInProgress('organization', 'test-org', '2026-02-15');

      const status = await getSyncStatus('organization', 'test-org', '2026-02-15');
      expect(status!.status).toBe('in_progress');
      expect(status!.attemptCount).toBe(1);
    });

    it('should mark sync completed', async () => {
      await createPendingSyncStatus('organization', 'test-org', '2026-02-15');
      await markSyncInProgress('organization', 'test-org', '2026-02-15');
      await markSyncCompleted('organization', 'test-org', '2026-02-15');

      const status = await getSyncStatus('organization', 'test-org', '2026-02-15');
      expect(status!.status).toBe('completed');
      expect(status!.completedAt).toBeTruthy();
    });

    it('should mark sync failed with error', async () => {
      await createPendingSyncStatus('organization', 'test-org', '2026-02-15');
      await markSyncInProgress('organization', 'test-org', '2026-02-15');
      await markSyncFailed('organization', 'test-org', '2026-02-15', 'API rate limit');

      const status = await getSyncStatus('organization', 'test-org', '2026-02-15');
      expect(status!.status).toBe('failed');
      expect(status!.errorMessage).toBe('API rate limit');
    });

    it('should list pending syncs', async () => {
      await createPendingSyncStatus('organization', 'test-org', '2026-02-15');
      await createPendingSyncStatus('organization', 'test-org', '2026-02-16');

      const pending = await getPendingSyncs();
      expect(pending).toHaveLength(2);
    });

    it('should list failed syncs', async () => {
      await createPendingSyncStatus('organization', 'test-org', '2026-02-15');
      await markSyncInProgress('organization', 'test-org', '2026-02-15');
      await markSyncFailed('organization', 'test-org', '2026-02-15', 'error');

      const failed = await getFailedSyncs();
      expect(failed).toHaveLength(1);
      expect(failed[0].errorMessage).toBe('error');
    });

    it('should throw when marking non-existent sync', async () => {
      await expect(markSyncInProgress('organization', 'test-org', '2099-01-01'))
        .rejects.toThrow('Sync status not found');
    });
  });

  describe('seats-storage', () => {
    const mockSeats = [
      { login: 'user1', last_activity_at: '2026-02-15', created_at: '2026-01-01' },
      { login: 'user2', last_activity_at: '2026-02-14', created_at: '2026-01-01' },
    ];

    it('should save and retrieve seats', async () => {
      await saveSeats('organization', 'test-org', '2026-02-15', mockSeats as any);

      const result = await getSeats('organization', 'test-org', '2026-02-15');
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0].login).toBe('user1');
    });

    it('should get latest seats snapshot', async () => {
      await saveSeats('organization', 'test-org', '2026-02-14', [mockSeats[0]] as any);
      await saveSeats('organization', 'test-org', '2026-02-15', mockSeats as any);

      const latest = await getLatestSeats('organization', 'test-org');
      expect(latest).toHaveLength(2);
    });

    it('should check seats existence', async () => {
      expect(await hasSeats('organization', 'test-org', '2026-02-15')).toBe(false);
      await saveSeats('organization', 'test-org', '2026-02-15', mockSeats as any);
      expect(await hasSeats('organization', 'test-org', '2026-02-15')).toBe(true);
    });
  });
});
