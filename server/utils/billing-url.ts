/**
 * URL-selection helper for the GitHub AI credit billing endpoint.
 *
 * Extracted from server/api/billing-credits.get.ts so it can be unit-tested
 * without pulling in Nuxt's auto-imported runtime helpers (defineEventHandler etc.).
 */

export interface BuildBillingApiUrlOptions {
  baseUrl: string;
  scope: string | undefined;
  githubOrg?: string;
  githubEnt?: string;
  billingEnterprise?: string;
}

/**
 * Build the billing API URL, honoring the NUXT_BILLING_ENTERPRISE override.
 *
 * Priority:
 *   1. billingEnterprise (NUXT_BILLING_ENTERPRISE override) → /enterprises/{slug}/...
 *   2. scope === 'enterprise'                              → /enterprises/{githubEnt}/...
 *   3. scope === 'organization'                            → /organizations/{githubOrg}/...
 */
export function buildBillingApiUrl(opts: BuildBillingApiUrlOptions): string {
  const base = opts.baseUrl.replace(/\/$/, '');
  if (opts.billingEnterprise && opts.billingEnterprise.trim()) {
    return `${base}/enterprises/${opts.billingEnterprise.trim()}/settings/billing/ai_credit/usage`;
  }
  if (opts.scope === 'enterprise') {
    if (!opts.githubEnt) {
      throw new Error('GitHub enterprise must be set for enterprise scope');
    }
    return `${base}/enterprises/${opts.githubEnt}/settings/billing/ai_credit/usage`;
  }
  if (opts.scope === 'organization') {
    if (!opts.githubOrg) {
      throw new Error('GitHub organization must be set for organization scope');
    }
    return `${base}/organizations/${opts.githubOrg}/settings/billing/ai_credit/usage`;
  }
  throw new Error(`Invalid scope: ${opts.scope}`);
}
