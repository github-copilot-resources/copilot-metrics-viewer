/**
 * Unit tests for the pure billing-spend aggregator.
 *
 * The aggregator is the math layer behind /api/my-usage's "Your AI credit
 * spend" card and any future per-user billing surface. It must:
 *   - sum amounts/quantities across SKUs and models
 *   - collapse multiple rows for the same model into one entry
 *   - sort the breakdown by spend descending (so the UI shows top spend first)
 *   - tolerate missing/empty input without throwing
 *   - coerce non-finite numeric fields to 0 (so one bad row can't NaN totals)
 */

import { describe, it, expect } from 'vitest';
import { aggregateBillingSpend } from '../server/utils/billing-spend-aggregator';

describe('aggregateBillingSpend', () => {
  it('returns zeros for empty / null / undefined input', () => {
    expect(aggregateBillingSpend([])).toEqual({
      totalAmount: 0, totalQuantity: 0,
      totalGrossAmount: 0, totalGrossQuantity: 0,
      byModel: [],
    });
    expect(aggregateBillingSpend(undefined)).toEqual({
      totalAmount: 0, totalQuantity: 0,
      totalGrossAmount: 0, totalGrossQuantity: 0,
      byModel: [],
    });
    expect(aggregateBillingSpend(null)).toEqual({
      totalAmount: 0, totalQuantity: 0,
      totalGrossAmount: 0, totalGrossQuantity: 0,
      byModel: [],
    });
  });

  it('sums amounts and quantities across multiple items', () => {
    const result = aggregateBillingSpend([
      { model: 'claude-sonnet-4.5', netAmount: 100, netQuantity: 10, grossAmount: 120, grossQuantity: 12 },
      { model: 'gpt-5', netAmount: 50, netQuantity: 5, grossAmount: 55, grossQuantity: 5.5 },
    ]);
    expect(result.totalAmount).toBe(150);
    expect(result.totalQuantity).toBe(15);
    expect(result.totalGrossAmount).toBe(175);
    expect(result.totalGrossQuantity).toBe(17.5);
  });

  it('collapses multiple rows for the same model into one entry', () => {
    const result = aggregateBillingSpend([
      { model: 'claude-sonnet-4.5', netAmount: 100, netQuantity: 10, grossAmount: 100, grossQuantity: 10 },
      { model: 'claude-sonnet-4.5', netAmount: 25, netQuantity: 3, grossAmount: 30, grossQuantity: 3 },
      { model: 'gpt-5', netAmount: 40, netQuantity: 4, grossAmount: 40, grossQuantity: 4 },
    ]);
    expect(result.byModel).toHaveLength(2);
    const claude = result.byModel.find(m => m.model === 'claude-sonnet-4.5');
    expect(claude).toEqual({
      model: 'claude-sonnet-4.5',
      amount: 125, quantity: 13,
      grossAmount: 130, grossQuantity: 13,
    });
  });

  it('sorts breakdown by gross amount descending (activity ordering) so fully-discounted plans still rank models', () => {
    // Issue #398 scenario: all netAmounts are 0 (fully discounted), so sorting
    // by net gives an arbitrary order. Sort by gross (actual activity) instead.
    const result = aggregateBillingSpend([
      { model: 'low',  netAmount: 0, netQuantity: 0, grossAmount: 1,    grossQuantity: 1 },
      { model: 'high', netAmount: 0, netQuantity: 0, grossAmount: 1000, grossQuantity: 100 },
      { model: 'mid',  netAmount: 0, netQuantity: 0, grossAmount: 50,   grossQuantity: 5 },
    ]);
    expect(result.byModel.map(m => m.model)).toEqual(['high', 'mid', 'low']);
  });

  it('coerces non-finite numeric fields to 0 (defensive against bad rows)', () => {
    const result = aggregateBillingSpend([
      { model: 'good', netAmount: 100, netQuantity: 10, grossAmount: 100, grossQuantity: 10 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { model: 'bad',  netAmount: NaN as any, netQuantity: Infinity as any, grossAmount: NaN as any, grossQuantity: Infinity as any },
    ]);
    expect(result.totalAmount).toBe(100);
    expect(result.totalQuantity).toBe(10);
    expect(result.totalGrossAmount).toBe(100);
    expect(result.totalGrossQuantity).toBe(10);
    const bad = result.byModel.find(m => m.model === 'bad');
    expect(bad).toEqual({ model: 'bad', amount: 0, quantity: 0, grossAmount: 0, grossQuantity: 0 });
  });

  it('uses "(unknown)" key when a row has no model name', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = aggregateBillingSpend([{ model: undefined as any, netAmount: 5, netQuantity: 1, grossAmount: 6, grossQuantity: 1.2 }]);
    expect(result.byModel).toEqual([
      { model: '(unknown)', amount: 5, quantity: 1, grossAmount: 6, grossQuantity: 1.2 },
    ]);
  });

  // ── Issue #398 regression: fully-discounted plans ─────────────────────────
  it('surfaces gross totals for plans where every item is fully discounted (issue #398)', () => {
    // Standalone org on a fully-discounted (Copilot Free / trial) plan — every
    // usage item comes back with net=0 but the gross values reflect actual
    // consumption. UI must still be able to show "you used N credits" without
    // reporting a misleading 0.
    const result = aggregateBillingSpend([
      { model: 'Auto: Claude Haiku 4.5', netAmount: 0, netQuantity: 0, grossAmount: 5.67, grossQuantity: 567.04 },
      { model: 'Auto: GPT-5.4',          netAmount: 0, netQuantity: 0, grossAmount: 11.31, grossQuantity: 1131.45 },
    ]);
    expect(result.totalAmount).toBe(0);
    expect(result.totalQuantity).toBe(0);
    expect(result.totalGrossAmount).toBeCloseTo(16.98, 2);
    expect(result.totalGrossQuantity).toBeCloseTo(1698.49, 2);
  });

  it('tolerates items missing grossAmount/grossQuantity (older API rows)', () => {
    const result = aggregateBillingSpend([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { model: 'legacy', netAmount: 5, netQuantity: 1 } as any,
    ]);
    expect(result.totalAmount).toBe(5);
    expect(result.totalGrossAmount).toBe(0);
    expect(result.byModel[0]).toEqual({ model: 'legacy', amount: 5, quantity: 1, grossAmount: 0, grossQuantity: 0 });
  });
});
