/**
 * Tests for PostgreSQL storage layer using pg-mem (in-memory PostgreSQL).
 * Validates that actual SQL queries work correctly for metrics, sync status, seats,
 * and user metrics.
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
  saveSeats, getSeats, getLatestSeats, hasSeats, getSeatsHistorySummary,
} from '../server/storage/seats-storage';
import {
  saveUserMetrics, getUserMetrics, getLatestUserMetrics, hasUserMetrics,
  getUserMetricsHistory, getUserTimeSeries,
} from '../server/storage/user-metrics-storage';
import type { CopilotMetrics } from '../app/model/Copilot_Metrics';
import type { UserTotals } from '../server/services/github-copilot-usage-api';

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
  await mockPool.query(`
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

// Minimal ReportDayTotals fixture for hasMetrics (requires report_data IS NOT NULL)
function mockReportData(date: string): any {
  return { day: date, daily_active_users: 50, totals_by_ide: [], totals_by_feature: [] };
}

// Minimal UserTotals fixtures matching real GitHub API feature names
function mockUserTotals(): UserTotals[] {
  return [
    {
      login: 'octocat',
      user_id: 1,
      total_active_days: 22,
      user_initiated_interaction_count: 410,
      code_generation_activity_count: 1240,
      code_acceptance_activity_count: 860,
      loc_suggested_to_add_sum: 4800,
      loc_suggested_to_delete_sum: 120,
      loc_added_sum: 3200,
      loc_deleted_sum: 85,
      premium_requests_total: 45,
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 350, code_generation_activity_count: 1050, code_acceptance_activity_count: 720, loc_suggested_to_add_sum: 4100, loc_suggested_to_delete_sum: 100, loc_added_sum: 2750, loc_deleted_sum: 70 },
      ],
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 800, code_acceptance_activity_count: 620, loc_suggested_to_add_sum: 3200, loc_suggested_to_delete_sum: 80, loc_added_sum: 2100, loc_deleted_sum: 55 },
        { feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 180, code_generation_activity_count: 200, code_acceptance_activity_count: 120, loc_suggested_to_add_sum: 800, loc_suggested_to_delete_sum: 20, loc_added_sum: 600, loc_deleted_sum: 15 },
        { feature: 'agent_edit', user_initiated_interaction_count: 0, code_generation_activity_count: 240, code_acceptance_activity_count: 120, loc_suggested_to_add_sum: 800, loc_suggested_to_delete_sum: 20, loc_added_sum: 500, loc_deleted_sum: 15 },
      ],
      totals_by_language_feature: [
        { language: 'typescript', feature: 'code_completion', code_generation_activity_count: 420, code_acceptance_activity_count: 330, loc_suggested_to_add_sum: 1700, loc_suggested_to_delete_sum: 45, loc_added_sum: 1100, loc_deleted_sum: 30 },
        { language: 'python', feature: 'code_completion', code_generation_activity_count: 230, code_acceptance_activity_count: 180, loc_suggested_to_add_sum: 950, loc_suggested_to_delete_sum: 22, loc_added_sum: 640, loc_deleted_sum: 15 },
      ],
      totals_by_model_feature: [
        { model: 'auto', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 800, code_acceptance_activity_count: 620, loc_suggested_to_add_sum: 3200, loc_suggested_to_delete_sum: 80, loc_added_sum: 2100, loc_deleted_sum: 55, premium_requests_total: 0 },
        { model: 'claude-4.5-sonnet', feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 180, code_generation_activity_count: 200, code_acceptance_activity_count: 120, loc_suggested_to_add_sum: 800, loc_suggested_to_delete_sum: 20, loc_added_sum: 600, loc_deleted_sum: 15, premium_requests_total: 45 },
      ],
    },
    {
      login: 'octokitten',
      user_id: 2,
      total_active_days: 8,
      user_initiated_interaction_count: 120,
      code_generation_activity_count: 350,
      code_acceptance_activity_count: 210,
      loc_suggested_to_add_sum: 1400,
      loc_suggested_to_delete_sum: 35,
      loc_added_sum: 840,
      loc_deleted_sum: 22,
      premium_requests_total: 0,
    },
  ];
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
    await mockPool.query('DELETE FROM user_metrics');
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
      await saveMetrics('organization', 'test-org', '2026-02-15', mockMetrics('2026-02-15'), undefined, mockReportData('2026-02-15'));
      expect(await hasMetrics('organization', 'test-org', '2026-02-15')).toBe(true);
    });

    it('should delete metrics', async () => {
      await saveMetrics('organization', 'test-org', '2026-02-15', mockMetrics('2026-02-15'), undefined, mockReportData('2026-02-15'));
      expect(await hasMetrics('organization', 'test-org', '2026-02-15')).toBe(true);

      await deleteMetrics('organization', 'test-org', '2026-02-15');
      expect(await hasMetrics('organization', 'test-org', '2026-02-15')).toBe(false);
    });

    it('should isolate by scope and identifier', async () => {
      await saveMetrics('organization', 'org-a', '2026-02-15', mockMetrics('2026-02-15'), undefined, mockReportData('2026-02-15'));
      await saveMetrics('organization', 'org-b', '2026-02-15', mockMetrics('2026-02-15'), undefined, mockReportData('2026-02-15'));
      await saveMetrics('enterprise', 'org-a', '2026-02-15', mockMetrics('2026-02-15'), undefined, mockReportData('2026-02-15'));

      expect(await hasMetrics('organization', 'org-a', '2026-02-15')).toBe(true);
      expect(await hasMetrics('organization', 'org-b', '2026-02-15')).toBe(true);
      expect(await hasMetrics('enterprise', 'org-a', '2026-02-15')).toBe(true);
      expect(await hasMetrics('organization', 'org-c', '2026-02-15')).toBe(false);
    });

    it('should isolate by team slug', async () => {
      await saveMetrics('organization', 'test-org', '2026-02-15', mockMetrics('2026-02-15'), undefined, mockReportData('2026-02-15'));
      await saveMetrics('organization', 'test-org', '2026-02-15', mockMetrics('2026-02-15'), 'team-a', mockReportData('2026-02-15'));

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

  describe('user-metrics-storage', () => {
    it('should save and retrieve user metrics for a report period', async () => {
      const totals = mockUserTotals();
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', totals);

      const result = await getUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03');
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0].login).toBe('octocat');
      expect(result![0].premium_requests_total).toBe(45);
    });

    it('should upsert on duplicate (scope, identifier, start, end)', async () => {
      const totals = mockUserTotals();
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', totals);

      // Overwrite with updated premium requests
      const updated = totals.map(u => ({ ...u, premium_requests_total: 999 }));
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', updated);

      const result = await getUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03');
      expect(result![0].premium_requests_total).toBe(999);
    });

    it('should check existence with hasUserMetrics', async () => {
      expect(await hasUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03')).toBe(false);
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());
      expect(await hasUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03')).toBe(true);
    });

    it('should return latest snapshot ordered by report_end_day DESC', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-01-01', '2026-01-28', mockUserTotals());
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const latest = await getLatestUserMetrics('organization', 'test-org');
      expect(latest).not.toBeNull();
      // DATE columns may come back as Date objects from pg-mem
      expect(new Date(latest!.reportEndDay).toISOString().startsWith('2026-03-03')).toBe(true);
      expect(latest!.userTotals).toHaveLength(2);
    });

    it('should return null when no user metrics stored', async () => {
      const result = await getLatestUserMetrics('organization', 'unknown-org');
      expect(result).toBeNull();
    });

    it('should isolate by scope and identifier', async () => {
      await saveUserMetrics('organization', 'org-a', '2026-02-04', '2026-03-03', mockUserTotals());
      await saveUserMetrics('enterprise', 'ent-x', '2026-02-04', '2026-03-03', mockUserTotals());

      expect(await hasUserMetrics('organization', 'org-a', '2026-02-04', '2026-03-03')).toBe(true);
      expect(await hasUserMetrics('enterprise', 'ent-x', '2026-02-04', '2026-03-03')).toBe(true);
      expect(await hasUserMetrics('organization', 'ent-x', '2026-02-04', '2026-03-03')).toBe(false);
    });

    it('should preserve full user_totals JSONB including breakdowns', async () => {
      const totals = mockUserTotals();
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', totals);

      const result = await getUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03');
      expect(result![0].totals_by_ide).toHaveLength(1);
      expect(result![0].totals_by_ide![0].ide).toBe('vscode');
      expect(result![0].totals_by_feature).toHaveLength(3);
      expect(result![0].totals_by_feature![0].feature).toBe('code_completion');
      expect(result![0].totals_by_model_feature![1].model).toBe('claude-4.5-sonnet');
      expect(result![0].totals_by_model_feature![1].premium_requests_total).toBe(45);
    });
  });

  // ── getSeatsHistorySummary ─────────────────────────────────────────────────
  describe('getSeatsHistorySummary', () => {
    const makeSeats = (activityDates: Array<string | null>) =>
      activityDates.map((d, i) => ({ login: `user${i}`, last_activity_at: d }));

    it('should return one entry per snapshot ordered by date', async () => {
      await saveSeats('organization', 'test-org', '2026-02-14', makeSeats(['2026-02-14']) as any);
      await saveSeats('organization', 'test-org', '2026-02-15', makeSeats(['2026-02-15', '2026-02-10']) as any);

      const history = await getSeatsHistorySummary('organization', 'test-org');
      expect(history).toHaveLength(2);
      expect(history[0].snapshot_date).toBe('2026-02-14');
      expect(history[1].snapshot_date).toBe('2026-02-15');
    });

    it('should count total_seats correctly', async () => {
      await saveSeats('organization', 'test-org', '2026-02-15', makeSeats([null, '2026-02-15', '2026-02-01']) as any);
      const [entry] = await getSeatsHistorySummary('organization', 'test-org');
      expect(entry.total_seats).toBe(3);
    });

    it('should count never_active seats', async () => {
      await saveSeats('organization', 'test-org', '2026-02-15', makeSeats([null, null, '2026-02-15']) as any);
      const [entry] = await getSeatsHistorySummary('organization', 'test-org');
      expect(entry.never_active).toBe(2);
    });

    it('should count inactive_7d using snapshot date as reference', async () => {
      // snapshot: 2026-03-01 — anything with last_activity before 2026-02-22 is inactive_7d
      const seats = makeSeats([
        '2026-02-21T00:00:00Z', // >7 days before snapshot → inactive
        '2026-02-25T00:00:00Z', // <7 days before snapshot → active
        null,                    // never active → also counted
      ]);
      await saveSeats('organization', 'test-org', '2026-03-01', seats as any);
      const [entry] = await getSeatsHistorySummary('organization', 'test-org');
      expect(entry.inactive_7d).toBe(2);  // user0 + null user
    });

    it('should return empty array when no snapshots exist', async () => {
      const history = await getSeatsHistorySummary('organization', 'no-such-org');
      expect(history).toHaveLength(0);
    });
  });

  // ── getUserMetricsHistory ──────────────────────────────────────────────────
  describe('getUserMetricsHistory', () => {
    it('should return one aggregate entry per snapshot', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-01-01', '2026-01-28', mockUserTotals());
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const history = await getUserMetricsHistory('organization', 'test-org');
      expect(history).toHaveLength(2);
      expect(new Date(history[0].report_end_day) < new Date(history[1].report_end_day)).toBe(true);
    });

    it('should aggregate total_users and active_users correctly', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const [entry] = await getUserMetricsHistory('organization', 'test-org');
      expect(entry.total_users).toBe(2);
      // octocat has 22 active days (≥7), octokitten has 8 (≥7) → both active
      expect(entry.active_users).toBe(2);
    });

    it('should aggregate total_premium_requests', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const [entry] = await getUserMetricsHistory('organization', 'test-org');
      expect(entry.total_premium_requests).toBe(45); // only octocat has premium_requests_total=45
    });

    it('should compute avg_acceptance_rate', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const [entry] = await getUserMetricsHistory('organization', 'test-org');
      // (860+210)/(1240+350) ≈ 67.3%
      expect(entry.avg_acceptance_rate).toBeGreaterThan(0);
      expect(entry.avg_acceptance_rate).toBeLessThanOrEqual(100);
    });

    it('should return empty array when no data exists', async () => {
      const result = await getUserMetricsHistory('organization', 'unknown-org');
      expect(result).toHaveLength(0);
    });
  });

  // ── getUserTimeSeries ──────────────────────────────────────────────────────
  describe('getUserTimeSeries', () => {
    it('should return one entry per snapshot where the user appears', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-01-01', '2026-01-28', mockUserTotals());
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const series = await getUserTimeSeries('organization', 'test-org', 'octocat');
      expect(series).toHaveLength(2);
    });

    it('should return empty array for a user not in any snapshot', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const series = await getUserTimeSeries('organization', 'test-org', 'ghost');
      expect(series).toHaveLength(0);
    });

    it('should carry correct per-user stats', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const [entry] = await getUserTimeSeries('organization', 'test-org', 'octocat');
      expect(entry.total_active_days).toBe(22);
      expect(entry.premium_requests_total).toBe(45);
      expect(entry.code_generation_activity_count).toBe(1240);
    });

    it('should compute acceptance_rate per snapshot', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());

      const [entry] = await getUserTimeSeries('organization', 'test-org', 'octocat');
      // 860/1240 * 100 ≈ 69.4
      expect(entry.acceptance_rate).toBeCloseTo(69.4, 0);
    });

    it('should order entries by report_end_day ascending', async () => {
      await saveUserMetrics('organization', 'test-org', '2026-02-04', '2026-03-03', mockUserTotals());
      await saveUserMetrics('organization', 'test-org', '2026-01-01', '2026-01-28', mockUserTotals());

      const series = await getUserTimeSeries('organization', 'test-org', 'octocat');
      expect(new Date(series[0].report_end_day) < new Date(series[1].report_end_day)).toBe(true);
    });
  });
});
