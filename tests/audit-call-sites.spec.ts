// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
  (globalThis as any).getUserSession = async () => (globalThis as any).__test_session || null;
  (globalThis as any).defineEventHandler = (h: any) => h;
  (globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
    const err: any = new Error(statusMessage);
    err.statusCode = statusCode;
    return err;
  };
  (globalThis as any).getQuery = () => (globalThis as any).__test_query || {};
  (globalThis as any).$fetch = vi.fn();
});

const { mockEmitAuditEvent } = vi.hoisted(() => ({
  mockEmitAuditEvent: vi.fn(),
}));

vi.mock('../server/utils/audit', () => ({
  emitAuditEvent: mockEmitAuditEvent,
}));

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

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

import { isUserAuthorized } from '../server/utils/authorization';
import { requireUsageAdmin } from '../server/utils/usage-admin';
import myUsageHandler from '../server/api/my-usage.get';

function setConfig(config: Record<string, unknown>) {
  (globalThis as any).__test_config = config;
}

function setSession(session: unknown) {
  (globalThis as any).__test_session = session;
}

function setQuery(query: Record<string, string>) {
  (globalThis as any).__test_query = query;
}

function makeEvent() {
  return { context: { headers: new Headers({ authorization: 'token test' }) } } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  setConfig({
    auditLogEnabled: 'true',
    authorizedUsers: 'alice',
    authorizedEmailDomains: '',
    usageAdmins: 'admin',
    public: { requireAuth: true, githubOrg: 'octodemo' },
  });
  setSession(null);
  setQuery({});
});

describe('audit call sites', () => {
  it('emits auth.login.denied for OAuth allowlist denials', () => {
    mockEmitAuditEvent.mockResolvedValue(undefined);
    const event = makeEvent();
    expect(isUserAuthorized(event, { login: 'bob', email: 'bob@example.com' })).toBe(false);
    expect(mockEmitAuditEvent).toHaveBeenCalledWith(
      'auth.login.denied',
      expect.objectContaining({
        action: 'login',
        outcome: 'deny',
        target: 'bob',
      }),
      event
    );
  });

  it('emits authz.admin.denied and authz.admin.granted from requireUsageAdmin', async () => {
    mockEmitAuditEvent.mockResolvedValue(undefined);
    setSession({ user: { login: 'bob' } });
    await expect(requireUsageAdmin(makeEvent())).rejects.toMatchObject({ statusCode: 403 });
    expect(mockEmitAuditEvent).toHaveBeenCalledWith(
      'authz.admin.denied',
      expect.objectContaining({ action: 'usage-admin', outcome: 'deny' }),
      expect.anything()
    );

    mockEmitAuditEvent.mockClear();
    setSession({ user: { login: 'admin' } });
    await expect(requireUsageAdmin(makeEvent())).resolves.toBeUndefined();
    expect(mockEmitAuditEvent).toHaveBeenCalledWith(
      'authz.admin.granted',
      expect.objectContaining({ action: 'usage-admin', outcome: 'allow' }),
      expect.anything()
    );
  });

  it('emits user_data.viewed for admin drill-down data access', async () => {
    mockEmitAuditEvent.mockResolvedValue(undefined);
    setSession({ user: { login: 'admin' } });
    setQuery({ scope: 'organization', githubOrg: 'octodemo', login: 'bob' });

    const result = await myUsageHandler(makeEvent());
    expect(result.viewingAsAdmin).toBe(true);
    expect(mockEmitAuditEvent).toHaveBeenCalledWith(
      'user_data.viewed',
      expect.objectContaining({
        action: 'view',
        outcome: 'allow',
        target: 'bob',
      }),
      expect.anything()
    );
  });
});
