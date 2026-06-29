/**
 * Unit tests for the issue-#398 visibility filter.
 *
 * The async restrictUserRowsToSelf wrapper depends on Nuxt auto-imports that
 * aren't available in raw vitest. We test the PURE decision function directly
 * — it carries the full security invariant. The wrapper is a thin adapter and
 * is covered indirectly by endpoint integration tests + Playwright e2e.
 */

import { describe, it, expect } from 'vitest';
import {
  filterRowsByDecision,
  restrictUserRowsToSelf,
  type RestrictDecisionInputs,
} from '../server/utils/restrict-user-rows';

const baseInputs: RestrictDecisionInputs = {
  isMocked: false,
  authConfigured: true,
  isAdmin: false,
  sessionLogin: null,
};

describe('filterRowsByDecision (security invariant)', () => {
  it('non-admin caller sees ONLY their own row, never others (the core invariant)', () => {
    const rows = [{ login: 'alice' }, { login: 'bob' }, { login: 'carol' }];
    const out = filterRowsByDecision(rows, { ...baseInputs, sessionLogin: 'bob' });
    expect(out).toEqual([{ login: 'bob' }]);
  });

  it('non-admin caller with no matching row gets EMPTY list (not the whole list — guards against falsy bugs)', () => {
    const rows = [{ login: 'alice' }, { login: 'bob' }];
    const out = filterRowsByDecision(rows, { ...baseInputs, sessionLogin: 'eve' });
    expect(out).toEqual([]);
  });

  it('login matching is case-insensitive in both directions', () => {
    const rows = [{ login: 'Alice' }, { login: 'BOB' }, { login: 'carol' }];
    expect(filterRowsByDecision(rows, { ...baseInputs, sessionLogin: 'alice' }))
      .toEqual([{ login: 'Alice' }]);
    expect(filterRowsByDecision(rows, { ...baseInputs, sessionLogin: 'bob' }))
      .toEqual([{ login: 'BOB' }]);
    expect(filterRowsByDecision(rows, { ...baseInputs, sessionLogin: 'CAROL' }))
      .toEqual([{ login: 'carol' }]);
  });

  it('rows with missing or empty login are NEVER returned (no wildcard via legacy sentinel)', () => {
    const rows = [
      { login: '' },
      { login: undefined },
      { user_login: '' },
      {},
      { login: 'bob' },
    ];
    // Even if caller is "" they get nothing — empty login is not a real user.
    expect(filterRowsByDecision(rows, { ...baseInputs, sessionLogin: '' }))
      .toEqual([]);
    // Caller "bob" gets only bob, never the missing-login rows.
    expect(filterRowsByDecision(rows, { ...baseInputs, sessionLogin: 'bob' }))
      .toEqual([{ login: 'bob' }]);
  });

  it('admin caller gets all rows unchanged', () => {
    const rows = [{ login: 'alice' }, { login: 'bob' }];
    const out = filterRowsByDecision(rows, { ...baseInputs, isAdmin: true, sessionLogin: 'admin' });
    expect(out).toEqual(rows);
  });

  it('null session login on non-admin returns [] (unauthenticated must not leak)', () => {
    const rows = [{ login: 'alice' }, { login: 'bob' }];
    const out = filterRowsByDecision(rows, { ...baseInputs, sessionLogin: null });
    expect(out).toEqual([]);
  });

  it('mock mode returns rows unchanged (test fixtures stay browsable)', () => {
    const rows = [{ login: 'alice' }, { login: 'bob' }];
    const out = filterRowsByDecision(rows, { ...baseInputs, isMocked: true, sessionLogin: null });
    expect(out).toEqual(rows);
  });

  it('PAT-mode (no auth configured) returns rows unchanged — legacy single-tenant', () => {
    const rows = [{ login: 'alice' }, { login: 'bob' }];
    const out = filterRowsByDecision(rows, { ...baseInputs, authConfigured: false, sessionLogin: null });
    expect(out).toEqual(rows);
  });

  it('supports both `login` and `user_login` row shapes (raw user_totals vs Seat/UserTotals)', () => {
    const rows = [
      { login: 'alice' },
      { user_login: 'bob' },
      { login: 'carol' },
    ];
    expect(filterRowsByDecision(rows, { ...baseInputs, sessionLogin: 'bob' }))
      .toEqual([{ user_login: 'bob' }]);
  });

  it('empty input returns empty output regardless of decision', () => {
    expect(filterRowsByDecision([], { ...baseInputs, sessionLogin: 'alice' })).toEqual([]);
    expect(filterRowsByDecision([], { ...baseInputs, isAdmin: true })).toEqual([]);
    expect(filterRowsByDecision([], { ...baseInputs, isMocked: true })).toEqual([]);
  });
});

describe('restrictUserRowsToSelf (Nuxt-free adapter fallback)', () => {
  const fakeEvent = {} as Parameters<typeof restrictUserRowsToSelf>[0];

  it('returns rows unchanged when isMocked is true', async () => {
    const rows = [{ login: 'alice' }, { login: 'bob' }];
    const out = await restrictUserRowsToSelf(fakeEvent, rows, { isMocked: true });
    expect(out).toEqual(rows);
  });

  it('returns rows unchanged when Nuxt runtime is unavailable (test env -> PAT-mode fallback)', async () => {
    const rows = [{ login: 'alice' }, { login: 'bob' }];
    const out = await restrictUserRowsToSelf(fakeEvent, rows);
    expect(out).toEqual(rows);
  });
});
