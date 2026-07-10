// @vitest-environment node
/**
 * Unit tests for the Phase B billing reader.
 *
 * Pure-function tests for `resolveWindow` + `mapAggregateRowToItem` derivation
 * run synchronously. DB-bound functions (`decideSource`, `aggregateForBilling`,
 * `aggregateForBillingByUser`) are exercised against a mocked `getPool()` that
 * captures SQL + params and returns canned rows — enough to pin behavior
 * without needing a real Postgres in CI.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../server/storage/db', () => ({
  getPool: () => ({ query: mockQuery }),
  isDbConfigured: () => true,
}));

import {
  resolveWindow,
  decideSource,
  aggregateForBilling,
  aggregateForBillingByUser,
  subtractRanges,
  findBillingCsvGaps,
} from '../server/services/billing-credit-reader';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('resolveWindow', () => {
  it('expands year+month to the full calendar month', () => {
    const w = resolveWindow({ year: 2026, month: 6 });
    expect(w.startDate).toBe('2026-06-01');
    expect(w.endDate).toBe('2026-06-30');
    expect(w.timePeriod).toEqual({ year: 2026, month: 6 });
  });

  it('handles February in leap years correctly', () => {
    const w = resolveWindow({ year: 2024, month: 2 });
    expect(w.endDate).toBe('2024-02-29');
  });

  it('handles February in non-leap years correctly', () => {
    const w = resolveWindow({ year: 2025, month: 2 });
    expect(w.endDate).toBe('2025-02-28');
  });

  it('expands year-only to the full calendar year', () => {
    const w = resolveWindow({ year: 2026 });
    expect(w.startDate).toBe('2026-01-01');
    expect(w.endDate).toBe('2026-12-31');
    expect(w.timePeriod).toEqual({ year: 2026 });
  });

  it('treats year+month+day as a single-day window', () => {
    const w = resolveWindow({ year: 2026, month: 6, day: 15 });
    expect(w.startDate).toBe('2026-06-15');
    expect(w.endDate).toBe('2026-06-15');
  });

  it('zero-pads single-digit month and day', () => {
    const w = resolveWindow({ year: 2026, month: 3, day: 5 });
    expect(w.startDate).toBe('2026-03-05');
    expect(w.endDate).toBe('2026-03-05');
  });

  it('defaults to the current UTC month when nothing is specified', () => {
    const w = resolveWindow({});
    const now = new Date();
    expect(w.startDate.startsWith(String(now.getUTCFullYear()))).toBe(true);
    expect(w.timePeriod.year).toBe(now.getUTCFullYear());
    expect(w.timePeriod.month).toBe(now.getUTCMonth() + 1);
  });

  it('rejects out-of-range month', () => {
    expect(() => resolveWindow({ year: 2026, month: 13 })).toThrow(/month/i);
    expect(() => resolveWindow({ year: 2026, month: 0 })).toThrow(/month/i);
  });

  it('rejects day without month', () => {
    expect(() => resolveWindow({ year: 2026, day: 5 })).toThrow(/day without month/i);
  });

  it('accepts since+until as a custom range with empty timePeriod', () => {
    const w = resolveWindow({ since: '2026-06-01', until: '2026-06-30' });
    expect(w.startDate).toBe('2026-06-01');
    expect(w.endDate).toBe('2026-06-30');
    expect(w.timePeriod).toEqual({});
  });

  it('range mode takes precedence over year/month/day', () => {
    const w = resolveWindow({
      year: 2020, month: 1, day: 1,
      since: '2026-06-15', until: '2026-06-20',
    });
    expect(w.startDate).toBe('2026-06-15');
    expect(w.endDate).toBe('2026-06-20');
    expect(w.timePeriod).toEqual({});
  });

  it('rejects since without until (and vice versa)', () => {
    expect(() => resolveWindow({ since: '2026-06-01' })).toThrow(/both.*since.*until/i);
    expect(() => resolveWindow({ until: '2026-06-30' })).toThrow(/both.*since.*until/i);
  });

  it('rejects malformed ISO dates in since/until', () => {
    expect(() => resolveWindow({ since: '2026/06/01', until: '2026-06-30' })).toThrow(/YYYY-MM-DD/i);
    expect(() => resolveWindow({ since: '2026-06-01', until: '06-30-2026' })).toThrow(/YYYY-MM-DD/i);
  });

  it('rejects since > until', () => {
    expect(() => resolveWindow({ since: '2026-07-01', until: '2026-06-01' }))
      .toThrow(/since.*<=.*until/i);
  });
});

describe('decideSource', () => {
  it('returns live when enterprise is empty', async () => {
    const d = await decideSource('', '2026-06-01', '2026-06-30');
    expect(d.source).toBe('live');
    expect(d.jobId).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns db when a completed job covers the window', async () => {
    const completedAt = new Date('2026-06-27T10:00:00Z');
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 42, completed_at: completedAt }] });
    const d = await decideSource('ent', '2026-06-01', '2026-06-30');
    expect(d.source).toBe('db');
    expect(d.jobId).toBe(42);
    expect(d.lastIngestAt).toBe(completedAt.toISOString());
    expect(d.reason).toMatch(/job #42/);
    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toMatch(/status\s*=\s*'completed'/);
    expect(sql).toMatch(/start_date\s*<=/);
    expect(sql).toMatch(/end_date\s*>=/);
    expect(params).toEqual(['ent', '2026-06-01', '2026-06-30']);
  });

  it('returns live when no completed job covers the window', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const d = await decideSource('ent', '2026-04-01', '2026-04-30');
    expect(d.source).toBe('live');
    expect(d.jobId).toBeNull();
    expect(d.reason).toMatch(/no completed ingest job covers 2026-04-01..2026-04-30/);
  });

  it('falls back to live (not 500) when the DB query throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    const d = await decideSource('ent', '2026-06-01', '2026-06-30');
    expect(d.source).toBe('live');
    expect(d.reason).toMatch(/coverage query failed.*connection refused/);
  });
});

describe('aggregateForBilling', () => {
  it('emits a single grouped row mapped to the BillingUsageItem shape', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'gpt-4o',
        unit_type: 'credits',
        price_per_unit: 0.01,
        gross_quantity: 100,
        gross_amount: 1.0,
        discount_amount: 1.0,
        net_amount: 0,
      }],
    });

    const resp = await aggregateForBilling('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30',
      timePeriod: { year: 2026, month: 6 },
    });

    expect(resp.enterprise).toBe('ent');
    expect(resp.timePeriod).toEqual({ year: 2026, month: 6 });
    expect(resp.usageItems).toHaveLength(1);
    const item = resp.usageItems[0]!;
    expect(item.product).toBe('copilot');
    expect(item.sku).toBe('copilot_ai_credit');
    expect(item.model).toBe('gpt-4o');
    expect(item.unitType).toBe('credits');
    expect(item.pricePerUnit).toBe(0.01);
    expect(item.grossQuantity).toBe(100);
    expect(item.grossAmount).toBe(1.0);
    expect(item.netAmount).toBe(0);
    // 100% discount → all quantity is discounted, zero net
    expect(item.discountQuantity).toBe(100);
    expect(item.netQuantity).toBe(0);
  });

  it('derives net/discount quantities proportionally on partial discount', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        product: 'copilot', sku: 'copilot_premium_request', model: 'claude-sonnet-4', unit_type: 'requests',
        price_per_unit: 0.04,
        gross_quantity: 100,
        gross_amount: 4.0,
        discount_amount: 1.0,  // 25% discount
        net_amount: 3.0,
      }],
    });
    const resp = await aggregateForBilling('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    });
    const item = resp.usageItems[0]!;
    expect(item.discountQuantity).toBeCloseTo(25, 6);
    expect(item.netQuantity).toBeCloseTo(75, 6);
  });

  it('degrades to netQuantity=grossQuantity when grossAmount is 0', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        product: 'copilot', sku: 'copilot_ai_credit', model: 'gpt-4o', unit_type: 'credits',
        price_per_unit: 0, gross_quantity: 50, gross_amount: 0, discount_amount: 0, net_amount: 0,
      }],
    });
    const resp = await aggregateForBilling('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    });
    expect(resp.usageItems[0]!.netQuantity).toBe(50);
    expect(resp.usageItems[0]!.discountQuantity).toBe(0);
  });

  it('passes filter params through to the SQL bind list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await aggregateForBilling('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    }, { user: 'alice', organization: 'org1', model: 'gpt-4o' });

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toMatch(/username = \$/);
    expect(sql).toMatch(/organization = \$/);
    expect(sql).toMatch(/model = \$/);
    expect(params).toEqual(['ent', '2026-06-01', '2026-06-30', 'alice', 'org1', 'gpt-4o']);
  });

  it('echoes organization and user back into the response envelope when filtered', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const resp = await aggregateForBilling('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    }, { user: 'alice', organization: 'org1' });
    expect(resp.organization).toBe('org1');
    expect(resp.user).toBe('alice');
  });
});

describe('aggregateForBillingByUser', () => {
  it('returns an empty envelope when logins[] is empty without touching the DB', async () => {
    const resp = await aggregateForBillingByUser('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    }, []);
    expect(resp.usageItems).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('groups by username and tags each item with the user field (case-insensitive match)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          username: 'alice', product: 'copilot', sku: 'copilot_ai_credit', model: 'gpt-4o',
          unit_type: 'credits', price_per_unit: 0.01, gross_quantity: 10, gross_amount: 0.1,
          discount_amount: 0.1, net_amount: 0,
        },
        {
          username: 'bob', product: 'copilot', sku: 'copilot_ai_credit', model: 'gpt-4o',
          unit_type: 'credits', price_per_unit: 0.01, gross_quantity: 20, gross_amount: 0.2,
          discount_amount: 0.2, net_amount: 0,
        },
      ],
    });
    const resp = await aggregateForBillingByUser('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    }, ['Alice', 'BOB']);

    expect(resp.usageItems).toHaveLength(2);
    expect(resp.usageItems[0]!.user).toBe('alice');
    expect(resp.usageItems[1]!.user).toBe('bob');

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toMatch(/LOWER\(username\) = ANY/);
    expect(sql).toMatch(/GROUP BY username/);
    // Logins must be lower-cased before being bound to the ANY($::text[]) param.
    expect(params[3]).toEqual(['alice', 'bob']);
  });

  it('omits user field when username is blank (system actor)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        username: '', product: 'copilot', sku: 'copilot_ai_credit', model: '',
        unit_type: '', price_per_unit: 0, gross_quantity: 5, gross_amount: 0,
        discount_amount: 0, net_amount: 0,
      }],
    });
    const resp = await aggregateForBillingByUser('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    }, ['anyone']);
    expect(resp.usageItems[0]!.user).toBeUndefined();
  });

  it('passes filter literals as bind params (SQL injection guard)', async () => {
    // Defence-in-depth — pg already parameterizes, but verify we never
    // string-interpolate user-supplied values into the SQL text.
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const evilModel = "gpt-4o'; DROP TABLE billing_credit_usage; --";
    await aggregateForBillingByUser('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    }, ['alice'], { model: evilModel });

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain(evilModel);
    expect(params).toContain(evilModel);
  });
});

describe('edge cases', () => {
  it('decideSource: prefers the most recent completed job when multiple cover the window (LIMIT 1 + ORDER BY)', async () => {
    // We only verify the SQL — pg's executor handles ORDER BY DESC LIMIT 1.
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 999, completed_at: new Date('2026-06-28T00:00:00Z') }] });
    await decideSource('ent', '2026-06-01', '2026-06-30');
    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toMatch(/ORDER BY completed_at DESC/);
    expect(sql).toMatch(/LIMIT 1/);
  });

  it('decideSource: requires start_date <= AND end_date >= (superset, not overlap)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await decideSource('ent', '2026-06-01', '2026-06-30');
    const [sql] = mockQuery.mock.calls[0]!;
    // Critical: a partially-overlapping job (e.g. covers May 15–Jun 15) must
    // NOT satisfy this — the test pins the operator direction.
    expect(sql).toMatch(/start_date\s*<=\s*\$2/);
    expect(sql).toMatch(/end_date\s*>=\s*\$3/);
  });

  it('aggregateForBilling: omits the empty organization/user fields from the envelope', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const resp = await aggregateForBilling('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    });
    expect(resp.organization).toBeUndefined();
    expect(resp.user).toBeUndefined();
    expect(resp.enterprise).toBe('ent');
  });

  it('aggregateForBilling: treats empty-string filter values as "no filter"', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await aggregateForBilling('ent', {
      startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 },
    }, { user: '', model: '', organization: '' });
    const [sql, params] = mockQuery.mock.calls[0]!;
    // Only enterprise + date binds (3 params) — none of the filters should
    // have been appended.
    expect(params).toHaveLength(3);
    expect(sql).not.toMatch(/username = /);
    expect(sql).not.toMatch(/model = /);
    expect(sql).not.toMatch(/organization = /);
  });
});

describe('subtractRanges', () => {
  it('returns the full window when nothing is covered', () => {
    expect(subtractRanges({ start: '2026-04-01', end: '2026-06-29' }, []))
      .toEqual([{ start: '2026-04-01', end: '2026-06-29' }]);
  });

  it('returns an empty list when the window is fully covered by one range', () => {
    expect(subtractRanges(
      { start: '2026-04-01', end: '2026-06-29' },
      [{ start: '2026-03-15', end: '2026-07-01' }],
    )).toEqual([]);
  });

  it('returns prefix + suffix gaps around a single inner covered range', () => {
    // Exactly the user-reported scenario from 2026-06-29.
    const gaps = subtractRanges(
      { start: '2026-04-01', end: '2026-06-29' },
      [{ start: '2026-05-01', end: '2026-06-27' }],
    );
    expect(gaps).toEqual([
      { start: '2026-04-01', end: '2026-04-30' },
      { start: '2026-06-28', end: '2026-06-29' },
    ]);
  });

  it('merges overlapping covered ranges', () => {
    const gaps = subtractRanges(
      { start: '2026-04-01', end: '2026-06-30' },
      [
        { start: '2026-04-15', end: '2026-05-15' },
        { start: '2026-05-10', end: '2026-05-31' }, // overlaps with previous
      ],
    );
    // After merging the two ranges (Apr15..May31), the gaps are Apr1-14 and Jun1-30
    expect(gaps).toEqual([
      { start: '2026-04-01', end: '2026-04-14' },
      { start: '2026-06-01', end: '2026-06-30' },
    ]);
  });

  it('merges adjacent ranges (no one-day gap between)', () => {
    // Two completed jobs that abut (end of one = day-before-start of next)
    // should NOT produce a zero-day gap between them.
    const gaps = subtractRanges(
      { start: '2026-04-01', end: '2026-06-30' },
      [
        { start: '2026-04-10', end: '2026-04-20' },
        { start: '2026-04-21', end: '2026-04-30' }, // adjacent — no gap
      ],
    );
    expect(gaps).toEqual([
      { start: '2026-04-01', end: '2026-04-09' },
      { start: '2026-05-01', end: '2026-06-30' },
    ]);
  });

  it('clips covered ranges that extend beyond the window', () => {
    const gaps = subtractRanges(
      { start: '2026-04-01', end: '2026-04-30' },
      [{ start: '2026-01-01', end: '2026-04-15' }],
    );
    expect(gaps).toEqual([{ start: '2026-04-16', end: '2026-04-30' }]);
  });

  it('ignores covered ranges that are entirely outside the window', () => {
    const gaps = subtractRanges(
      { start: '2026-04-01', end: '2026-04-30' },
      [
        { start: '2025-01-01', end: '2025-12-31' },
        { start: '2027-01-01', end: '2027-12-31' },
      ],
    );
    expect(gaps).toEqual([{ start: '2026-04-01', end: '2026-04-30' }]);
  });

  it('handles a degenerate single-day window', () => {
    expect(subtractRanges(
      { start: '2026-06-29', end: '2026-06-29' },
      [],
    )).toEqual([{ start: '2026-06-29', end: '2026-06-29' }]);

    expect(subtractRanges(
      { start: '2026-06-29', end: '2026-06-29' },
      [{ start: '2026-06-29', end: '2026-06-29' }],
    )).toEqual([]);
  });

  it('returns [] when start > end (invalid window)', () => {
    expect(subtractRanges({ start: '2026-06-30', end: '2026-06-01' }, [])).toEqual([]);
  });

  it('handles multiple separate covered ranges', () => {
    const gaps = subtractRanges(
      { start: '2026-04-01', end: '2026-06-30' },
      [
        { start: '2026-04-10', end: '2026-04-15' },
        { start: '2026-05-20', end: '2026-05-25' },
      ],
    );
    expect(gaps).toEqual([
      { start: '2026-04-01', end: '2026-04-09' },
      { start: '2026-04-16', end: '2026-05-19' },
      { start: '2026-05-26', end: '2026-06-30' },
    ]);
  });
});

describe('findBillingCsvGaps', () => {
  it('returns the full window when enterprise is empty', async () => {
    const gaps = await findBillingCsvGaps('', '2026-04-01', '2026-06-29');
    expect(gaps).toEqual([{ start: '2026-04-01', end: '2026-06-29' }]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns the full window when no completed jobs exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const gaps = await findBillingCsvGaps('ent', '2026-04-01', '2026-06-29');
    expect(gaps).toEqual([{ start: '2026-04-01', end: '2026-06-29' }]);
  });

  it('subtracts existing completed jobs and returns the unmet gaps', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ start_date: '2026-05-01', end_date: '2026-06-27' }],
    });
    const gaps = await findBillingCsvGaps('ent', '2026-04-01', '2026-06-29');
    expect(gaps).toEqual([
      { start: '2026-04-01', end: '2026-04-30' },
      { start: '2026-06-28', end: '2026-06-29' },
    ]);
    // Verify the SQL is intersection-correct: existing.start <= win.end AND existing.end >= win.start
    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toMatch(/start_date\s*<=\s*\$3/);
    expect(sql).toMatch(/end_date\s*>=\s*\$2/);
    expect(params).toEqual(['ent', '2026-04-01', '2026-06-29']);
  });

  it('accepts pg Date objects (DATE column read-back)', async () => {
    // pg returns DATE as a JS Date in local TZ; verify the toIsoDate helper
    // converts it back to YYYY-MM-DD strings before passing to subtractRanges.
    mockQuery.mockResolvedValueOnce({
      rows: [{ start_date: new Date('2026-05-01T00:00:00Z'), end_date: new Date('2026-06-27T00:00:00Z') }],
    });
    const gaps = await findBillingCsvGaps('ent', '2026-04-01', '2026-06-29');
    expect(gaps).toEqual([
      { start: '2026-04-01', end: '2026-04-30' },
      { start: '2026-06-28', end: '2026-06-29' },
    ]);
  });

  it('falls back to full window when the DB query throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    const gaps = await findBillingCsvGaps('ent', '2026-04-01', '2026-06-29');
    expect(gaps).toEqual([{ start: '2026-04-01', end: '2026-06-29' }]);
  });
});
