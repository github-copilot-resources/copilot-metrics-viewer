// @vitest-environment node
/**
 * Route-level integration test for the admin drill-down branch of
 * GET /api/my-usage. When called with `?login=<other>` the handler must:
 *   - refuse (403) if the caller is not on the usage admin allowlist
 *   - swap the user filter to <other> once admin is verified
 *   - mark the response `viewingAsAdmin: true` so the client swaps headers
 *   - leave the default (session-user) path untouched
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).defineEventHandler = (h: any) => h;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: any = new Error(statusMessage);
    err.statusCode = statusCode;
    return err;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).getQuery = () => (globalThis as any).__test_query || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).getUserSession = async () => (globalThis as any).__test_session || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).$fetch = vi.fn();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setQuery(q: Record<string, string>) { (globalThis as any).__test_query = q; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setConfig(c: Record<string, unknown>) { (globalThis as any).__test_config = c; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setSession(s: unknown) { (globalThis as any).__test_session = s; }

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

import handler from '../server/api/my-usage.get';

const mockIsAdmin = vi.fn();
vi.mock('../server/utils/usage-admin', () => ({
  isUsageAdminForEvent: (...a: unknown[]) => mockIsAdmin(...a),
}));

// Neutralize the live-metrics fetch — return an empty per-user report so the
// handler falls through to `totals: null`, `dayRecords: []`. We only care about
// which login the report was filtered against, which is echoed in `user.login`.
vi.mock('../server/services/github-copilot-usage-api', async () => ({
  fetchLatestUserReport: vi.fn(async () => ({
    user_totals: [],
    day_totals: [],
    report_start_day: '2026-06-01',
    report_end_day: '2026-06-28',
  })),
  fetchRawUserDayRecords: vi.fn(async () => []),
  aggregateUserDayRecords: vi.fn(() => []),
}));

vi.mock('../server/storage/user-day-metrics-storage', () => ({
  getUserDayMetricsByDateRange: vi.fn(async () => []),
}));
vi.mock('../server/storage/db', () => ({
  isDbConfigured: () => false,
}));

// Fake event with the fields the handler touches: context.headers (used for
// bearer-token detection) and nothing else. All API calls are mocked.
function makeEvent() {
  return {
    context: {
      headers: {
        has: (h: string) => h.toLowerCase() === 'authorization',
        get: () => 'Bearer test-tok',
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setConfig({
    githubToken: 'tok',
    githubBillingToken: '',
    public: { githubOrg: 'octodemo' },
  });
  setSession(null);
});

describe('GET /api/my-usage — admin drill-down', () => {
  it('pins to the session user when no ?login is supplied', async () => {
    setSession({ user: { login: 'alice', email: 'alice@example.com' } });
    setQuery({ scope: 'organization', githubOrg: 'octodemo' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handler(makeEvent() as any);

    expect(result.user.login).toBe('alice');
    expect(result.viewingAsAdmin).toBe(false);
    expect(mockIsAdmin).not.toHaveBeenCalled();
  });

  it('lets an admin view another user via ?login=<other>', async () => {
    setSession({ user: { login: 'alice', email: 'alice@example.com' } });
    mockIsAdmin.mockResolvedValueOnce(true);
    setQuery({ scope: 'organization', githubOrg: 'octodemo', login: 'bob' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handler(makeEvent() as any);

    expect(mockIsAdmin).toHaveBeenCalledOnce();
    expect(result.user.login).toBe('bob');
    // Email must be cleared — we do not leak the requester's email onto the
    // response for a different user.
    expect(result.user.email).toBeUndefined();
    expect(result.viewingAsAdmin).toBe(true);
  });

  it('rejects ?login=<other> with 403 when the caller is not an admin', async () => {
    setSession({ user: { login: 'alice' } });
    mockIsAdmin.mockResolvedValueOnce(false);
    setQuery({ scope: 'organization', githubOrg: 'octodemo', login: 'bob' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(handler(makeEvent() as any)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('treats ?login=<self> as the default path (no admin check, no drill-down flag)', async () => {
    setSession({ user: { login: 'alice' } });
    setQuery({ scope: 'organization', githubOrg: 'octodemo', login: 'ALICE' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handler(makeEvent() as any);

    expect(mockIsAdmin).not.toHaveBeenCalled();
    expect(result.user.login).toBe('alice');
    expect(result.viewingAsAdmin).toBe(false);
  });

  it('mock-mode fallback still works — no session, no ?login, returns fixture user', async () => {
    setSession(null);
    setQuery({ scope: 'organization', githubOrg: 'octodemo', isDataMocked: 'true' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handler(makeEvent() as any);
    expect(result.user.login).toBe('octocat');
    expect(result.viewingAsAdmin).toBe(false);
  });

  it('PAT-only admin (no OAuth session) can drill down via ?login=<other>', async () => {
    // In PAT-only deployments there is no OAuth session, but the operator
    // is admin-by-PAT. The Billing tab drill-down must still work — the
    // 401-no-session guard must NOT fire when ?login is supplied and the
    // caller passes the admin check.
    setSession(null);
    mockIsAdmin.mockResolvedValueOnce(true);
    setQuery({ scope: 'organization', githubOrg: 'octodemo', login: 'bob' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await handler(makeEvent() as any);

    expect(mockIsAdmin).toHaveBeenCalledOnce();
    expect(result.user.login).toBe('bob');
    expect(result.viewingAsAdmin).toBe(true);
  });

  it('PAT-only non-admin (no OAuth session) is rejected with 403 on ?login=<other>', async () => {
    setSession(null);
    mockIsAdmin.mockResolvedValueOnce(false);
    setQuery({ scope: 'organization', githubOrg: 'octodemo', login: 'bob' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(handler(makeEvent() as any)).rejects.toMatchObject({ statusCode: 403 });
  });
});
