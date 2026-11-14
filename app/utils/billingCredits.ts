export interface BillingCreditQuantityFields {
  netQuantity?: number | null;
  discountQuantity?: number | null;
}

function finiteQuantity(value: number | null | undefined): number {
  return Number.isFinite(value) ? value as number : 0;
}

export function billingCreditsUsed(item: BillingCreditQuantityFields): number {
  return finiteQuantity(item.netQuantity) + finiteQuantity(item.discountQuantity);
}

export function sumBillingCreditsUsed(items: BillingCreditQuantityFields[] | null | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + billingCreditsUsed(item), 0);
}
