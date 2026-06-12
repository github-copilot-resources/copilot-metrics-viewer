/**
 * Per-user AI Credit Billing Usage API endpoint
 * GET /api/billing-credits-users
 *
 * Returns AI credit usage broken down by user for an organization or enterprise.
 * Fetches the list of users with Copilot seats, then queries the GitHub Billing
 * AI Credit API for each user in parallel (capped at MAX_USERS).
 *
 * Query parameters:
 *   year    - 4-digit year (defaults to current year)
 *   month   - 1-12 (defaults to current month)
 *   day     - 1-31 (optional)
 *   product - filter by product name
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Options } from '@/model/Options';
import type { BillingUsageItem } from './billing-credits';

/** Maximum number of users to fetch billing data for per request. */
const MAX_USERS = 50;
const MOCK_DATA_PATH = 'public/mock-data/organization-billing-credits-users.json';

export interface UserBillingEntry {
  login: string;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  topModel: string;
  itemCount: number;
}

export interface BillingCreditsUsersResponse {
  timePeriod: { year?: number; month?: number; day?: number };
  organization?: string;
  enterprise?: string;
  users: UserBillingEntry[];
}

/** Minimal seat shape — only the login field is needed. */
interface SeatUser {
  assignee?: { login?: string };
  login?: string;
}

/** Fetch the first page of Copilot seats to get a list of user logins. */
async function fetchSeatLogins(options: Options, headers: Headers): Promise<string[]> {
  const seatsUrl = options.getSeatsApiUrl();
  const url = `${seatsUrl}?per_page=100`;
  try {
    const response = await $fetch<{ seats?: SeatUser[] }>(url, {
      headers: {
        ...Object.fromEntries(headers.entries()),
        'Accept': 'application/vnd.github+json',
      }
    });
    const seats = response?.seats ?? (Array.isArray(response) ? (response as SeatUser[]) : []);
    return seats
      .map((s: SeatUser) => s.assignee?.login ?? s.login ?? '')
      .filter(Boolean)
      .slice(0, MAX_USERS);
  } catch {
    return [];
  }
}

/** Aggregate usageItems from the org billing endpoint into a single UserBillingEntry. */
function aggregateItems(login: string, items: BillingUsageItem[]): UserBillingEntry {
  let grossAmount = 0;
  let discountAmount = 0;
  let netAmount = 0;
  let topModel = '';
  let topModelNet = -1;

  for (const item of items) {
    grossAmount += item.grossAmount;
    discountAmount += item.discountAmount;
    netAmount += item.netAmount;
    if (item.netAmount > topModelNet) {
      topModelNet = item.netAmount;
      topModel = item.model;
    }
  }

  return { login, grossAmount, discountAmount, netAmount, topModel, itemCount: items.length };
}

export default defineEventHandler(async (event): Promise<BillingCreditsUsersResponse> => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // ── Mock mode ─────────────────────────────────────────────────────────────
  if (options.isDataMocked) {
    try {
      const path = resolve(MOCK_DATA_PATH);
      const data = JSON.parse(readFileSync(path, 'utf8')) as BillingCreditsUsersResponse;
      return data;
    } catch (err) {
      logger.error('Failed to read billing credits users mock data:', err);
      throw createError({ statusCode: 500, statusMessage: 'Failed to read mock billing users data' });
    }
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  if (!event.context.headers?.has('Authorization')) {
    logger.error('No Authentication provided for billing-credits-users endpoint');
    throw createError({ statusCode: 401, statusMessage: 'No Authentication provided' });
  }

  const identifier = options.githubOrg || options.githubEnt || '';
  if (!identifier) {
    throw createError({ statusCode: 400, statusMessage: 'GitHub organization or enterprise must be configured' });
  }

  let billingApiUrl: string;
  try {
    billingApiUrl = options.getBillingCreditsUserApiUrl();
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: String(err) });
  }

  // ── Build common query params ─────────────────────────────────────────────
  const commonParams: Record<string, string> = {};
  if (query.year) commonParams.year = String(query.year);
  if (query.month) commonParams.month = String(query.month);
  if (query.day) commonParams.day = String(query.day);
  if (query.product) commonParams.product = String(query.product);

  const ghHeaders = {
    ...Object.fromEntries(event.context.headers.entries()),
    'X-GitHub-Api-Version': '2026-03-10',
    'Accept': 'application/vnd.github+json',
  };

  // ── Fetch seat list ────────────────────────────────────────────────────────
  const logins = await fetchSeatLogins(options, event.context.headers);

  if (logins.length === 0) {
    return {
      timePeriod: {
        year: query.year ? Number(query.year) : undefined,
        month: query.month ? Number(query.month) : undefined,
      },
      organization: options.githubOrg,
      enterprise: options.githubEnt,
      users: [],
    };
  }

  // ── Fetch per-user billing in parallel ────────────────────────────────────
  logger.info(`Fetching billing credits for ${logins.length} users from ${billingApiUrl}`);

  interface BillingApiResponse {
    timePeriod?: { year?: number; month?: number; day?: number };
    usageItems?: BillingUsageItem[];
  }

  const results = await Promise.allSettled(
    logins.map(async (login) => {
      const params = new URLSearchParams({ ...commonParams, user: login });
      const url = `${billingApiUrl}?${params.toString()}`;
      const response = await $fetch<BillingApiResponse>(url, { headers: ghHeaders });
      return { login, items: response?.usageItems ?? [], timePeriod: response?.timePeriod };
    })
  );

  // Propagate 403 so the frontend can show a permissions error
  for (const result of results) {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 403) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden — token lacks "Administration" read permission required for billing data',
        });
      }
    }
  }

  const users: UserBillingEntry[] = results
    .filter((r): r is PromiseFulfilledResult<{ login: string; items: BillingUsageItem[]; timePeriod?: { year?: number; month?: number; day?: number } }> => r.status === 'fulfilled')
    .map(r => aggregateItems(r.value.login, r.value.items))
    .filter(u => u.netAmount > 0 || u.grossAmount > 0)
    .sort((a, b) => b.netAmount - a.netAmount);

  const firstTimePeriod = results
    .find((r): r is PromiseFulfilledResult<{ login: string; items: BillingUsageItem[]; timePeriod?: { year?: number; month?: number; day?: number } }> => r.status === 'fulfilled' && Boolean(r.value.timePeriod))
    ?.value.timePeriod ?? {};

  return {
    timePeriod: firstTimePeriod,
    organization: options.githubOrg,
    enterprise: options.githubEnt,
    users,
  };
});
