/**
 * Pure aggregation helpers for billing /ai_credit/usage responses.
 *
 * Extracted from server/api/my-usage.get.ts (and reused by any future
 * per-user billing endpoint) so the math can be unit-tested independently
 * of Nuxt $fetch/runtime config.
 */

export interface BillingUsageItem {
  model: string;
  netAmount: number;
  netQuantity: number;
}

export interface AggregatedSpend {
  totalAmount: number;
  totalQuantity: number;
  byModel: { model: string; amount: number; quantity: number }[];
}

/**
 * Roll an array of /ai_credit/usage `usageItems` into a per-model breakdown
 * sorted by spend descending. Missing/non-finite numeric fields are coerced
 * to 0 so a single bad row doesn't NaN the total.
 */
export function aggregateBillingSpend(items: BillingUsageItem[] | undefined | null): AggregatedSpend {
  const safe = Array.isArray(items) ? items : [];
  const byModelMap = new Map<string, { amount: number; quantity: number }>();
  let totalAmount = 0;
  let totalQuantity = 0;
  for (const it of safe) {
    const amount = Number.isFinite(it?.netAmount) ? it.netAmount : 0;
    const quantity = Number.isFinite(it?.netQuantity) ? it.netQuantity : 0;
    totalAmount += amount;
    totalQuantity += quantity;
    const key = it?.model || '(unknown)';
    const prev = byModelMap.get(key) || { amount: 0, quantity: 0 };
    prev.amount += amount;
    prev.quantity += quantity;
    byModelMap.set(key, prev);
  }
  const byModel = Array.from(byModelMap, ([model, v]) => ({ model, amount: v.amount, quantity: v.quantity }))
    .sort((a, b) => b.amount - a.amount);
  return { totalAmount, totalQuantity, byModel };
}
