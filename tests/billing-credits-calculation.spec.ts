import { describe, expect, it } from 'vitest';
import { billingCreditsUsed, sumBillingCreditsUsed } from '../app/utils/billingCredits';

describe('billing credit quantity calculations', () => {
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
