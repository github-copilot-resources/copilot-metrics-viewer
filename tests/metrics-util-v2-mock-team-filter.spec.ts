/**
 * Regression test for the mock-mode team-comparison bug.
 *
 * Bug: when comparing two teams (e.g. `?githubTeam=the-a-team` vs
 * `?githubTeam=qa-team`) in mock mode, both requests returned the SAME totals.
 * The mock path never filtered by team — it returned the org-wide aggregate
 * for every team. (Direct API mode had a parallel issue caused by the
 * `?team_slug=` query param being silently ignored by GitHub.)
 *
 * Fix:
 *   - Mock path now resolves team membership and aggregates per-user records.
 *   - Membership resolves via the new `user-teams-1-day` report when the
 *     team is large enough (≥5 seats), otherwise it falls back to the REST
 *     teams API (fetchAllTeamMembers).
 *
 * This test wires up the *real* implementation of getMetricsDataV2 in mock
 * mode and only mocks the HTTP fetch ($fetch) so the mock JSON files under
 * public/mock-data/new-api/ are exercised end-to-end.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Nitro/H3 stubs
;(globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
  const err: any = new Error(statusMessage);
  err.statusCode = statusCode;
  return err;
};

;(globalThis as any).useRuntimeConfig = () => ({
  public: { enableHistoricalMode: false, isDataMocked: true },
});

;(globalThis as any).getHeader = (event: any, name: string) => {
  if (event?.context?.headers instanceof Headers) return event.context.headers.get(name);
  return null;
};

let _mockQuery: Record<string, string> = {};
;(globalThis as any).getQuery = (_event: any) => _mockQuery;
;(globalThis as any).defineEventHandler = (handler: any) => handler;

// `pg` is loaded transitively via server/storage/*.ts modules but its CJS
// shape crashes vitest's ESM loader. Stub the module — mock mode never
// actually calls into pg, so a no-op stub is sufficient.
vi.mock('pg', () => ({
  default: { Pool: class { connect() { return Promise.resolve(); } end() { return Promise.resolve(); } } },
  Pool: class { connect() { return Promise.resolve(); } end() { return Promise.resolve(); } },
}));

// Storage modules aren't used in mock mode but their CJS `pg` import crashes
// the ESM test loader if they're actually loaded. Stub them out.
vi.mock('../server/storage/user-day-metrics-storage', () => ({
  getUserDayMetricsByDateRange: vi.fn(async () => []),
  saveUserDayMetricsBatch: vi.fn(async () => {}),
  hasUserDayMetricsForDate: vi.fn(async () => false),
}));
vi.mock('../server/storage/metrics-storage', () => ({
  getMetricsByDateRange: vi.fn(async () => []),
  getReportDataByDateRange: vi.fn(async () => []),
  saveMetrics: vi.fn(async () => {}),
}));
vi.mock('../server/storage/seats-storage', () => ({
  getLatestSeats: vi.fn(async () => []),
  saveSeats: vi.fn(async () => {}),
}));

// Mock $fetch / ofetch so download URLs resolve to the local mock files
// instead of hitting localhost (no dev server is running in unit tests).
function loadMockFile(filename: string): string {
  const path = resolve(process.cwd(), 'public', 'mock-data', 'new-api', filename);
  if (!existsSync(path)) {
    throw new Error(`Mock file missing: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

const fetchImpl = vi.fn(async (url: string) => {
  // Match against the trailing filename in the mock URL
  const m = url.match(/\/mock-data\/new-api\/([^?]+)/);
  if (!m) {
    throw new Error(`Unexpected fetch in mock-mode test: ${url}`);
  }
  const filename = m[1]!;
  const content = loadMockFile(filename);
  // The download endpoints in github-copilot-usage-api always set
  // responseType: 'text', so we return the raw string.
  return content;
});

vi.mock('ofetch', () => ({
  $fetch: fetchImpl,
}));

(globalThis as any).$fetch = fetchImpl;

function makeEvent(): any {
  return { context: { headers: new Headers() }, node: { req: { url: '/api/metrics' } } };
}

function totalsSummary(reportData: any[]) {
  return reportData.reduce(
    (acc, d) => ({
      interactions: acc.interactions + (d.user_initiated_interaction_count ?? 0),
      generations: acc.generations + (d.code_generation_activity_count ?? 0),
      acceptances: acc.acceptances + (d.code_acceptance_activity_count ?? 0),
    }),
    { interactions: 0, generations: 0, acceptances: 0 },
  );
}

describe('getMetricsDataV2 — mock-mode team comparison regression', () => {
  const ORIGINAL_MOCKED = process.env.NUXT_PUBLIC_IS_DATA_MOCKED;
  const ORIGINAL_HISTORICAL = process.env.ENABLE_HISTORICAL_MODE;

  beforeEach(() => {
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'true';
    process.env.ENABLE_HISTORICAL_MODE = 'false';
    fetchImpl.mockClear();
  });

  afterEach(() => {
    if (ORIGINAL_MOCKED === undefined) delete process.env.NUXT_PUBLIC_IS_DATA_MOCKED;
    else process.env.NUXT_PUBLIC_IS_DATA_MOCKED = ORIGINAL_MOCKED;
    if (ORIGINAL_HISTORICAL === undefined) delete process.env.ENABLE_HISTORICAL_MODE;
    else process.env.ENABLE_HISTORICAL_MODE = ORIGINAL_HISTORICAL;
    vi.resetModules();
  });

  it('returns different totals for different teams in mock mode', async () => {
    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');

    // the-a-team: monalisa, defunkt, octocat, octokitten, newjoiner
    _mockQuery = { scope: 'organization', githubOrg: 'mocked-org', githubTeam: 'the-a-team', isDataMocked: 'true' };
    const aResult = await getMetricsDataV2(makeEvent());

    // qa-team: hubot, alicechen, bobmartinez (disjoint from the-a-team)
    _mockQuery = { scope: 'organization', githubOrg: 'mocked-org', githubTeam: 'qa-team', isDataMocked: 'true' };
    const qaResult = await getMetricsDataV2(makeEvent());

    const aTotals = totalsSummary(aResult.reportData);
    const qaTotals = totalsSummary(qaResult.reportData);

    // Both teams should have at least some activity from the mock data
    expect(aTotals.interactions).toBeGreaterThan(0);
    expect(qaTotals.interactions).toBeGreaterThan(0);

    // The bug was that both calls returned the same numbers (org-wide totals).
    // After the fix, the totals must differ because the teams have disjoint
    // membership.
    expect(aTotals).not.toEqual(qaTotals);
  });

  it('uses the user-teams-1-day report for the-a-team (≥5 seats)', async () => {
    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');

    _mockQuery = { scope: 'organization', githubOrg: 'mocked-org', githubTeam: 'the-a-team', isDataMocked: 'true' };
    await getMetricsDataV2(makeEvent());

    // the-a-team has 5 mock seats so it appears in the user-teams report —
    // the user-teams mock file must have been fetched at least once.
    const fetchedUrls = fetchImpl.mock.calls.map(c => c[0] as string);
    expect(fetchedUrls.some(u => u.includes('organization-user-teams-1-day-report.json'))).toBe(true);
  });

  it('falls back to REST teams API for qa-team (only 3 seats — absent from user-teams report)', async () => {
    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');

    _mockQuery = { scope: 'organization', githubOrg: 'mocked-org', githubTeam: 'qa-team', isDataMocked: 'true' };
    const result = await getMetricsDataV2(makeEvent());

    // qa-team membership is hubot + alicechen + bobmartinez — all three have
    // usage in the mock users-28-day report. Verify the fallback path
    // produced non-empty data.
    const totals = totalsSummary(result.reportData);
    expect(totals.interactions).toBeGreaterThan(0);
  });

  it('returns org-wide totals when no team is specified (sanity check — non-team path unchanged)', async () => {
    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');

    _mockQuery = { scope: 'organization', githubOrg: 'mocked-org', isDataMocked: 'true' };
    const result = await getMetricsDataV2(makeEvent());

    const totals = totalsSummary(result.reportData);
    expect(totals.interactions).toBeGreaterThan(0);
    // The user-teams report should NOT be fetched on the org-wide path
    const fetchedUrls = fetchImpl.mock.calls.map(c => c[0] as string);
    expect(fetchedUrls.some(u => u.includes('organization-user-teams-1-day-report.json'))).toBe(false);
  });

  it('returns non-empty team data when a rolling last-28-days since/until window is applied', async () => {
    // Regression test for the UI's default behavior — DateRangeSelector emits
    // a rolling "last 28 days" since/until on mount. The mock user-day JSON
    // file has hardcoded dates that fall outside that window, so without
    // date-shifting the team filter would drop ALL records and the UI would
    // show empty charts.
    const { getMetricsDataV2 } = await import('../shared/utils/metrics-util-v2');

    const today = new Date();
    const until = today.toISOString().split('T')[0]!;
    const since = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    _mockQuery = {
      scope: 'organization',
      githubOrg: 'mocked-org',
      githubTeam: 'the-a-team',
      isDataMocked: 'true',
      since,
      until,
    };
    const result = await getMetricsDataV2(makeEvent());

    const totals = totalsSummary(result.reportData);
    expect(totals.interactions).toBeGreaterThan(0);
  });
});
