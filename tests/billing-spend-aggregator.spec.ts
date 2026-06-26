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
    expect(aggregateBillingSpend([])).toEqual({ totalAmount: 0, totalQuantity: 0, byModel: [] });
    expect(aggregateBillingSpend(undefined)).toEqual({ totalAmount: 0, totalQuantity: 0, byModel: [] });
    expect(aggregateBillingSpend(null)).toEqual({ totalAmount: 0, totalQuantity: 0, byModel: [] });
  });

  it('sums amounts and quantities across multiple items', () => {
    const result = aggregateBillingSpend([
      { model: 'claude-sonnet-4.5', netAmount: 100, netQuantity: 10 },
      { model: 'gpt-5', netAmount: 50, netQuantity: 5 },
    ]);
    expect(result.totalAmount).toBe(150);
    expect(result.totalQuantity).toBe(15);
  });

  it('collapses multiple rows for the same model into one entry', () => {
    const result = aggregateBillingSpend([
      { model: 'claude-sonnet-4.5', netAmount: 100, netQuantity: 10 },
      { model: 'claude-sonnet-4.5', netAmount: 25, netQuantity: 3 },
      { model: 'gpt-5', netAmount: 40, netQuantity: 4 },
    ]);
    expect(result.byModel).toHaveLength(2);
    const claude = result.byModel.find(m => m.model === 'claude-sonnet-4.5');
    expect(claude).toEqual({ model: 'claude-sonnet-4.5', amount: 125, quantity: 13 });
  });

  it('sorts breakdown by amount descending', () => {
    const result = aggregateBillingSpend([
      { model: 'low', netAmount: 1, netQuantity: 1 },
      { model: 'high', netAmount: 1000, netQuantity: 1 },
      { model: 'mid', netAmount: 50, netQuantity: 1 },
    ]);
    expect(result.byModel.map(m => m.model)).toEqual(['high', 'mid', 'low']);
  });

  it('coerces non-finite numeric fields to 0 (defensive against bad rows)', () => {
    const result = aggregateBillingSpend([
      { model: 'good', netAmount: 100, netQuantity: 10 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { model: 'bad', netAmount: NaN as any, netQuantity: Infinity as any },
    ]);
    expect(result.totalAmount).toBe(100);
    expect(result.totalQuantity).toBe(10);
    const bad = result.byModel.find(m => m.model === 'bad');
    expect(bad).toEqual({ model: 'bad', amount: 0, quantity: 0 });
  });

  it('uses "(unknown)" key when a row has no model name', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = aggregateBillingSpend([{ model: undefined as any, netAmount: 5, netQuantity: 1 }]);
    expect(result.byModel).toEqual([{ model: '(unknown)', amount: 5, quantity: 1 }]);
  });
});
