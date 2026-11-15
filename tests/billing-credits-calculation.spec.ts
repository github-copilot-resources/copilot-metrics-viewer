import { describe, expect, it } from 'vitest';
import { billingCreditsUsed, sumBillingCreditsUsed } from '../app/utils/billingCredits';

describe('billing credit quantity calculations', () => {
  it('keeps discounted consumption separate from money and pooled allowance', () => {
    const fullyDiscounted = {
      netQuantity: 0, discountQuantity: 125.5,
      grossAmount: 1.255, netAmount: 0, total_monthly_quota: 10000,
    };
    expect(billingCreditsUsed(fullyDiscounted)).toBe(125.5);
    expect(sumBillingCreditsUsed([fullyDiscounted, fullyDiscounted])).toBe(251);
  });

  it('handles zero, missing and non-finite quantities without inventing consumption', () => {
    expect(sumBillingCreditsUsed(null)).toBe(0);
    expect(sumBillingCreditsUsed([])).toBe(0);
    expect(billingCreditsUsed({ netQuantity: 0, discountQuantity: 0 })).toBe(0);
    expect(billingCreditsUsed({ netQuantity: null })).toBe(0);
    expect(billingCreditsUsed({ netQuantity: NaN, discountQuantity: Infinity })).toBe(0);
    expect(billingCreditsUsed({ netQuantity: -Infinity, discountQuantity: 2.5 })).toBe(2.5);
  });

  it('uses one credits definition for aggregate tiles and per-user rows', () => {
    const usageItems = [
      { user: 'octo-a', netQuantity: 8, discountQuantity: 2, grossQuantity: 10 },
      { user: 'octo-a', netQuantity: 5, discountQuantity: 1, grossQuantity: 7 },
      { user: 'octo-b', netQuantity: 3.5, discountQuantity: 0.5, grossQuantity: 4 },
    ];

    const tileCredits = sumBillingCreditsUsed(usageItems);
    const perUserCredits = new Map<string, number>();
    for (const item of usageItems) {
      perUserCredits.set(
        item.user,
        (perUserCredits.get(item.user) ?? 0) + billingCreditsUsed(item),
      );
    }

    const perUserCreditsTotal = Array.from(perUserCredits.values()).reduce((sum, credits) => sum + credits, 0);

    expect(tileCredits).toBe(perUserCreditsTotal);
    expect(tileCredits).toBe(20);
    expect(tileCredits).not.toBe(usageItems.reduce((sum, item) => sum + item.grossQuantity, 0));
  });
});
