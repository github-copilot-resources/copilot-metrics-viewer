/**
 * Unit tests for the usage-admin pure check.
 *
 * Verifies the strict, closed-by-default behaviour:
 *   - Empty allowlist → false for everyone (even authenticated users).
 *   - Comma/whitespace handling.
 *   - Case-insensitive matching for both login and email.
 *   - No domain-wildcard matching (only explicit entries).
 */

import { describe, it, expect } from 'vitest';
import { isUsageAdmin } from '../server/utils/usage-admin';

describe('isUsageAdmin', () => {
  describe('open-by-default when allowlist is empty', () => {
    it('returns true when allowlist is empty', () => {
      expect(isUsageAdmin({ login: 'alice' }, '')).toBe(true);
    });

    it('returns true when allowlist is whitespace only', () => {
      expect(isUsageAdmin({ login: 'alice' }, '   ')).toBe(true);
    });

    it('returns true when allowlist is comma-only', () => {
      expect(isUsageAdmin({ login: 'alice' }, ',,,')).toBe(true);
    });

    it('returns true even when identity has no login or email (matches open mode)', () => {
      expect(isUsageAdmin({}, '')).toBe(true);
    });

    it('returns false when allowlist is set but identity has no login or email', () => {
      expect(isUsageAdmin({}, 'alice,bob')).toBe(false);
    });
  });

  describe('login matching', () => {
    it('matches an exact login', () => {
      expect(isUsageAdmin({ login: 'alice' }, 'alice,bob')).toBe(true);
    });

    it('is case-insensitive on the login', () => {
      expect(isUsageAdmin({ login: 'AlIcE' }, 'alice,bob')).toBe(true);
    });

    it('is case-insensitive on the allowlist entry', () => {
      expect(isUsageAdmin({ login: 'alice' }, 'ALICE,bob')).toBe(true);
    });

    it('does not match a substring', () => {
      expect(isUsageAdmin({ login: 'al' }, 'alice,bob')).toBe(false);
    });

    it('handles surrounding whitespace in allowlist entries', () => {
      expect(isUsageAdmin({ login: 'alice' }, '  alice  ,  bob  ')).toBe(true);
    });
  });

  describe('email matching', () => {
    it('matches an exact email', () => {
      expect(isUsageAdmin({ email: 'alice@corp.com' }, 'alice@corp.com')).toBe(true);
    });

    it('is case-insensitive on the email', () => {
      expect(isUsageAdmin({ email: 'Alice@Corp.com' }, 'alice@corp.com')).toBe(true);
    });

    it('does NOT match a bare domain entry (no wildcard semantics)', () => {
      expect(isUsageAdmin({ email: 'alice@corp.com' }, 'corp.com')).toBe(false);
      expect(isUsageAdmin({ email: 'alice@corp.com' }, '@corp.com')).toBe(false);
    });
  });

  describe('mixed identity', () => {
    it('returns true when either login OR email matches', () => {
      expect(
        isUsageAdmin({ login: 'alice', email: 'foo@bar.com' }, 'alice')
      ).toBe(true);
      expect(
        isUsageAdmin({ login: 'unknown', email: 'foo@bar.com' }, 'foo@bar.com')
      ).toBe(true);
    });

    it('returns false when neither matches', () => {
      expect(
        isUsageAdmin({ login: 'alice', email: 'foo@bar.com' }, 'bob,baz@qux.com')
      ).toBe(false);
    });
  });
});
