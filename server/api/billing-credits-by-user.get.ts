/**
 * GET /api/billing-credits-by-user — admin only
 *
 * Returns per-user attributed billing items. GitHub's billing usage endpoint
 * does NOT include a `user` field on its response items — it only supports
 * a `?user=<login>` filter parameter. To produce a per-user breakdown for
 * the Billing tab we fan out: list the seat assignees, then call the billing
 * endpoint once per user with `?user=<login>` and tag the returned items.
 *
 * Concurrency: 8 parallel calls. With GitHub's 5,000/hr core rate limit this
 * comfortably handles enterprises up to ~600 seats per dashboard load.
 *
 * Mock mode: returns the same `billing-credits.json` fixture as
 * /api/billing-credits — the mock already has user-tagged items.
 *
 * Auth: same admin gate as /api/billing-credits.
 *
 * Response shape: `BillingCreditsResponse` (identical to /api/billing-credits)
 * but every item has a populated `user` field.
 */

import { Options } from '@/model/Options';
import { requireUsageAdmin } from '../utils/usage-admin';
import { buildBillingApiUrl } from '../utils/billing-url';
import type { BillingCreditsResponse, BillingUsageItem } from './billing-credits.get';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockBilling from '../../public/mock-data/billing-credits.json';

interface SeatLite { assignee?: { login?: string } | null; login?: string }
interface SeatsPage { seats?: SeatLite[]; total_seats?: number }

const CONCURRENCY = 8;
const MAX_USERS = 600;

export default defineEventHandler(async (event): Promise<BillingCreditsResponse> => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  const config = useRuntimeConfig(event);

  if (!options.isDataMocked) {
    await requireUsageAdmin(event);
  }

  if (options.isDataMocked) {
    return mockBilling as BillingCreditsResponse;
  }

  const billingToken = ((config.githubBillingToken as string | undefined) || '').trim()
    || ((config.githubToken as string | undefined) || '').trim();
  if (!billingToken) {
    throw createError({
      statusCode: 503,
      statusMessage: 'No billing credential configured — set NUXT_GITHUB_BILLING_TOKEN.',
    });
  }
  const metricsToken = ((config.githubToken as string | undefined) || '').trim() || billingToken;

  const billingEnterprise = ((config.billingEnterprise as string | undefined) || '').trim();
  const baseUrl = (config.githubApiBaseUrl as string | undefined) || 'https://api.github.com';

  let apiUrl: string;
  try {
    apiUrl = buildBillingApiUrl({
      baseUrl,
      scope: options.scope,
      githubOrg: options.githubOrg,
      githubEnt: options.githubEnt,
      billingEnterprise,
    });
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: String(err instanceof Error ? err.message : err) });
  }

  // ── Step 1: enumerate seat logins via the GitHub Copilot billing seats endpoint
  const seatsBase = billingEnterprise
    ? `${baseUrl}/enterprises/${billingEnterprise}/copilot/billing/seats`
    : options.scope === 'enterprise' && options.githubEnt
      ? `${baseUrl}/enterprises/${options.githubEnt}/copilot/billing/seats`
      : `${baseUrl}/orgs/${options.githubOrg}/copilot/billing/seats`;

  const logins: string[] = [];
  const seatsHeaders = new Headers({
    Authorization: `Bearer ${metricsToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });

  try {
    let page = 1;
    while (page <= 50) {
      const pageRes = await $fetch<SeatsPage>(`${seatsBase}?per_page=100&page=${page}`, { headers: seatsHeaders });
      const seats = pageRes?.seats ?? [];
      for (const s of seats) {
        const login = s.assignee?.login || s.login;
        if (login) logins.push(login);
      }
      if (seats.length < 100) break;
      page++;
    }
  } catch (err) {
    logger.error('billing-credits-by-user: failed to list seats', err);
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to enumerate Copilot seats for per-user billing breakdown. The metrics token needs read:org (org scope) or read:enterprise (enterprise scope).',
    });
  }

  const uniqueLogins = Array.from(new Set(logins));
  if (uniqueLogins.length === 0) {
    return { timePeriod: { year: 0, month: 0 }, usageItems: [] } as BillingCreditsResponse;
  }

  const truncated = uniqueLogins.length > MAX_USERS;
  const targetLogins = truncated ? uniqueLogins.slice(0, MAX_USERS) : uniqueLogins;
  if (truncated) {
    logger.warn(`billing-credits-by-user: ${uniqueLogins.length} seats exceeds cap; truncating to ${MAX_USERS}`);
  }

  // ── Step 2: forward filter params (year/month/day/model/product/cost_center_id)
  const forwardParams: Record<string, string> = {};
  for (const key of ['year', 'month', 'day', 'model', 'product', 'cost_center_id']) {
    const v = query[key];
    if (v !== undefined && v !== null && v !== '') {
      forwardParams[key] = String(v);
    }
  }

  const billingHeaders = new Headers({
    Authorization: `Bearer ${billingToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
  });

  // ── Step 3: bounded-concurrency fan-out
  const tagged: BillingUsageItem[] = [];
  let timePeriod: BillingCreditsResponse['timePeriod'] = { year: 0, month: 0 };
  let orgSlug: string | undefined;
  let entSlug: string | undefined;
  let failures = 0;

  async function fetchOne(login: string): Promise<void> {
    const params = new URLSearchParams({ ...forwardParams, user: login });
    const url = `${apiUrl}?${params.toString()}`;
    try {
      const resp = await $fetch<BillingCreditsResponse>(url, { headers: billingHeaders });
      timePeriod = resp.timePeriod || timePeriod;
      orgSlug = resp.organization || orgSlug;
      entSlug = resp.enterprise || entSlug;
      for (const it of resp.usageItems ?? []) {
        tagged.push({ ...it, user: login });
      }
    } catch (err) {
      failures++;
      logger.warn(`billing-credits-by-user: ${login} fan-out failed`, err);
    }
  }

  // Simple p-limit shim
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < targetLogins.length) {
      const i = cursor++;
      const login = targetLogins[i];
      if (login) await fetchOne(login);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targetLogins.length) }, () => worker()));

  if (failures > 0 && tagged.length === 0) {
    throw createError({
      statusCode: 502,
      statusMessage: `All ${failures} per-user billing fan-out requests failed. Check the billing PAT scopes and SSO authorization.`,
    });
  }

  return {
    timePeriod,
    organization: orgSlug,
    enterprise: entSlug,
    usageItems: tagged,
  } as BillingCreditsResponse;
});
