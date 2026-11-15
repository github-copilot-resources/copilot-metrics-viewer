// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  billingUsernamesForMetricsLogins,
  normalizeBillingUsername,
  parseBillingUserAliases,
} from '../shared/utils/billing-user-identity';

describe('explicit operator billing aliases', () => {
  it('canonicalizes direct and many-to-one aliases without requesting a billing key twice', () => {
    const aliases = parseBillingUserAliases('{" OPAQUE_A ":" Fake-User ","opaque_b":"fake-user"}');
    expect(billingUsernamesForMetricsLogins(['Fake-User', ' fake-user '], aliases))
      .toEqual(['fake-user', 'opaque_a', 'opaque_b']);
    expect(normalizeBillingUsername(' Opaque_A ', aliases)).toBe('fake-user');
    expect(normalizeBillingUsername(' FAKE-USER ', aliases)).toBe('fake-user');
  });

  it.each([
    '{',
    'null',
    '[]',
    '"fake-user"',
    '{"opaque":42}',
    '{"":"fake-user"}',
    '{"opaque":" "}',
    '{"Opaque":"fake-a","opaque":"fake-b"}',
    '{"opaque":"fake-a","opaque":"fake-b"}',
    '{"\\u006fpaque":"fake-a","opaque":"fake-b"}',
    '{"a":"b","b":"c"}',
    '{"a":"b","b":"a"}',
  ])('rejects invalid or ambiguous configuration without leaking identities: %s', raw => {
    expect(() => parseBillingUserAliases(raw)).toThrow('NUXT_BILLING_USER_ALIASES');
  });

  it('does not reassign an alias source as a direct metrics identity', () => {
    const aliases = parseBillingUserAliases('{"opaque":"fake-user"}');
    expect(billingUsernamesForMetricsLogins(['opaque'], aliases)).toEqual([]);
    expect(billingUsernamesForMetricsLogins(['opaque', 'fake-user'], aliases))
      .toEqual(['fake-user', 'opaque']);
  });

  it('does not inherit prototype identities and supports explicit identity aliases', () => {
    const aliases = parseBillingUserAliases('{"FAKE-USER":"fake-user"}');
    expect(normalizeBillingUsername('constructor', aliases)).toBe('constructor');
    expect(normalizeBillingUsername('__proto__', aliases)).toBe('__proto__');
    expect(billingUsernamesForMetricsLogins(['fake-user'], aliases)).toEqual(['fake-user']);
  });
});
