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
});

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as any).__test_config || {},
  defineNuxtPlugin: (h: any) => h,
}));

import {
  resolveBillingToken,
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
