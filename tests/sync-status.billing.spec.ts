// @vitest-environment node
/**
 * Regression test for GET /api/admin/sync-status.
 *
 * Bug: AdminPanel.vue calls /api/admin/sync-status with the dashboard's
 * scope+identifier in the query string. That triggered the early-return
 * "scoped stats" branch which dropped the `billingCsv` block, causing the
 * "Billing CSV ingest" section to stay hidden even when
 * NUXT_BILLING_ENTERPRISE was configured.
 *
 * Fix: compute billingCsv up front and include it on BOTH response shapes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).defineEventHandler = (h: any) => h;
  (globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
    const err: any = new Error(statusMessage);
    err.statusCode = statusCode;
    return err;
  };
  (globalThis as any).getQuery = () => (globalThis as any).__test_query || {};
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
});

function setQuery(q: Record<string, string>) { (globalThis as any).__test_query = q; }
function setConfig(c: Record<string, unknown>) { (globalThis as any).__test_config = c; }

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

const mockGetSyncStats = vi.fn();
const mockGetPending = vi.fn();
const mockGetFailed = vi.fn();
vi.mock('../server/services/sync-service', () => ({
  getSyncStats: (...a: any[]) => mockGetSyncStats(...a),
}));
vi.mock('../server/storage/sync-storage', () => ({
  getPendingSyncs: (...a: any[]) => mockGetPending(...a),
  getFailedSyncs: (...a: any[]) => mockGetFailed(...a),
}));

const mockGetInFlight = vi.fn();
const mockListRecent = vi.fn();
vi.mock('../server/storage/billing-csv-sync-status-storage', () => ({
  getInFlightBillingCsvJob: (...a: any[]) => mockGetInFlight(...a),
  listRecentBillingCsvJobs: (...a: any[]) => mockListRecent(...a),
}));

import handler from '../server/api/admin/sync-status.get';

describe('GET /api/admin/sync-status — billingCsv presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setConfig({ billingEnterprise: 'ghms-mfg-us-app-inno' });
    mockGetInFlight.mockResolvedValue(null);
    mockListRecent.mockResolvedValue([]);
    mockGetSyncStats.mockResolvedValue({ totalDays: 30, syncedDays: 0 });
    mockGetPending.mockResolvedValue([]);
    mockGetFailed.mockResolvedValue([]);
  });

  it('includes billingCsv on the SCOPED branch (scope + githubOrg)', async () => {
    setQuery({ scope: 'organization', githubOrg: 'cody-test-org' });
    const res = await handler({} as any);

    // Regression assertion: this was the bug — billingCsv was undefined
    // because the scoped branch returned early without it.
    expect(res).toHaveProperty('billingCsv');
    expect(res.billingCsv).toEqual({ inFlight: null, recent: [] });

    // Still returns the scoped stats fields.
    expect(res.scope).toBe('organization');
    expect(res.identifier).toBe('cody-test-org');
    expect(res.stats).toBeDefined();
  });

  it('includes billingCsv on the GLOBAL branch (no scope)', async () => {
    setQuery({});
    const res = await handler({} as any);

    expect(res.billingCsv).toEqual({ inFlight: null, recent: [] });
    expect(res.pending).toBe(0);
    expect(res.failed).toBe(0);
  });

  it('returns billingCsv=null when NUXT_BILLING_ENTERPRISE is unset', async () => {
    setConfig({ billingEnterprise: '' });
    setQuery({ scope: 'enterprise', githubEnt: 'octo-ent' });
    const res = await handler({} as any);

    expect(res.billingCsv).toBeNull();
    expect(mockGetInFlight).not.toHaveBeenCalled();
  });
});
