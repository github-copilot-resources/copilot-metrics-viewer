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

vi.mock('../server/storage/user-day-metrics-storage', () => ({
  getUserDayMetricsByDateRange: (...args: any[]) => mockGetUserDayMetrics(...args),
  saveUserDayMetricsBatch: (...args: any[]) => mockSaveUserDayBatch(...args),
  hasUserDayMetricsForDate: vi.fn(async () => false),
}));

const mockFetchAllTeamMembers = vi.fn();

vi.mock('../server/api/seats', () => ({
  fetchAllTeamMembers: (...args: any[]) => mockFetchAllTeamMembers(...args),
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
});
