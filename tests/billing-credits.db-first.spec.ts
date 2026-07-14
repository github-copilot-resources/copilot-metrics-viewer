// @vitest-environment node
/**
 * Route-level integration test for the Phase B DB-first branch in
 * GET /api/billing-credits and GET /api/billing-credits-by-user.
 *
 * The pure reader logic is exercised in `billing-credit-reader.spec.ts`.
 * This file pins the WIRING — i.e. that the handlers:
 *   - call decideSource() with the correct enterprise + window
 *   - set X-Data-Source / X-Data-Source-Synced-At headers on hits
 *   - call aggregateForBilling[ByUser] with forwarded filters
 *   - bypass the live $fetch and the billing-token check when DB-mode wins
 *   - fall through to the existing live path when decideSource returns 'live'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).defineEventHandler = (h: any) => h;
  (globalThis as any).createError = ({ statusCode, statusMessage, data }: { statusCode: number; statusMessage: string; data?: unknown }) => {
    const err: any = new Error(statusMessage);
    err.statusCode = statusCode;
    err.data = data;
    return err;
  };
  (globalThis as any).getQuery = () => (globalThis as any).__test_query || {};
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
  (globalThis as any).setResponseHeader = (_e: unknown, k: string, v: string) => {
    const h = (globalThis as any).__test_response_headers || {};
    h[k] = v;
    (globalThis as any).__test_response_headers = h;
  };
  (globalThis as any).$fetch = vi.fn();
});

function setQuery(q: Record<string, string>) { (globalThis as any).__test_query = q; }
function setConfig(c: Record<string, unknown>) { (globalThis as any).__test_config = c; }
function getHeader(name: string): string | undefined {
  return ((globalThis as any).__test_response_headers || {})[name];
}
function resetHeaders() { (globalThis as any).__test_response_headers = {}; }

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

vi.mock('../server/utils/usage-admin', () => ({
  requireUsageAdmin: vi.fn(async () => undefined),
  isUsageAdminForEvent: vi.fn(async () => true),
  getSessionLoginForFilter: vi.fn(async () => null),
}));

const mockDecide = vi.fn();
const mockAggregate = vi.fn();
const mockAggregateByUser = vi.fn();
vi.mock('../server/services/billing-credit-reader', () => ({
  decideSource: (...a: any[]) => mockDecide(...a),
  aggregateForBilling: (...a: any[]) => mockAggregate(...a),
  aggregateForBillingByUser: (...a: any[]) => mockAggregateByUser(...a),
  resolveWindow: (input: { year?: number; month?: number; day?: number; since?: string; until?: string }) => {
    if (input.since && input.until) {
      return { startDate: input.since, endDate: input.until, timePeriod: {} };
    }
    const y = input.year ?? 2026;
    const m = input.month ?? 6;
    return {
      startDate: `${y}-${String(m).padStart(2, '0')}-01`,
      endDate: `${y}-${String(m).padStart(2, '0')}-30`,
      timePeriod: { year: y, month: m },
    };
  },
}));

import billingHandler from '../server/api/billing-credits.get';
import byUserHandler from '../server/api/billing-credits-by-user.get';

beforeEach(() => {
  vi.clearAllMocks();
  resetHeaders();
  setConfig({
    billingEnterprise: 'ent-x',
    githubBillingToken: 'tok',
  });
});

describe('GET /api/billing-credits — DB-first branch', () => {
  it('serves from DB and sets X-Data-Source headers when decideSource returns db', async () => {
    setQuery({ scope: 'enterprise', githubEnt: 'ent-x', year: '2026', month: '6' });
    mockDecide.mockResolvedValueOnce({
      source: 'db',
      reason: 'covered by job #7 completed 2026-06-27T10:00:00.000Z',
      lastIngestAt: '2026-06-27T10:00:00.000Z',
      jobId: 7,
    });
    mockAggregate.mockResolvedValueOnce({
      timePeriod: { year: 2026, month: 6 },
      enterprise: 'ent-x',
      usageItems: [{
        product: 'copilot', sku: 'copilot_ai_credit', model: 'gpt-4o', unitType: 'credits',
        pricePerUnit: 0.01, grossQuantity: 100, grossAmount: 1, discountQuantity: 100,
        discountAmount: 1, netQuantity: 0, netAmount: 0,
      }],
    });

    const result = await billingHandler({} as any);

    expect(mockDecide).toHaveBeenCalledWith('ent-x', '2026-06-01', '2026-06-30');
    expect(mockAggregate).toHaveBeenCalled();
    // Critically: live $fetch must NOT have fired.
    expect(((globalThis as any).$fetch as any).mock.calls).toHaveLength(0);
    expect(result.usageItems).toHaveLength(1);
    expect(getHeader('X-Data-Source')).toBe('db');
    expect(getHeader('X-Data-Source-Synced-At')).toBe('2026-06-27T10:00:00.000Z');
    expect(getHeader('X-Data-Source-Reason')).toMatch(/job #7/);
  });

  it('forwards user/model filters into the aggregate call', async () => {
    setQuery({ scope: 'enterprise', githubEnt: 'ent-x', year: '2026', month: '6', user: 'alice', model: 'gpt-4o' });
    mockDecide.mockResolvedValueOnce({ source: 'db', reason: 'ok', lastIngestAt: null, jobId: 1 });
    mockAggregate.mockResolvedValueOnce({ timePeriod: {}, enterprise: 'ent-x', usageItems: [] });

    await billingHandler({} as any);

    const callArgs = mockAggregate.mock.calls[0]!;
    expect(callArgs[2]).toMatchObject({ user: 'alice', model: 'gpt-4o' });
  });

  it('falls through to live fetch when decideSource returns live', async () => {
    setQuery({ scope: 'enterprise', githubEnt: 'ent-x', year: '2026', month: '6' });
    mockDecide.mockResolvedValueOnce({
      source: 'live', reason: 'no completed ingest job covers window', lastIngestAt: null, jobId: null,
    });
    ((globalThis as any).$fetch as any).mockResolvedValueOnce({
      timePeriod: { year: 2026, month: 6 },
      enterprise: 'ent-x',
      usageItems: [],
    });

    const result = await billingHandler({} as any);

    expect(mockAggregate).not.toHaveBeenCalled();
    expect(((globalThis as any).$fetch as any).mock.calls).toHaveLength(1);
    expect(result.usageItems).toEqual([]);
    expect(getHeader('X-Data-Source')).toBe('live');
    expect(getHeader('X-Data-Source-Reason')).toMatch(/no completed/);
  });

  it('does not attempt DB branch on org-scoped calls', async () => {
    setConfig({ billingEnterprise: '', githubBillingToken: 'tok' });
    setQuery({ scope: 'organization', githubOrg: 'org-y', year: '2026', month: '6' });
    ((globalThis as any).$fetch as any).mockResolvedValueOnce({
      timePeriod: { year: 2026, month: 6 },
      organization: 'org-y',
      usageItems: [],
    });

    await billingHandler({} as any);

    expect(mockDecide).not.toHaveBeenCalled();
  });

  it('returns 409 range-requires-db when a since/until range is not covered by any ingest job', async () => {
    setQuery({
      scope: 'enterprise', githubEnt: 'ent-x',
      since: '2026-05-01', until: '2026-06-15',
    });
    mockDecide.mockResolvedValueOnce({
      source: 'live', reason: 'no completed ingest job covers window',
      lastIngestAt: null, jobId: null,
    });

    let caught: any = null;
    try { await billingHandler({} as any); } catch (e) { caught = e; }

    expect(caught).toBeTruthy();
    expect(caught.statusCode).toBe(409);
    expect(caught.data?.reason).toBe('range-requires-db');
    expect(caught.message).toMatch(/2026-05-01.*2026-06-15/);
    // Live GitHub API MUST NOT be attempted for custom ranges.
    expect(((globalThis as any).$fetch as any).mock.calls).toHaveLength(0);
  });

  it('serves a since/until range from DB when covered', async () => {
    setQuery({
      scope: 'enterprise', githubEnt: 'ent-x',
      since: '2026-05-01', until: '2026-06-15',
    });
    mockDecide.mockResolvedValueOnce({
      source: 'db', reason: 'covered by job #11', lastIngestAt: null, jobId: 11,
    });
    mockAggregate.mockResolvedValueOnce({
      timePeriod: {}, enterprise: 'ent-x', usageItems: [],
    });

    await billingHandler({} as any);

    expect(mockDecide).toHaveBeenCalledWith('ent-x', '2026-05-01', '2026-06-15');
    expect(mockAggregate).toHaveBeenCalled();
    expect(getHeader('X-Data-Source')).toBe('db');
  });

  it('rejects since/until on org-scoped calls with 409 range-requires-db', async () => {
    setConfig({ billingEnterprise: '', githubBillingToken: 'tok' });
    setQuery({
      scope: 'organization', githubOrg: 'org-y',
      since: '2026-05-01', until: '2026-06-15',
    });

    let caught: any = null;
    try { await billingHandler({} as any); } catch (e) { caught = e; }

    expect(caught).toBeTruthy();
    expect(caught.statusCode).toBe(409);
    expect(caught.data?.reason).toBe('range-requires-db');
    expect(mockDecide).not.toHaveBeenCalled();
    expect(((globalThis as any).$fetch as any).mock.calls).toHaveLength(0);
  });
});

describe('GET /api/billing-credits-by-user — DB-first branch', () => {
  it('serves the per-user aggregate from DB in a single query, no fan-out', async () => {
    setQuery({ scope: 'enterprise', githubEnt: 'ent-x', year: '2026', month: '6', logins: 'alice,bob' });
    mockDecide.mockResolvedValueOnce({ source: 'db', reason: 'covered', lastIngestAt: null, jobId: 9 });
    mockAggregateByUser.mockResolvedValueOnce({
      timePeriod: { year: 2026, month: 6 },
      enterprise: 'ent-x',
      usageItems: [
        { product: 'copilot', sku: 'copilot_ai_credit', model: 'gpt-4o', unitType: 'credits',
          pricePerUnit: 0.01, grossQuantity: 10, grossAmount: 0.1, discountQuantity: 10,
          discountAmount: 0.1, netQuantity: 0, netAmount: 0, user: 'alice' },
        { product: 'copilot', sku: 'copilot_ai_credit', model: 'gpt-4o', unitType: 'credits',
          pricePerUnit: 0.01, grossQuantity: 20, grossAmount: 0.2, discountQuantity: 20,
          discountAmount: 0.2, netQuantity: 0, netAmount: 0, user: 'bob' },
      ],
    });

    const result = await byUserHandler({} as any);

    expect(mockDecide).toHaveBeenCalledWith('ent-x', '2026-06-01', '2026-06-30');
    expect(mockAggregateByUser).toHaveBeenCalled();
    const args = mockAggregateByUser.mock.calls[0]!;
    expect(args[2]).toEqual(['alice', 'bob']);
    expect(((globalThis as any).$fetch as any).mock.calls).toHaveLength(0);
    expect(result.usageItems).toHaveLength(2);
    expect(getHeader('X-Data-Source')).toBe('db');
  });

  it('falls through to fan-out when decideSource returns live', async () => {
    setQuery({ scope: 'enterprise', githubEnt: 'ent-x', year: '2026', month: '6', logins: 'alice' });
    mockDecide.mockResolvedValueOnce({ source: 'live', reason: 'not covered', lastIngestAt: null, jobId: null });
    ((globalThis as any).$fetch as any).mockResolvedValueOnce({
      timePeriod: { year: 2026, month: 6 }, enterprise: 'ent-x',
      usageItems: [{
        product: 'copilot', sku: 'copilot_ai_credit', model: 'gpt-4o', unitType: 'credits',
        pricePerUnit: 0.01, grossQuantity: 5, grossAmount: 0.05, discountQuantity: 5,
        discountAmount: 0.05, netQuantity: 0, netAmount: 0,
      }],
    });

    const result = await byUserHandler({} as any);

    expect(mockAggregateByUser).not.toHaveBeenCalled();
    expect(((globalThis as any).$fetch as any).mock.calls).toHaveLength(1);
    expect(result.usageItems[0]!.user).toBe('alice');
  });
});
