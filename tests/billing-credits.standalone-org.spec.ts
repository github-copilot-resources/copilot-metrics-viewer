// @vitest-environment node
/**
 * End-to-end simulation of the standalone-org billing flow reported in
 * issue #398 (@mfischbacher5600 / org "Eurofunk").
 *
 * The reporter has a **standalone organization** — `GET /orgs/<org>` returns
 * `enterprise: null, parent: null`. The org-level billing endpoint returns
 * HTTP 200 for that setup (verified in the issue's diagnostic dump), so the
 * dashboard MUST NOT require `NUXT_BILLING_ENTERPRISE` in this case.
 *
 * This spec pins the handler's wiring for that scenario:
 *   - empty `NUXT_USAGE_ADMINS` allowlist → treated as admin (opt-in flip)
 *   - unset `NUXT_BILLING_ENTERPRISE` → URL is `/organizations/{org}/...`
 *   - live GitHub 200 → response passthrough, no DB branch
 *   - live GitHub 404 → sharpened error mentioning `NUXT_BILLING_ENTERPRISE`
 *
 * All four are the things that could regress and silently break issue #398
 * again for standalone orgs. Keep as a regression guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).defineEventHandler = (h: any) => h;
  (globalThis as any).createError = ({ statusCode, statusMessage, data }: { statusCode: number; statusMessage: string; data?: unknown }) => {
    const err: any = new Error(statusMessage);
    err.statusCode = statusCode;
    err.statusMessage = statusMessage;
    err.data = data;
    return err;
  };
  (globalThis as any).getQuery = () => (globalThis as any).__test_query || {};
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
  (globalThis as any).setResponseHeader = () => {};
  (globalThis as any).$fetch = vi.fn();
});

function setQuery(q: Record<string, string>) { (globalThis as any).__test_query = q; }
function setConfig(c: Record<string, unknown>) { (globalThis as any).__test_config = c; }

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

// Simulate the post-#407 opt-in flip: empty NUXT_USAGE_ADMINS ⇒ everyone-admin.
// `requireUsageAdmin` returns undefined (no throw), matching that behaviour.
vi.mock('../server/utils/usage-admin', () => ({
  requireUsageAdmin: vi.fn(async () => undefined),
  isUsageAdminForEvent: vi.fn(async () => true),
  getSessionLoginForFilter: vi.fn(async () => null),
}));

// No DB configured (Postgres unset) → decideSource is never called for
// org-scoped calls without NUXT_BILLING_ENTERPRISE. Still mock defensively so
// a regression that starts calling it will fail here instead of hitting a real
// Postgres client.
const mockDecide = vi.fn();
vi.mock('../server/services/billing-credit-reader', () => ({
  decideSource: (...a: any[]) => mockDecide(...a),
  aggregateForBilling: vi.fn(),
  aggregateForBillingByUser: vi.fn(),
  resolveWindow: (input: { year?: number; month?: number }) => {
    const y = input.year ?? 2026;
    const m = input.month ?? 7;
    return {
      startDate: `${y}-${String(m).padStart(2, '0')}-01`,
      endDate: `${y}-${String(m).padStart(2, '0')}-31`,
      timePeriod: { year: y, month: m },
    };
  },
}));

import billingHandler from '../server/api/billing-credits.get';

// Shape mirrors the real /organizations/{org}/settings/billing/ai_credit/usage
// response @mfischbacher5600 posted on issue #398 (2026-07-01).
const standaloneOrgResponse = {
  timePeriod: { year: 2026, month: 7 },
  organization: 'Eurofunk',
  usageItems: [
    {
      product: 'Copilot',
      sku: 'Copilot AI Credits',
      model: 'Auto: Claude Haiku 4.5',
      unitType: 'ai-credits',
      pricePerUnit: 0.01,
      grossQuantity: 567.043776,
      grossAmount: 5.67043776,
      discountQuantity: 567.043776,
      discountAmount: 5.67043776,
      netQuantity: 0.0,
      netAmount: 0.0,
    },
    {
      product: 'Copilot',
      sku: 'Copilot AI Credits',
      model: 'Auto: GPT-5.4',
      unitType: 'ai-credits',
      pricePerUnit: 0.01,
      grossQuantity: 1131.45417,
      grossAmount: 11.3145417,
      discountQuantity: 1131.45417,
      discountAmount: 11.3145417,
      netQuantity: 0.0,
      netAmount: 0.0,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reporter's exact config: scope=organization, no billingEnterprise, classic PAT set.
  setConfig({
    billingEnterprise: '',
    githubBillingToken: 'ghp_classic_pat_with_manage_billing_copilot',
    githubApiBaseUrl: '',
  });
});

describe('GET /api/billing-credits — standalone org (issue #398 scenario)', () => {
  it('routes to /organizations/{org}/settings/billing/ai_credit/usage when NUXT_BILLING_ENTERPRISE is unset', async () => {
    setQuery({ scope: 'organization', githubOrg: 'Eurofunk', year: '2026', month: '7' });
    ((globalThis as any).$fetch as any).mockResolvedValueOnce(standaloneOrgResponse);

    const result = await billingHandler({} as any);

    // The DB branch must not fire — no enterprise slug is resolvable.
    expect(mockDecide).not.toHaveBeenCalled();

    // Exactly one live call, hitting the ORG endpoint (not /enterprises/...).
    const calls = ((globalThis as any).$fetch as any).mock.calls;
    expect(calls).toHaveLength(1);
    const calledUrl: string = calls[0][0];
    expect(calledUrl).toContain('/organizations/Eurofunk/settings/billing/ai_credit/usage');
    expect(calledUrl).not.toContain('/enterprises/');

    // Response passes through unchanged.
    expect(result.organization).toBe('Eurofunk');
    expect(result.usageItems).toHaveLength(2);
    expect(result.usageItems[0]!.grossAmount).toBeCloseTo(5.67043776, 6);
  });

  it('sends the classic PAT via `token` scheme and the required X-GitHub-Api-Version header', async () => {
    setQuery({ scope: 'organization', githubOrg: 'Eurofunk', year: '2026', month: '7' });
    ((globalThis as any).$fetch as any).mockResolvedValueOnce(standaloneOrgResponse);

    await billingHandler({} as any);

    const calls = ((globalThis as any).$fetch as any).mock.calls;
    const opts = calls[0][1] as { headers: Headers };
    const headers = opts.headers;
    expect(headers.get('authorization')).toBe('token ghp_classic_pat_with_manage_billing_copilot');
    expect(headers.get('x-github-api-version')).toBe('2026-03-10');
    expect(headers.get('accept')).toBe('application/vnd.github+json');
  });

  it('forwards year/month query params to GitHub', async () => {
    setQuery({ scope: 'organization', githubOrg: 'Eurofunk', year: '2026', month: '7' });
    ((globalThis as any).$fetch as any).mockResolvedValueOnce(standaloneOrgResponse);

    await billingHandler({} as any);

    const calledUrl: string = ((globalThis as any).$fetch as any).mock.calls[0][0];
    expect(calledUrl).toContain('year=2026');
    expect(calledUrl).toContain('month=7');
  });

  it('surfaces a sharpened 404 message pointing at NUXT_BILLING_ENTERPRISE when the org endpoint 404s', async () => {
    // Some orgs (e.g. enterprise-owned ones that the operator forgot to set
    // NUXT_BILLING_ENTERPRISE for) will 404 on /organizations/... — the error
    // must tell them exactly which env var to set.
    setQuery({ scope: 'organization', githubOrg: 'some-ent-owned-org', year: '2026', month: '7' });
    ((globalThis as any).$fetch as any).mockRejectedValueOnce({
      statusCode: 404,
      data: { message: 'Not Found' },
    });

    let caught: any;
    try {
      await billingHandler({} as any);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeTruthy();
    expect(caught.statusCode).toBe(404);
    expect(caught.statusMessage).toMatch(/NUXT_BILLING_ENTERPRISE/);
    expect(caught.statusMessage).toMatch(/some-ent-owned-org/);
  });

  it('passes through non-404 errors verbatim (no misleading NUXT_BILLING_ENTERPRISE hint)', async () => {
    setQuery({ scope: 'organization', githubOrg: 'Eurofunk', year: '2026', month: '7' });
    ((globalThis as any).$fetch as any).mockRejectedValueOnce({
      statusCode: 403,
      data: { message: 'Resource not accessible by personal access token' },
    });

    let caught: any;
    try {
      await billingHandler({} as any);
    } catch (e) {
      caught = e;
    }

    expect(caught.statusCode).toBe(403);
    expect(caught.statusMessage).not.toMatch(/NUXT_BILLING_ENTERPRISE/);
    expect(caught.statusMessage).toMatch(/Resource not accessible/);
  });
});
