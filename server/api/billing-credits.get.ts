/**
 * GET /api/billing-credits — admin only
 *
 * Wraps the GitHub AI credit billing usage endpoint:
 *   - /organizations/{org}/settings/billing/ai_credit/usage
 *   - /enterprises/{ent}/settings/billing/ai_credit/usage
 *
 * Returns the aggregate breakdown by SKU/model/cost-center/repo that GitHub
 * provides natively. We deliberately do NOT support the `?user=` filter — it
 * 403s on enterprise-owned orgs. Per-user data lives on the users-28-day
 * metrics report via the new `ai_credits_used` field (see /api/my-usage).
 *
 * Auth:
 *   - 401 if no session (caught by middleware)
 *   - 403 if the session user is not in NUXT_USAGE_ADMINS
 *
 * Required GitHub credential scope/permission:
 *   - Classic PAT: `manage_billing:copilot` (works for both org and ent)
 *   - GitHub App: Organization → Administration: Read (for org scope)
 *                 or Enterprise billing: Read (for enterprise scope)
 *   - Token requirement is enforced by GitHub returning 403 — we surface the
 *     message as-is to make troubleshooting easier.
 *
 * Forwarded query params: year, month, day, model, product, cost_center_id
 */

import { Options } from '@/model/Options';
import { requireUsageAdmin } from '../utils/usage-admin';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockBilling from '../../public/mock-data/billing-credits.json';

export interface BillingUsageItem {
  product: string;
  sku: string;
  model: string;
  unitType: string;
  pricePerUnit: number;
  grossQuantity: number;
  grossAmount: number;
  discountQuantity: number;
  discountAmount: number;
  netQuantity: number;
  netAmount: number;
  costCenterId?: string;
  costCenterName?: string;
  repositoryName?: string;
}

export interface BillingCreditsResponse {
  timePeriod: { year?: number; month?: number; day?: number };
  organization?: string;
  enterprise?: string;
  usageItems: BillingUsageItem[];
}

export default defineEventHandler(async (event): Promise<BillingCreditsResponse> => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // ── Admin gate ─────────────────────────────────────────────────────────────
  // In mock mode, skip the admin check so the fixture-driven E2E tests can
  // exercise the tab without configuring NUXT_USAGE_ADMINS.
  if (!options.isDataMocked) {
    await requireUsageAdmin(event);
  }

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (options.isDataMocked) {
    return mockBilling as BillingCreditsResponse;
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  if (!event.context.headers?.has('Authorization')) {
    throw createError({
      statusCode: 503,
      statusMessage: 'No GitHub credential configured — set NUXT_GITHUB_TOKEN or NUXT_GITHUB_APP_ID + NUXT_GITHUB_APP_PRIVATE_KEY',
    });
  }

  const identifier = options.githubOrg || options.githubEnt || '';
  if (!identifier) {
    throw createError({ statusCode: 400, statusMessage: 'GitHub organization or enterprise must be configured' });
  }

  let apiUrl: string;
  try {
    apiUrl = options.getBillingCreditsApiUrl();
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: String(err) });
  }

  // Forward only the safe, documented filter params — never `user`.
  const forwardParams: Record<string, string> = {};
  for (const key of ['year', 'month', 'day', 'model', 'product', 'cost_center_id']) {
    const v = query[key];
    if (v !== undefined && v !== null && v !== '') {
      forwardParams[key] = String(v);
    }
  }

  const urlWithParams = Object.keys(forwardParams).length > 0
    ? `${apiUrl}?${new URLSearchParams(forwardParams).toString()}`
    : apiUrl;

  logger.info(`Fetching billing credits from ${apiUrl}`);

  try {
    // Build headers explicitly — DO NOT spread event.context.headers, because
    // $fetch concatenates duplicate header values (the middleware sets
    // X-GitHub-Api-Version: 2022-11-28; spreading + overriding produces
    // "2022-11-28, 2026-03-10" which GitHub rejects with 400 Bad Request).
    // The billing API requires the newer 2026-03-10 version.
    const auth = event.context.headers.get('Authorization') || '';
    const ghHeaders = new Headers({
      Authorization: auth,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    });

    const response = await $fetch<BillingCreditsResponse>(urlWithParams, {
      headers: ghHeaders,
    });
    return response;
  } catch (error: unknown) {
    logger.error('Error fetching billing credits:', error);
    const err = (typeof error === 'object' && error) ? error as {
      statusCode?: number;
      data?: { message?: string };
      message?: string;
    } : {};
    const status = err.statusCode || 500;
    const ghMessage = err.data?.message || err.message || String(error);
    throw createError({
      statusCode: status,
      statusMessage: `GitHub billing API error (${status}): ${ghMessage}`,
      data: err.data,
    });
  }
});
