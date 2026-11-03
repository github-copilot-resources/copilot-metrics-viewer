// @vitest-environment node
/**
 * resolveBillingToken: NUXT_GITHUB_BILLING_TOKEN wins; the signed-in user's
 * GitHub OAuth token is used only when NUXT_BILLING_USE_USER_TOKEN=true;
 * NUXT_GITHUB_TOKEN is never used for billing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).useRuntimeConfig = () => (globalThis as any).__test_config || {};
  (globalThis as any).getUserSession = vi.fn(async () => (globalThis as any).__test_session ?? {});
  (globalThis as any).$fetch = vi.fn();
});

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

import {
  resolveBillingToken,
  resolveBillingAccess,
  probeUserBillingAccess,
  clearBillingProbeCache,
  isBillingConfigured,
  userTokenFromSecure,
  isUserBillingTokenEnabled,
} from '../server/utils/billing-token';

const event = {} as any;
const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

function setConfig(c: Record<string, unknown>) { (globalThis as any).__test_config = c; }
function setSession(s: unknown) { (globalThis as any).__test_session = s; }

describe('isUserBillingTokenEnabled', () => {
  it.each([
    [true, true], ['true', true], [' TRUE ', true],
    [false, false], ['false', false], ['', false], [undefined, false], ['1', false],
  ])('%j → %s', (v, expected) => {
    expect(isUserBillingTokenEnabled({ billingUseUserToken: v })).toBe(expected);
  });
});

describe('userTokenFromSecure', () => {
  it('returns the token when there is no expiry', () => {
    expect(userTokenFromSecure({ tokens: { access_token: 'gho_abc' } }, NOW)).toBe('gho_abc');
  });

  it('accepts an ISO-string expiry in the future (cookie round-trip shape)', () => {
    const expires_at = new Date(NOW + 60 * 60 * 1000).toISOString();
    expect(userTokenFromSecure({ tokens: { access_token: 'gho_abc' }, expires_at }, NOW)).toBe('gho_abc');
  });

  it('rejects an expired ISO-string expiry', () => {
    const expires_at = new Date(NOW - 1000).toISOString();
    expect(userTokenFromSecure({ tokens: { access_token: 'gho_abc' }, expires_at }, NOW)).toBe('');
  });

  it('rejects a Date expiry inside the 30s safety margin', () => {
    const expires_at = new Date(NOW + 10 * 1000);
    expect(userTokenFromSecure({ tokens: { access_token: 'gho_abc' }, expires_at }, NOW)).toBe('');
  });

  it('treats an unparsable expiry as no expiry', () => {
    expect(userTokenFromSecure({ tokens: { access_token: 'gho_abc' }, expires_at: 'Invalid Date' }, NOW)).toBe('gho_abc');
  });

  it.each([undefined, null, 'x', {}, { tokens: {} }, { tokens: { access_token: '  ' } }, { tokens: { access_token: 42 } }])(
    'returns empty string for %j', (secure) => {
      expect(userTokenFromSecure(secure, NOW)).toBe('');
    });
});

describe('resolveBillingToken', () => {
  beforeEach(() => {
    setConfig({});
    setSession({});
    (globalThis as any).getUserSession.mockClear();
  });

  it('prefers NUXT_GITHUB_BILLING_TOKEN over the user token', async () => {
    setConfig({ githubBillingToken: ' ghp_pat ', billingUseUserToken: true });
    setSession({ secure: { tokens: { access_token: 'gho_user' } } });
    await expect(resolveBillingToken(event)).resolves.toEqual({ token: 'ghp_pat', source: 'pat' });
  });

  it('ignores the user token when the opt-in is off and does not read the session', async () => {
    setSession({ secure: { tokens: { access_token: 'gho_user' } } });
    await expect(resolveBillingToken(event)).resolves.toEqual({ token: '', source: 'none' });
    expect((globalThis as any).getUserSession).not.toHaveBeenCalled();
  });

  it('never falls back to NUXT_GITHUB_TOKEN', async () => {
    setConfig({ githubToken: 'github_pat_finegrained', billingUseUserToken: true });
    setSession({});
    await expect(resolveBillingToken(event)).resolves.toEqual({ token: '', source: 'none' });
  });

  it('uses the signed-in user token when the opt-in is on', async () => {
    setConfig({ billingUseUserToken: 'true' });
    setSession({ user: { login: 'octocat' }, secure: { tokens: { access_token: 'gho_user' } } });
    await expect(resolveBillingToken(event)).resolves.toEqual({ token: 'gho_user', source: 'user' });
  });

  it('returns none when the user token is expired', async () => {
    setConfig({ billingUseUserToken: true });
    setSession({ secure: { tokens: { access_token: 'gho_user' }, expires_at: '2000-01-01T00:00:00.000Z' } });
    await expect(resolveBillingToken(event)).resolves.toEqual({ token: '', source: 'none' });
  });

  it('returns none when reading the session throws', async () => {
    setConfig({ billingUseUserToken: true });
    (globalThis as any).getUserSession.mockRejectedValueOnce(new Error('no session'));
    await expect(resolveBillingToken(event)).resolves.toEqual({ token: '', source: 'none' });
  });
});

describe('isBillingConfigured', () => {
  it('is true with a billing PAT or with the user-token opt-in', () => {
    expect(isBillingConfigured({ githubBillingToken: 'ghp_x' })).toBe(true);
    expect(isBillingConfigured({ billingUseUserToken: true })).toBe(true);
    expect(isBillingConfigured({ githubToken: 'github_pat_x' })).toBe(false);
    expect(isBillingConfigured({})).toBe(false);
  });
});

describe('probeUserBillingAccess', () => {
  const fetchMock = () => (globalThis as any).$fetch as ReturnType<typeof vi.fn>;
  const entConfig = {
    billingUseUserToken: true,
    public: { scope: 'enterprise', githubEnt: 'my-ent', githubOrg: '' },
  };

  beforeEach(() => {
    clearBillingProbeCache();
    fetchMock().mockReset();
    setConfig(entConfig);
  });

  it('calls the enterprise billing endpoint for the current month with the user token', async () => {
    fetchMock().mockResolvedValueOnce({ usageItems: [] });
    await expect(probeUserBillingAccess(event, 'gho_admin', NOW)).resolves.toBe(true);
    const [url, opts] = fetchMock().mock.calls[0]!;
    expect(url).toBe('https://api.github.com/enterprises/my-ent/settings/billing/ai_credit/usage?year=2026&month=11');
    expect(opts.headers.Authorization).toBe('token gho_admin');
  });

  it.each([401, 403, 404])('returns false on %i and caches the denial', async (status) => {
    fetchMock().mockRejectedValueOnce(Object.assign(new Error('denied'), { statusCode: status }));
    await expect(probeUserBillingAccess(event, 'gho_user', NOW)).resolves.toBe(false);
    await expect(probeUserBillingAccess(event, 'gho_user', NOW + 60_000)).resolves.toBe(false);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('caches success per token and re-probes after 10 minutes', async () => {
    fetchMock().mockResolvedValue({ usageItems: [] });
    await probeUserBillingAccess(event, 'gho_admin', NOW);
    await probeUserBillingAccess(event, 'gho_admin', NOW + 9 * 60_000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    await probeUserBillingAccess(event, 'gho_admin', NOW + 11 * 60_000);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it('keeps separate cache entries per token', async () => {
    fetchMock()
      .mockResolvedValueOnce({ usageItems: [] })
      .mockRejectedValueOnce(Object.assign(new Error('denied'), { statusCode: 403 }));
    await expect(probeUserBillingAccess(event, 'gho_admin', NOW)).resolves.toBe(true);
    await expect(probeUserBillingAccess(event, 'gho_user', NOW)).resolves.toBe(false);
  });

  it('does not cache transient failures', async () => {
    fetchMock()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 502 }))
      .mockResolvedValueOnce({ usageItems: [] });
    await expect(probeUserBillingAccess(event, 'gho_admin', NOW)).resolves.toBe(false);
    await expect(probeUserBillingAccess(event, 'gho_admin', NOW)).resolves.toBe(true);
  });

  it('honours NUXT_BILLING_ENTERPRISE and the legacy team-organization scope', async () => {
    setConfig({ ...entConfig, billingEnterprise: 'billing-ent', public: { scope: 'team-organization', githubOrg: 'my-org' } });
    fetchMock().mockResolvedValueOnce({ usageItems: [] });
    await probeUserBillingAccess(event, 'gho_admin', NOW);
    expect(fetchMock().mock.calls[0]![0]).toContain('/enterprises/billing-ent/settings/billing/ai_credit/usage');
  });

  it('returns false without calling GitHub when no target is configured', async () => {
    setConfig({ billingUseUserToken: true, public: { scope: 'enterprise', githubEnt: '' } });
    await expect(probeUserBillingAccess(event, 'gho_admin', NOW)).resolves.toBe(false);
    expect(fetchMock()).not.toHaveBeenCalled();
  });
});

describe('resolveBillingAccess', () => {
  const fetchMock = () => (globalThis as any).$fetch as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearBillingProbeCache();
    fetchMock().mockReset();
    setSession({});
  });

  it('not configured → no access, no GitHub call', async () => {
    setConfig({});
    await expect(resolveBillingAccess(event)).resolves.toEqual({ configured: false, access: false });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('billing PAT → access for everyone without probing', async () => {
    setConfig({ githubBillingToken: 'ghp_pat' });
    await expect(resolveBillingAccess(event)).resolves.toEqual({ configured: true, access: true });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('user-token mode, user without GitHub token (e.g. other IdP) → configured but no access', async () => {
    setConfig({ billingUseUserToken: true, public: { scope: 'enterprise', githubEnt: 'my-ent' } });
    await expect(resolveBillingAccess(event)).resolves.toEqual({ configured: true, access: false });
  });

  it('user-token mode, GitHub denies the user → configured but no access', async () => {
    setConfig({ billingUseUserToken: true, public: { scope: 'enterprise', githubEnt: 'my-ent' } });
    setSession({ secure: { tokens: { access_token: 'gho_dev' } } });
    fetchMock().mockRejectedValueOnce(Object.assign(new Error('denied'), { statusCode: 403 }));
    await expect(resolveBillingAccess(event)).resolves.toEqual({ configured: true, access: false });
  });

  it('user-token mode, GitHub accepts the user → access', async () => {
    setConfig({ billingUseUserToken: true, public: { scope: 'enterprise', githubEnt: 'my-ent' } });
    setSession({ secure: { tokens: { access_token: 'gho_admin' } } });
    fetchMock().mockResolvedValueOnce({ usageItems: [] });
    await expect(resolveBillingAccess(event)).resolves.toEqual({ configured: true, access: true });
  });
});
