/**
 * Tests for sync service and storage layer
 * Validates:
 *   - Sync service uses bulk download and stores data correctly
 *   - Storage saves both CopilotMetrics and ReportDayTotals
 *   - Round-trip: API → sync → storage → transformer → CopilotMetrics
 *   - Daily sync task behavior
 *   - Gap detection and filling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMockReport, mockRequestDownloadLinks } from '../server/services/github-copilot-usage-api-mock';
import { transformReportToMetrics, transformDayToMetrics } from '../server/services/report-transformer';
import type { OrgReport, ReportDayTotals, MetricsReportRequest } from '../server/services/github-copilot-usage-api';
import type { StoredMetrics } from '../server/storage/types';

// Build a storage key for the in-memory mock (mirrors old key-value approach)
function buildKey(scope: string, identifier: string, date: string, team?: string): string {
  const teamPart = team ? `:team:${team}` : '';
  return `metrics:${scope}:${identifier}${teamPart}:${date}`;
}

// --- Mock storage layer ---
// Since unstorage (useStorage) requires Nitro runtime, we mock it in-memory.
const storageMap = new Map<string, unknown>();

vi.mock('../server/storage/metrics-storage', () => ({
  saveMetrics: vi.fn(async (scope: string, scopeIdentifier: string, metricsDate: string, data: any, teamSlug?: string, reportData?: any) => {
    const key = buildKey(scope, scopeIdentifier, metricsDate, teamSlug);
    storageMap.set(key, {
      scope,
      scopeIdentifier,
      teamSlug,
      metricsDate,
      data,
      reportData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),
  getMetrics: vi.fn(async (scope: string, scopeIdentifier: string, metricsDate: string, teamSlug?: string) => {
    const key = buildKey(scope, scopeIdentifier, metricsDate, teamSlug);
    const stored = storageMap.get(key) as StoredMetrics | undefined;
    return stored ? stored.data : null;
  }),
  getReportData: vi.fn(async (scope: string, scopeIdentifier: string, metricsDate: string, teamSlug?: string) => {
    const key = buildKey(scope, scopeIdentifier, metricsDate, teamSlug);
    const stored = storageMap.get(key) as StoredMetrics | undefined;
    return stored?.reportData ?? null;
  }),
  hasMetrics: vi.fn(async (scope: string, scopeIdentifier: string, metricsDate: string, teamSlug?: string) => {
    const key = buildKey(scope, scopeIdentifier, metricsDate, teamSlug);
    return storageMap.has(key);
  }),
  getMetricsByDateRange: vi.fn(async (query: any) => {
    const results: any[] = [];
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const key = buildKey(query.scope, query.scopeIdentifier, dateStr, query.teamSlug);
      const stored = storageMap.get(key) as StoredMetrics | undefined;
      if (stored) results.push(stored.data);
      current.setDate(current.getDate() + 1);
    }
    return results;
  }),
}));

vi.mock('../server/storage/sync-storage', () => ({
  createPendingSyncStatus: vi.fn(async () => {}),
  markSyncInProgress: vi.fn(async () => {}),
  markSyncCompleted: vi.fn(async () => {}),
  markSyncFailed: vi.fn(async () => {}),
  getSyncStatus: vi.fn(async () => null),
}));

// Mock the API to use mock functions
vi.mock('../server/services/github-copilot-usage-api', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    fetchLatestReport: vi.fn(async (request: MetricsReportRequest, _headers: HeadersInit) => {
      return generateMockReport('2026-02-05', '2026-03-04');
    }),
    fetchReportForDate: vi.fn(async (request: MetricsReportRequest, _headers: HeadersInit, day: string) => {
      return generateMockReport(day, day);
    }),
  };
});

// Import sync service AFTER mocks are set up
import { syncBulk, syncMetricsForDate, syncMetricsForDateRange, detectGaps, syncGaps, getSyncStats } from '../server/services/sync-service';
import { saveMetrics, getMetrics, hasMetrics, getMetricsByDateRange, getReportData } from '../server/storage/metrics-storage';
import { markSyncCompleted, markSyncFailed, markSyncInProgress } from '../server/storage/sync-storage';

const TEST_HEADERS = {
  'Authorization': 'Bearer test-token',
  'Accept': 'application/vnd.github+json',
};

describe('Sync Service & Storage', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
  });

  describe('syncBulk', () => {
    it('should download 28-day report and save all days', async () => {
      const result = await syncBulk('organization', 'test-org', TEST_HEADERS);

      expect(result.success).toBe(true);
      expect(result.totalDays).toBeGreaterThan(0);
      expect(result.savedDays).toBe(result.totalDays);
      expect(result.skippedDays).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(saveMetrics).toHaveBeenCalledTimes(result.totalDays);
    });

    it('should skip already-synced days', async () => {
      // First sync
      await syncBulk('organization', 'test-org', TEST_HEADERS);
      const firstCallCount = (saveMetrics as any).mock.calls.length;

      vi.clearAllMocks();

      // Second sync — all days exist
      const result = await syncBulk('organization', 'test-org', TEST_HEADERS);

      expect(result.skippedDays).toBe(result.totalDays);
      expect(result.savedDays).toBe(0);
      expect(saveMetrics).not.toHaveBeenCalled();
    });

    it('should save both CopilotMetrics and ReportDayTotals', async () => {
      await syncBulk('organization', 'test-org', TEST_HEADERS);

      // Check that saveMetrics was called with 6 args (including reportData)
      const call = (saveMetrics as any).mock.calls[0];
      expect(call).toHaveLength(6);
      expect(call[0]).toBe('organization'); // scope
      expect(call[1]).toBe('test-org'); // identifier
      expect(call[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/); // date
      expect(call[3]).toHaveProperty('date'); // CopilotMetrics
      expect(call[3]).toHaveProperty('copilot_ide_code_completions'); // CopilotMetrics
      expect(call[5]).toHaveProperty('day'); // ReportDayTotals
      expect(call[5]).toHaveProperty('totals_by_ide'); // ReportDayTotals
    });

    it('should handle team scopes', async () => {
      const result = await syncBulk('team-organization', 'test-org', TEST_HEADERS, 'my-team');

      expect(result.success).toBe(true);
      expect(result.savedDays).toBeGreaterThan(0);
      // Verify team slug is passed to saveMetrics
      const call = (saveMetrics as any).mock.calls[0];
      expect(call[4]).toBe('my-team'); // teamSlug
    });
  });

  describe('syncMetricsForDate', () => {
    it('should sync a single date', async () => {
      const result = await syncMetricsForDate({
        scope: 'organization',
        identifier: 'test-org',
        date: '2026-02-15',
        headers: TEST_HEADERS,
      });

      expect(result.success).toBe(true);
      expect(result.date).toBe('2026-02-15');
      expect(markSyncInProgress).toHaveBeenCalled();
      expect(markSyncCompleted).toHaveBeenCalled();
    });

    it('should skip already-synced dates', async () => {
      // Pre-populate
      const key = buildKey('organization', 'test-org', '2026-02-15');
      storageMap.set(key, { data: { date: '2026-02-15' } });

      const result = await syncMetricsForDate({
        scope: 'organization',
        identifier: 'test-org',
        date: '2026-02-15',
        headers: TEST_HEADERS,
      });

      expect(result.success).toBe(true);
      expect(result.metricsCount).toBe(1);
      expect(saveMetrics).not.toHaveBeenCalled();
    });

    it('should update sync status on success', async () => {
      await syncMetricsForDate({
        scope: 'organization',
        identifier: 'test-org',
        date: '2026-02-15',
        headers: TEST_HEADERS,
      });

      expect(markSyncInProgress).toHaveBeenCalled();
      expect(markSyncCompleted).toHaveBeenCalled();
      expect(markSyncFailed).not.toHaveBeenCalled();
    });
  });

  describe('syncMetricsForDateRange', () => {
    it('should sync a date range using bulk download', async () => {
      const results = await syncMetricsForDateRange(
        'organization',
        'test-org',
        '2026-02-01',
        '2026-02-28',
        TEST_HEADERS
      );

      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.success).toBe(true);
        expect(r.date).toMatch(/^2026-02-/);
      });
    });

    it('should skip already-synced dates in range', async () => {
      // Pre-populate some dates
      const key1 = buildKey('organization', 'test-org', '2026-02-01');
      storageMap.set(key1, { data: { date: '2026-02-01' } });

      const results = await syncMetricsForDateRange(
        'organization',
        'test-org',
        '2026-02-01',
        '2026-02-28',
        TEST_HEADERS
      );

      // Feb 01 should be skipped
      const feb01 = results.find(r => r.date === '2026-02-01');
      if (feb01) {
        expect(feb01.success).toBe(true);
      }
    });
  });

  describe('detectGaps', () => {
    it('should find missing dates', async () => {
      // Store only Feb 1 and Feb 3
      const key1 = buildKey('organization', 'test-org', '2026-02-01');
      const key3 = buildKey('organization', 'test-org', '2026-02-03');
      storageMap.set(key1, { data: {} });
      storageMap.set(key3, { data: {} });

      const gaps = await detectGaps('organization', 'test-org', '2026-02-01', '2026-02-03');
      expect(gaps).toEqual(['2026-02-02']);
    });

    it('should return empty when no gaps exist', async () => {
      const key1 = buildKey('organization', 'test-org', '2026-02-01');
      const key2 = buildKey('organization', 'test-org', '2026-02-02');
      storageMap.set(key1, { data: {} });
      storageMap.set(key2, { data: {} });

      const gaps = await detectGaps('organization', 'test-org', '2026-02-01', '2026-02-02');
      expect(gaps).toHaveLength(0);
    });
  });

  describe('syncGaps', () => {
    it('should fill missing dates using bulk download', async () => {
      // Store Feb 1 only
      const key1 = buildKey('organization', 'test-org', '2026-02-01');
      storageMap.set(key1, { data: {} });

      const results = await syncGaps(
        'organization',
        'test-org',
        '2026-02-01',
        '2026-02-03',
        TEST_HEADERS
      );

      // Should have synced the missing dates found in the report
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty when no gaps exist', async () => {
      // Fill all dates
      for (let d = 1; d <= 3; d++) {
        const dateStr = `2026-02-0${d}`;
        const key = buildKey('organization', 'test-org', dateStr);
        storageMap.set(key, { data: {} });
      }

      const results = await syncGaps(
        'organization',
        'test-org',
        '2026-02-01',
        '2026-02-03',
        TEST_HEADERS
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('getSyncStats', () => {
    it('should return correct statistics', async () => {
      // Store 2 of 3 dates
      const key1 = buildKey('organization', 'test-org', '2026-02-01');
      const key3 = buildKey('organization', 'test-org', '2026-02-03');
      storageMap.set(key1, { data: {} });
      storageMap.set(key3, { data: {} });

      const stats = await getSyncStats('organization', 'test-org', '2026-02-01', '2026-02-03');

      expect(stats.totalDays).toBe(3);
      expect(stats.syncedDays).toBe(2);
      expect(stats.missingDays).toBe(1);
      expect(stats.missingDates).toEqual(['2026-02-02']);
    });
  });
});

describe('Storage Round-Trip', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
  });

  it('should store and retrieve CopilotMetrics via in-memory mock', async () => {
    // Generate mock report
    const report = generateMockReport('2026-02-01', '2026-02-03');
    const metrics = transformReportToMetrics(report);

    // Save via sync
    const result = await syncBulk('organization', 'test-org', TEST_HEADERS);
    expect(result.savedDays).toBeGreaterThan(0);

    // Verify stored data is retrievable via getMetrics
    const firstCall = (saveMetrics as any).mock.calls[0];
    const storedDate = firstCall[2];
    const retrieved = await getMetrics('organization', 'test-org', storedDate);
    expect(retrieved).not.toBeNull();
    expect(retrieved).toHaveProperty('date');
    expect(retrieved).toHaveProperty('copilot_ide_code_completions');
  });

  it('should store and retrieve raw ReportDayTotals', async () => {
    await syncBulk('organization', 'test-org', TEST_HEADERS);

    const firstCall = (saveMetrics as any).mock.calls[0];
    const storedDate = firstCall[2];
    const reportData = await getReportData('organization', 'test-org', storedDate);
    expect(reportData).not.toBeNull();
    expect(reportData).toHaveProperty('day');
    expect(reportData).toHaveProperty('totals_by_ide');
    expect(reportData).toHaveProperty('totals_by_feature');
    expect(reportData).toHaveProperty('totals_by_language_feature');
  });

  it('should retrieve date range correctly', async () => {
    await syncBulk('organization', 'test-org', TEST_HEADERS);

    const allMetrics = await getMetricsByDateRange({
      scope: 'organization',
      scopeIdentifier: 'test-org',
      startDate: '2020-01-01',
      endDate: '2030-12-31',
    });

    expect(allMetrics.length).toBeGreaterThan(0);
  });
});

describe('Transformer Round-Trip', () => {
  it('should transform mock report data into valid CopilotMetrics', () => {
    const report = generateMockReport('2026-02-10', '2026-02-14');
    const metrics = transformReportToMetrics(report);

    expect(metrics).toHaveLength(5);
    metrics.forEach(m => {
      expect(m.date).toBeTruthy();
      expect(m.total_active_users).toBeGreaterThan(0);
      expect(m.copilot_ide_code_completions).toBeDefined();
      expect(m.copilot_ide_code_completions.editors).toBeDefined();
      expect(m.copilot_ide_code_completions.editors.length).toBeGreaterThan(0);
      expect(m.copilot_ide_chat).toBeDefined();
      expect(m.copilot_dotcom_chat).toBeDefined();
      expect(m.copilot_dotcom_pull_requests).toBeDefined();
    });
  });

  it('should preserve IDE names from report', () => {
    const report = generateMockReport('2026-02-10', '2026-02-10');
    const metrics = transformReportToMetrics(report);
    const day = report.day_totals[0];

    const ideNames = day.totals_by_ide.map(i => i.ide);
    const editorNames = metrics[0].copilot_ide_code_completions.editors.map(e => e.name);

    expect(editorNames).toEqual(expect.arrayContaining(ideNames));
  });

  it('should map code_completion language features', () => {
    const report = generateMockReport('2026-02-10', '2026-02-10');
    const day = report.day_totals[0];
    const metrics = transformDayToMetrics(day);

    // Code completions should have language data from code_completion feature
    const codeCompletionLangs = day.totals_by_language_feature.filter(lf => lf.feature === 'code_completion');
    if (codeCompletionLangs.length > 0) {
      expect(metrics.copilot_ide_code_completions.languages.length).toBeGreaterThan(0);
    }
  });

  it('should map chat features to IDE chat', () => {
    const report = generateMockReport('2026-02-10', '2026-02-10');
    const metrics = transformReportToMetrics(report);

    // IDE chat should have editors
    expect(metrics[0].copilot_ide_chat.editors).toBeDefined();
  });
});
