/**
 * Regression tests for getMetricsDataV2 — historical mode team path.
 *
 * Bug: the line `const userDayRecords = await getUserDayMetricsByDateRange(...)`
 * had the function name accidentally deleted, leaving `userDayRecords` undeclared.
 * Any request with `githubTeam` + `ENABLE_HISTORICAL_MODE=true` would crash with
 * a ReferenceError and return HTTP 500.
 *
 * These tests verify:
 *   1. The team path resolves without throwing a ReferenceError.
 *   2. When the DB has per-day records, metrics are aggregated and returned.
 *   3. When the DB is empty the function falls back (auth required — 401 without token).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UserDayRecord } from '../server/services/github-copilot-usage-api';

// ── Nitro/H3 global stubs ─────────────────────────────────────────────────────
// These must be installed BEFORE any module that calls getQuery / createError is imported.

;(globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
  const err: any = new Error(statusMessage);
  err.statusCode = statusCode;
  return err;
};

;(globalThis as any).useRuntimeConfig = () => ({
  public: { enableHistoricalMode: false }, // overridden per-test via env
});

;(globalThis as any).getHeader = (event: any, name: string) => {
  if (event?.context?.headers instanceof Headers) return event.context.headers.get(name);
  return null;
};

let _mockQuery: Record<string, string> = {};
;(globalThis as any).getQuery = (_event: any) => _mockQuery;

// ── Per-module mocks ──────────────────────────────────────────────────────────

const mockGetUserDayMetrics = vi.fn();
const mockSaveUserDayBatch = vi.fn();
const mockFetchLatestReport = vi.fn();
const mockFetchRawUserDayRecords = vi.fn();
const mockAggregateTeamMetrics = vi.fn();

vi.mock('../server/storage/user-day-metrics-storage', () => ({
  getUserDayMetricsByDateRange: (...args: any[]) => mockGetUserDayMetrics(...args),
  saveUserDayMetricsBatch: (...args: any[]) => mockSaveUserDayBatch(...args),
  hasUserDayMetricsForDate: vi.fn(async () => false),
}));

const mockFetchAllTeamMembers = vi.fn();

vi.mock('../server/api/seats', () => ({
  fetchAllTeamMembers: (...args: any[]) => mockFetchAllTeamMembers(...args),
}));

vi.mock('../server/services/github-copilot-usage-api', () => ({
  fetchLatestReport: (...args: any[]) => mockFetchLatestReport(...args),
  fetchRawUserDayRecords: (...args: any[]) => mockFetchRawUserDayRecords(...args),
}));

vi.mock('../server/services/user-metrics-aggregator', () => ({
  aggregateTeamMetrics: (...args: any[]) => mockAggregateTeamMetrics(...args),
}));

// Storage metrics mocks (org-level path — not used in team path but must resolve)
vi.mock('../server/storage/metrics-storage', () => ({
  getMetricsByDateRange: vi.fn(async () => []),
  getReportDataByDateRange: vi.fn(async () => []),
  saveMetrics: vi.fn(async () => {}),
}));

// ── Sample data ───────────────────────────────────────────────────────────────

function makeDayRecord(login: string, day: string): UserDayRecord {
  return {
    report_start_day: day,
    report_end_day: day,
    day,
    organization_id: '100001',
    enterprise_id: '',
    user_id: 42,
    user_login: login,
    user_initiated_interaction_count: 10,
    code_generation_activity_count: 50,
    code_acceptance_activity_count: 30,
    loc_suggested_to_add_sum: 200,
    loc_suggested_to_delete_sum: 10,
    loc_added_sum: 150,
    loc_deleted_sum: 5,
    totals_by_feature: [
      {
        feature: 'code_completion',
        user_initiated_interaction_count: 0,
        code_generation_activity_count: 50,
        code_acceptance_activity_count: 30,
        loc_suggested_to_add_sum: 200,
        loc_suggested_to_delete_sum: 10,
        loc_added_sum: 150,
        loc_deleted_sum: 5,
      },
    ],
    totals_by_ide: [],
    totals_by_language_feature: [],
    totals_by_model_feature: [],
  };
}

/** Minimal H3-like event — team queries always supply an auth header */
function makeEvent(withAuth = true): any {
  const headers = new Headers();
  if (withAuth) headers.set('Authorization', 'Bearer test-token');
  return { context: { headers }, node: { req: { url: '/api/metrics' } } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getMetricsDataV2 — historical mode team path (regression for 500 bug)', () => {
  const ORIGINAL_HISTORICAL = process.env.ENABLE_HISTORICAL_MODE;
  const ORIGINAL_MOCKED = process.env.NUXT_PUBLIC_IS_DATA_MOCKED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_HISTORICAL_MODE = 'true';
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'false';
    _mockQuery = {
      scope: 'organization',
      githubOrg: 'test-org',
      githubTeam: 'the-a-team',
      since: '2026-03-01',
      until: '2026-03-28',
    };
    mockFetchAllTeamMembers.mockResolvedValue([
      { login: 'octocat', id: 1 },
      { login: 'octokitten', id: 2 },
    ]);
    mockFetchLatestReport.mockResolvedValue({ day_totals: [] });
    mockFetchRawUserDayRecords.mockResolvedValue([]);
    mockAggregateTeamMetrics.mockImplementation((_records: UserDayRecord[], _teamLogins: Set<string>) => ({
      report_start_day: '2026-03-15',
      report_end_day: '2026-03-15',
      organization_id: '100001',
      enterprise_id: '',
      created_at: '2026-03-15T00:00:00.000Z',
      day_totals: [{
        day: '2026-03-15',
        organization_id: '100001',
        enterprise_id: '',
        daily_active_users: 1,
        weekly_active_users: 1,
        monthly_active_users: 1,
        monthly_active_chat_users: 0,
        monthly_active_agent_users: 0,
        user_initiated_interaction_count: 1,
        code_generation_activity_count: 1,
        code_acceptance_activity_count: 1,
        totals_by_ide: [],
        totals_by_feature: [],
        totals_by_language_feature: [],
        totals_by_language_model: [],
        totals_by_model_feature: [],
        loc_suggested_to_add_sum: 1,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 1,
        loc_deleted_sum: 0,
      }],
    }));
  });

  afterEach(() => {
    if (ORIGINAL_HISTORICAL === undefined) delete process.env.ENABLE_HISTORICAL_MODE;
    else process.env.ENABLE_HISTORICAL_MODE = ORIGINAL_HISTORICAL;
    if (ORIGINAL_MOCKED === undefined) delete process.env.NUXT_PUBLIC_IS_DATA_MOCKED;
    else process.env.NUXT_PUBLIC_IS_DATA_MOCKED = ORIGINAL_MOCKED;
    vi.resetModules();
  });

  it('returns aggregated metrics (not a ReferenceError / 500) when DB has per-day records', async () => {
    // DB returns per-day records for both team members
    mockGetUserDayMetrics.mockResolvedValue([
      makeDayRecord('octocat', '2026-03-15'),
      makeDayRecord('octocat', '2026-03-16'),
      makeDayRecord('octokitten', '2026-03-15'),
    ]);

    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');
    const result = await getMetricsDataV2(makeEvent(true));

    // Should return valid metrics without crashing
    expect(result).toBeDefined();
    expect(result).toHaveProperty('metrics');
    expect(Array.isArray(result.metrics)).toBe(true);

    // getUserDayMetricsByDateRange must have been called (was the missing call)
    expect(mockGetUserDayMetrics).toHaveBeenCalledWith(
      'organization',
      'test-org',
      '2026-03-01',
      '2026-03-28',
    );
  });

  it('throws 401 (not 500/ReferenceError) when DB is empty and no auth token', async () => {
    // DB has no records — falls through to live API fetch path
    mockGetUserDayMetrics.mockResolvedValue([]);

    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');
    await expect(getMetricsDataV2(makeEvent(false))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('returns empty result when team has no members', async () => {
    mockFetchAllTeamMembers.mockResolvedValue([]);

    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');
    const result = await getMetricsDataV2(makeEvent(true));

    expect(result.metrics).toEqual([]);
    expect(result.reportData).toEqual([]);
    // DB should NOT be queried when team is empty
    expect(mockGetUserDayMetrics).not.toHaveBeenCalled();
  });

  it('in direct mode uses team-scoped aggregate report before fallback path', async () => {
    process.env.ENABLE_HISTORICAL_MODE = 'false';
    mockGetUserDayMetrics.mockResolvedValue([]);
    mockFetchLatestReport.mockResolvedValue({
      report_start_day: '2026-03-15',
      report_end_day: '2026-03-15',
      organization_id: '100001',
      enterprise_id: '',
      created_at: '2026-03-15T00:00:00.000Z',
      day_totals: [{
        day: '2026-03-15',
        organization_id: '100001',
        enterprise_id: '',
        daily_active_users: 2,
        weekly_active_users: 2,
        monthly_active_users: 2,
        monthly_active_chat_users: 0,
        monthly_active_agent_users: 0,
        user_initiated_interaction_count: 2,
        code_generation_activity_count: 2,
        code_acceptance_activity_count: 2,
        totals_by_ide: [],
        totals_by_feature: [],
        totals_by_language_feature: [],
        totals_by_language_model: [],
        totals_by_model_feature: [],
        loc_suggested_to_add_sum: 2,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 2,
        loc_deleted_sum: 0,
      }],
    });

    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');
    const result = await getMetricsDataV2(makeEvent(true));

    expect(result.reportData).toHaveLength(1);
    expect(mockFetchLatestReport).toHaveBeenCalledWith(
      expect.objectContaining({ teamSlug: 'the-a-team' }),
      expect.any(Headers),
    );
    expect(mockFetchAllTeamMembers).not.toHaveBeenCalled();
    expect(mockFetchRawUserDayRecords).not.toHaveBeenCalled();
  });

  it('in direct mode falls back to user-day aggregation when team-scoped report is empty', async () => {
    process.env.ENABLE_HISTORICAL_MODE = 'false';
    mockFetchLatestReport.mockResolvedValue({
      report_start_day: '',
      report_end_day: '',
      organization_id: '100001',
      enterprise_id: '',
      created_at: '2026-03-15T00:00:00.000Z',
      day_totals: [],
    });
    mockFetchRawUserDayRecords.mockResolvedValue([
      makeDayRecord('octocat', '2026-03-15'),
    ]);

    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');
    const result = await getMetricsDataV2(makeEvent(true));

    expect(result.reportData).toHaveLength(1);
    expect(mockFetchAllTeamMembers).toHaveBeenCalled();
    expect(mockFetchRawUserDayRecords).toHaveBeenCalled();
    expect(mockAggregateTeamMetrics).toHaveBeenCalled();
  });
});
