/**
 * Pure aggregation helpers for billing /ai_credit/usage responses.
 *
 * Extracted from server/api/my-usage.get.ts (and reused by any future
 * per-user billing endpoint) so the math can be unit-tested independently
 * of Nuxt $fetch/runtime config.
 *
 * The aggregator computes BOTH net (post-discount) and gross (list-price)
 * totals — issue #398 revealed that plans on fully-discounted tiers (e.g.
 * Copilot Free / trial standalone orgs) return net=0 on every row while
 * gross reflects actual consumption. Surfacing only net makes the UI look
 * broken ("0 credits used" despite thousands of daily calls); surfacing
 * both lets callers report "you used N credits · $X gross · $Y net".
 */

export interface BillingUsageItem {
  model: string;
  netAmount: number;
  netQuantity: number;
  /** List-price cost before discounts. Missing on legacy rows → treated as 0. */
  grossAmount?: number;
  /** Raw units consumed before the discount is applied. Missing → treated as 0. */
  grossQuantity?: number;
}

export interface AggregatedSpendByModel {
  model: string;
  /** Net amount (what the customer is billed for). */
  amount: number;
  /** Net quantity (units billed, i.e. after discount). */
  quantity: number;
  /** Gross amount (list-price cost pre-discount). */
  grossAmount: number;
  /** Gross quantity (units consumed pre-discount). */
  grossQuantity: number;
}

export interface AggregatedSpend {
  /** Net billed amount summed across all rows (what the customer pays). */
  totalAmount: number;
  /** Net billed quantity summed across all rows. */
  totalQuantity: number;
  /** Gross (list-price) amount summed across all rows. */
  totalGrossAmount: number;
  /** Gross quantity summed across all rows — the true "credits used" number. */
  totalGrossQuantity: number;
  byModel: AggregatedSpendByModel[];
}

/**
 * Roll an array of /ai_credit/usage `usageItems` into a per-model breakdown
 * sorted by GROSS spend descending (so fully-discounted plans — where every
 * netAmount is 0 — still get a meaningful ranking by actual activity).
 * Missing/non-finite numeric fields are coerced to 0 so a single bad row
 * doesn't NaN the total.
 */
export function aggregateBillingSpend(items: BillingUsageItem[] | undefined | null): AggregatedSpend {
  const safe = Array.isArray(items) ? items : [];
  const byModelMap = new Map<string, { amount: number; quantity: number; grossAmount: number; grossQuantity: number }>();
  let totalAmount = 0;
  let totalQuantity = 0;
  let totalGrossAmount = 0;
  let totalGrossQuantity = 0;
  for (const it of safe) {
    const amount = Number.isFinite(it?.netAmount) ? it.netAmount : 0;
    const quantity = Number.isFinite(it?.netQuantity) ? it.netQuantity : 0;
    const grossAmount = Number.isFinite(it?.grossAmount) ? (it.grossAmount as number) : 0;
    const grossQuantity = Number.isFinite(it?.grossQuantity) ? (it.grossQuantity as number) : 0;
    totalAmount += amount;
    totalQuantity += quantity;
    totalGrossAmount += grossAmount;
    totalGrossQuantity += grossQuantity;
    const key = it?.model || '(unknown)';
    const prev = byModelMap.get(key) || { amount: 0, quantity: 0, grossAmount: 0, grossQuantity: 0 };
    prev.amount += amount;
    prev.quantity += quantity;
    prev.grossAmount += grossAmount;
    prev.grossQuantity += grossQuantity;
    byModelMap.set(key, prev);
  }
  const byModel = Array.from(byModelMap, ([model, v]) => ({
    model,
    amount: v.amount,
    quantity: v.quantity,
    grossAmount: v.grossAmount,
    grossQuantity: v.grossQuantity,
  }))
    // Sort by gross so fully-discounted plans (all net=0) still get a
    // stable, meaningful ordering. Falls back to net when both grosses match.
    .sort((a, b) => (b.grossAmount - a.grossAmount) || (b.amount - a.amount));
  return { totalAmount, totalQuantity, totalGrossAmount, totalGrossQuantity, byModel };
}
