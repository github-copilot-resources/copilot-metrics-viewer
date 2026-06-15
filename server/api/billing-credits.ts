/**
 * AI Credit Billing Usage API endpoint
 * GET /api/billing-credits
 *
 * Returns AI credit usage data for an organization or enterprise.
 * Uses the GitHub Billing API: /organizations/{org}/settings/billing/ai_credit/usage
 *
 * Query parameters (forwarded to GitHub):
 *   year    - 4-digit year (defaults to current year)
 *   month   - 1-12 (defaults to current month)
 *   day     - 1-31 (optional)
 *   model   - filter by model name
 *   product - filter by product name
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Options } from '@/model/Options';

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
}

export interface BillingCreditsResponse {
  timePeriod: { year?: number; month?: number; day?: number };
  organization?: string;
  enterprise?: string;
  usageItems: BillingUsageItem[];
}

const MOCK_DATA_PATH = 'public/mock-data/organization-billing-credits.json';

export default defineEventHandler(async (event): Promise<BillingCreditsResponse> => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (options.isDataMocked) {
    try {
      const path = resolve(MOCK_DATA_PATH);
      const data = JSON.parse(readFileSync(path, 'utf8')) as BillingCreditsResponse;
      return data;
    } catch (err) {
      logger.error('Failed to read billing credits mock data:', err);
      throw createError({ statusCode: 500, statusMessage: 'Failed to read mock billing data' });
    }
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  if (!event.context.headers?.has('Authorization')) {
    logger.error('No Authentication provided for billing-credits endpoint');
    throw createError({ statusCode: 401, statusMessage: 'No Authentication provided' });
  }

  // ── Live API fetch ─────────────────────────────────────────────────────────
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

  // Forward optional query parameters to GitHub API
  const forwardParams: Record<string, string> = {};
  if (query.year) forwardParams.year = String(query.year);
  if (query.month) forwardParams.month = String(query.month);
  if (query.day) forwardParams.day = String(query.day);
  if (query.user) forwardParams.user = String(query.user);
  if (query.model) forwardParams.model = String(query.model);
  if (query.product) forwardParams.product = String(query.product);

  const urlWithParams = Object.keys(forwardParams).length > 0
    ? `${apiUrl}?${new URLSearchParams(forwardParams).toString()}`
    : apiUrl;

  logger.info(`Fetching billing credits from ${apiUrl}`);

  try {
    const response = await $fetch<BillingCreditsResponse>(urlWithParams, {
      headers: {
        ...Object.fromEntries(event.context.headers.entries()),
        'X-GitHub-Api-Version': '2026-03-10',
        'Accept': 'application/vnd.github+json',
      }
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
      statusMessage: `GitHub API error (${status}): ${ghMessage}`,
      data: err.data,
    });
  }
});
