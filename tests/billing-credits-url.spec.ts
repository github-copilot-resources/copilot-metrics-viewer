/**
 * Unit tests for buildBillingApiUrl — the URL-selection logic in
 * server/api/billing-credits.get.ts. Covers the three branches:
 *   1. NUXT_BILLING_ENTERPRISE override → always /enterprises/...
 *   2. enterprise scope → /enterprises/{githubEnt}/...
 *   3. organization scope → /organizations/{githubOrg}/...
 */

import { describe, it, expect } from 'vitest';
import { buildBillingApiUrl } from '../server/utils/billing-url';

const base = 'https://api.github.com';

describe('buildBillingApiUrl', () => {
  it('uses NUXT_BILLING_ENTERPRISE override regardless of dashboard scope', () => {
    const url = buildBillingApiUrl({
      baseUrl: base,
      scope: 'organization',
      githubOrg: 'cody-test-org',
      billingEnterprise: 'ghms-mfg-us-app-inno',
    });
    expect(url).toBe('https://api.github.com/enterprises/ghms-mfg-us-app-inno/settings/billing/ai_credit/usage');
  });

  it('override wins even when scope is enterprise with a different ent', () => {
    const url = buildBillingApiUrl({
      baseUrl: base,
      scope: 'enterprise',
      githubEnt: 'other-ent',
      billingEnterprise: 'override-ent',
    });
    expect(url).toBe('https://api.github.com/enterprises/override-ent/settings/billing/ai_credit/usage');
  });

  it('uses enterprise endpoint for enterprise scope when no override', () => {
    const url = buildBillingApiUrl({
      baseUrl: base,
      scope: 'enterprise',
      githubEnt: 'my-ent',
    });
    expect(url).toBe('https://api.github.com/enterprises/my-ent/settings/billing/ai_credit/usage');
  });

  it('uses organization endpoint for organization scope when no override', () => {
    const url = buildBillingApiUrl({
      baseUrl: base,
      scope: 'organization',
      githubOrg: 'my-org',
    });
    expect(url).toBe('https://api.github.com/organizations/my-org/settings/billing/ai_credit/usage');
  });

  it('strips trailing slash from baseUrl (e.g. GHE.com override)', () => {
    const url = buildBillingApiUrl({
      baseUrl: 'https://api.foo.ghe.com/',
      scope: 'organization',
      githubOrg: 'my-org',
    });
    expect(url).toBe('https://api.foo.ghe.com/organizations/my-org/settings/billing/ai_credit/usage');
  });

  it('throws when organization scope has no githubOrg', () => {
    expect(() =>
      buildBillingApiUrl({ baseUrl: base, scope: 'organization' })
    ).toThrow(/organization must be set/);
  });

  it('throws when enterprise scope has no githubEnt', () => {
    expect(() =>
      buildBillingApiUrl({ baseUrl: base, scope: 'enterprise' })
    ).toThrow(/enterprise must be set/);
  });

  it('treats empty/whitespace billingEnterprise as not set', () => {
    const url = buildBillingApiUrl({
      baseUrl: base,
      scope: 'organization',
      githubOrg: 'my-org',
      billingEnterprise: '   ',
    });
    expect(url).toBe('https://api.github.com/organizations/my-org/settings/billing/ai_credit/usage');
  });

  it('throws on invalid scope', () => {
    expect(() =>
      buildBillingApiUrl({ baseUrl: base, scope: 'team-organization' })
    ).toThrow(/Invalid scope/);
  });
});
