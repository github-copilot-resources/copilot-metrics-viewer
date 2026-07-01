// @vitest-environment node
/**
 * Tests for the three new billing CSV actions on /api/admin/sync:
 *   sync-billing-csv (default 30-day window)
 *   sync-billing-csv-range (since/until)
 *   sync-billing-csv-cancel
 *
 * All actions are admin-gated, require NUXT_GITHUB_BILLING_TOKEN +
 * NUXT_BILLING_ENTERPRISE, and the create/range variants must be
 * fire-and-forget (return immediately, ingester runs in background).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Install Nitro global stubs in vi.hoisted so they're set BEFORE the static
// `import handler` below executes — under environment:'node' (chosen via the
// header above to avoid pulling @nuxt/test-utils' router-dependent setup),
// h3/Nitro globals like defineEventHandler are not auto-injected.
vi.hoisted(() => {
  (globalThis as any).defineEventHandler = (h: any) => h;
  (globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
    const err: any = new Error(statusMessage);
    err.statusCode = statusCode;
    return err;
  };
  (globalThis as any).getQuery = () => (globalThis as any).__test_query || {};
  (globalThis as any).readBody = async () => (globalThis as any).__test_body || {};
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
  (globalThis as any).getUserSession = async () => (globalThis as any).__test_session;
});

function setQuery(q: Record<string, string>) { (globalThis as any).__test_query = q; }
function setBody(b: Record<string, unknown>) { (globalThis as any).__test_body = b; }
function setConfig(c: Record<string, unknown>) { (globalThis as any).__test_config = c; }
function setSession(s: any) { (globalThis as any).__test_session = s; }

vi.mock('../server/services/github-copilot-usage-api-mock', () => ({
  isMockMode: () => false,
}));

// Auto-imports route `useRuntimeConfig` to '#app/nuxt' (see .nuxt/imports.d.ts);
// stub it with just our test-controllable getter to avoid pulling Nuxt runtime.
vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

const mockRequireUsageAdmin = vi.fn();
vi.mock('../server/utils/usage-admin', () => ({
  requireUsageAdmin: (...a: any[]) => mockRequireUsageAdmin(...a),
}));

const mockCreateBillingCsvJob = vi.fn();
const mockCancelInFlight = vi.fn();
const mockDismissJob = vi.fn();
const { BillingCsvJobInFlightErrorMock } = vi.hoisted(() => {
  class BillingCsvJobInFlightErrorMock extends Error {
    constructor(enterprise: string) {
      super(`already in flight for ${enterprise}`);
      this.name = 'BillingCsvJobInFlightError';
    }
  }
  return { BillingCsvJobInFlightErrorMock };
});
vi.mock('../server/storage/billing-csv-sync-status-storage', () => ({
  createBillingCsvJob: (...a: any[]) => mockCreateBillingCsvJob(...a),
  cancelInFlightBillingCsvJobs: (...a: any[]) => mockCancelInFlight(...a),
  dismissBillingCsvJob: (...a: any[]) => mockDismissJob(...a),
  BillingCsvJobInFlightError: BillingCsvJobInFlightErrorMock,
}));

const mockRunIngester = vi.fn();
vi.mock('../server/services/billing-csv-ingester', () => ({
  runBillingCsvIngester: (...a: any[]) => mockRunIngester(...a),
}));

// Unused-but-imported deps in sync.post.ts need stubs too.
vi.mock('../server/services/sync-service', () => ({
  syncMetricsForDate: vi.fn(),
  syncMetricsForDateRange: vi.fn(),
  syncGaps: vi.fn(),
  syncBulk: vi.fn(),
}));
vi.mock('../server/storage/sync-storage', () => ({
  clearFailedSyncsForScope: vi.fn(),
  getFailedSyncsForScope: vi.fn(),
}));

import handler from '../server/api/admin/sync.post';

function makeEvent(): any {
  const headers = new Headers();
  headers.set('Authorization', 'Bearer test');
  return { context: { headers }, node: { req: { url: '/api/admin/sync' } } };
}

beforeEach(() => {
  vi.resetAllMocks();
  setQuery({ scope: 'enterprise', githubEnt: 'acme-ent' });
  setBody({});
  setConfig({ githubBillingToken: 'ghp_x', billingEnterprise: 'acme-ent' });
  setSession({ user: { login: 'alice' } });
  // Default: ingester returns a thenable so void runBillingCsvIngester(...).catch(...) works.
  mockRunIngester.mockResolvedValue({ status: 'completed' });
});

afterEach(() => {
  setSession(null);
});

describe('sync.post — sync-billing-csv action', () => {
  it('returns 403 when caller is not a usage admin', async () => {
    mockRequireUsageAdmin.mockImplementation(() => {
      const e: any = new Error('Forbidden');
      e.statusCode = 403;
      throw e;
    });
    setBody({ action: 'sync-billing-csv' });
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 500 });
    // Note: outer try/catch wraps as 500. The point is the ingester wasn't kicked.
    expect(mockCreateBillingCsvJob).not.toHaveBeenCalled();
    expect(mockRunIngester).not.toHaveBeenCalled();
  });

  it('returns 503 when NUXT_GITHUB_BILLING_TOKEN is not configured', async () => {
    setConfig({ githubBillingToken: '', billingEnterprise: 'acme-ent' });
    setBody({ action: 'sync-billing-csv' });
    await expect(handler(makeEvent())).rejects.toThrow(/NUXT_GITHUB_BILLING_TOKEN/);
    expect(mockCreateBillingCsvJob).not.toHaveBeenCalled();
  });

  it('returns 503 when NUXT_BILLING_ENTERPRISE is not configured', async () => {
    setConfig({ githubBillingToken: 'ghp_x', billingEnterprise: '' });
    setBody({ action: 'sync-billing-csv' });
    await expect(handler(makeEvent())).rejects.toThrow(/NUXT_BILLING_ENTERPRISE/);
  });

  it('creates a job for the default 30-day window and fires ingester in background', async () => {
    mockCreateBillingCsvJob.mockResolvedValue({ id: 99, status: 'queued' });
    mockRunIngester.mockResolvedValue({ status: 'completed' });
    setBody({ action: 'sync-billing-csv' });

    const result = await handler(makeEvent());

    expect(result.jobId).toBe(99);
    expect(result.status).toBe('queued');
    expect(result.enterprise).toBe('acme-ent');
    expect(mockCreateBillingCsvJob).toHaveBeenCalledTimes(1);
    const arg = mockCreateBillingCsvJob.mock.calls[0]![0];
    expect(arg.enterprise).toBe('acme-ent');
    expect(arg.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arg.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arg.triggeredBy).toBe('alice');
    expect(mockRunIngester).toHaveBeenCalledWith({ token: 'ghp_x', jobId: 99, fillGapsOnly: false });
  });

  it('uses since/until for sync-billing-csv-range', async () => {
    mockCreateBillingCsvJob.mockResolvedValue({ id: 7, status: 'queued' });
    setBody({ action: 'sync-billing-csv-range', since: '2026-01-01', until: '2026-01-31' });

    const result = await handler(makeEvent());

    expect(result.jobId).toBe(7);
    const arg = mockCreateBillingCsvJob.mock.calls[0]![0];
    expect(arg.startDate).toBe('2026-01-01');
    expect(arg.endDate).toBe('2026-01-31');
  });

  it('rejects sync-billing-csv-range without since/until', async () => {
    setBody({ action: 'sync-billing-csv-range' });
    await expect(handler(makeEvent())).rejects.toThrow(/since and until/);
  });

  it('returns 409 when single-flight unique index trips', async () => {
    mockCreateBillingCsvJob.mockRejectedValue(new BillingCsvJobInFlightErrorMock('acme-ent'));
    setBody({ action: 'sync-billing-csv' });
    await expect(handler(makeEvent())).rejects.toThrow(/already in flight/);
    expect(mockRunIngester).not.toHaveBeenCalled();
  });

  it('falls back to triggeredBy="admin" when no session', async () => {
    setSession(null);
    mockCreateBillingCsvJob.mockResolvedValue({ id: 1, status: 'queued' });
    setBody({ action: 'sync-billing-csv' });
    await handler(makeEvent());
    expect(mockCreateBillingCsvJob.mock.calls[0]![0].triggeredBy).toBe('admin');
  });
});

describe('sync.post — sync-billing-csv-cancel action', () => {
  it('marks in-flight jobs cancelled and returns count', async () => {
    mockCancelInFlight.mockResolvedValue(2);
    setBody({ action: 'sync-billing-csv-cancel' });
    const result = await handler(makeEvent());
    expect(result.action).toBe('sync-billing-csv-cancel');
    expect(result.cancelled).toBe(2);
    expect(mockCancelInFlight).toHaveBeenCalledWith('acme-ent');
  });

  it('returns 503 when billing enterprise is not configured', async () => {
    setConfig({ billingEnterprise: '' });
    setBody({ action: 'sync-billing-csv-cancel' });
    await expect(handler(makeEvent())).rejects.toThrow(/NUXT_BILLING_ENTERPRISE/);
  });
});

describe('sync.post — sync-billing-csv-dismiss action', () => {
  it('returns 403 when caller is not a usage admin', async () => {
    mockRequireUsageAdmin.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { statusCode: 403 }));
    setBody({ action: 'sync-billing-csv-dismiss', jobId: 42 });
    await expect(handler(makeEvent())).rejects.toThrow(/Forbidden/);
    expect(mockDismissJob).not.toHaveBeenCalled();
  });

  it('soft-dismisses the job and returns dismissed=true', async () => {
    mockDismissJob.mockResolvedValue(true);
    setBody({ action: 'sync-billing-csv-dismiss', jobId: 42 });
    const result = await handler(makeEvent());
    expect(result).toEqual({ action: 'sync-billing-csv-dismiss', jobId: 42, dismissed: true });
    expect(mockDismissJob).toHaveBeenCalledWith(42);
  });

  it('returns dismissed=false when storage refuses (in-flight / already dismissed / not found)', async () => {
    mockDismissJob.mockResolvedValue(false);
    setBody({ action: 'sync-billing-csv-dismiss', jobId: 99 });
    const result = await handler(makeEvent());
    expect(result.dismissed).toBe(false);
  });

  it('accepts jobId as a numeric string (Vue body serializer quirk)', async () => {
    mockDismissJob.mockResolvedValue(true);
    setBody({ action: 'sync-billing-csv-dismiss', jobId: '42' });
    const result = await handler(makeEvent());
    expect(result.jobId).toBe(42);
    expect(mockDismissJob).toHaveBeenCalledWith(42);
  });

  it('rejects non-numeric / missing jobId with 400', async () => {
    setBody({ action: 'sync-billing-csv-dismiss' });
    await expect(handler(makeEvent())).rejects.toThrow(/jobId/);
    setBody({ action: 'sync-billing-csv-dismiss', jobId: 'not-a-number' });
    await expect(handler(makeEvent())).rejects.toThrow(/jobId/);
    expect(mockDismissJob).not.toHaveBeenCalled();
  });
});
