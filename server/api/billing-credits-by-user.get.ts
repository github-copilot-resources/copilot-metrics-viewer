/**
 * GET /api/billing-credits-by-user — admin only
 *
 * Returns per-user attributed billing items for the explicit `?logins=`
 * list. GitHub's billing endpoint does NOT include a `user` field on its
 * response items — only a `?user=<login>` filter parameter — so we fan
 * out one call per requested user and tag each returned item.
 *
 * Pagination model: the caller (frontend) controls which users are
 * loaded. Pass `?logins=alice,bob,carol` for the currently-visible page
 * of the per-user table; subsequent pages issue additional calls. This
 * avoids a 600-call thundering herd on dashboard load when the table
 * only renders ~25 rows at a time.
 *
 * Limits per call:
 *   - max 50 logins per request (HTTP query length + rate-limit safety)
 *   - 8 concurrent fan-out fetches inside one request
 *
 * Mock mode: returns the same billing-credits.json fixture as
 * /api/billing-credits — the mock already has user-tagged items, so the
 * frontend can render the per-user table without round-tripping logins.
 *
 * Auth: same admin gate as /api/billing-credits.
 *
 * Response shape: identical to /api/billing-credits; every returned item
 * has a populated `user` field.
 */

import { Options } from '@/model/Options';
import { requireUsageAdmin } from '../utils/usage-admin';
import { buildBillingApiUrl } from '../utils/billing-url';
import type { BillingCreditsResponse, BillingUsageItem } from './billing-credits.get';
import {
  decideSource,
  resolveWindow,
  aggregateForBillingByUser,
} from '../services/billing-credit-reader';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockBilling from '../../public/mock-data/billing-credits.json';

const CONCURRENCY = 8;
const MAX_LOGINS_PER_CALL = 50;

export default defineEventHandler(async (event): Promise<BillingCreditsResponse> => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  const config = useRuntimeConfig(event);

  if (!options.isDataMocked) {
    await requireUsageAdmin(event);
  }

  if (options.isDataMocked) {
    // Mock mode: the fixture is already user-attributed, return as-is. If
    // the caller passed `logins`, filter down to just those users.
    const filterLogins = parseLogins(query.logins);
    const mock = mockBilling as BillingCreditsResponse;
    if (filterLogins.length === 0) return mock;
    const set = new Set(filterLogins.map(l => l.toLowerCase()));
    return {
      ...mock,
      usageItems: (mock.usageItems ?? []).filter(it => it.user && set.has(it.user.toLowerCase())),
    };
  }

  const requestedLogins = parseLogins(query.logins);
  if (requestedLogins.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing ?logins= query param. Pass a comma-separated list of GitHub logins (max 50 per call). Enumerate the seat list via /api/seats.',
    });
  }
  if (requestedLogins.length > MAX_LOGINS_PER_CALL) {
    throw createError({
      statusCode: 400,
      statusMessage: `Too many logins (${requestedLogins.length}); cap is ${MAX_LOGINS_PER_CALL} per call. Split the request into multiple pages.`,
    });
  }

  // ── DB-first read path (Phase B) ───────────────────────────────────────────
  // Same coverage check as /api/billing-credits: if a completed CSV ingest
  // job covers the requested window, serve the per-user aggregate from
  // Postgres in a SINGLE query instead of fanning out N live calls.
  // This is also the only way to query per-user data for historical windows
  // (>90 days old) since GitHub's JSON endpoint can't reach them.
  const billingEnterpriseEarly = ((config.billingEnterprise as string | undefined) || '').trim();
  const dbEnterprise = billingEnterpriseEarly
    || (options.scope === 'enterprise' ? options.githubEnt : '')
    || '';

  if (dbEnterprise) {
    try {
      const hasCustomRange = !!(query.since || query.until);
      const window = resolveWindow({
        year: query.year ? Number(query.year) : undefined,
        month: query.month ? Number(query.month) : undefined,
        day: query.day ? Number(query.day) : undefined,
        since: query.since ? String(query.since) : undefined,
        until: query.until ? String(query.until) : undefined,
      });
      const decision = await decideSource(dbEnterprise, window.startDate, window.endDate);
      if (decision.source === 'db') {
        setResponseHeader(event, 'X-Data-Source', 'db');
        if (decision.lastIngestAt) {
          setResponseHeader(event, 'X-Data-Source-Synced-At', decision.lastIngestAt);
        }
        setResponseHeader(event, 'X-Data-Source-Reason', decision.reason);
        return await aggregateForBillingByUser(dbEnterprise, window, requestedLogins, {
          model: query.model ? String(query.model) : undefined,
          sku: query.sku ? String(query.sku) : undefined,
        });
      }
      setResponseHeader(event, 'X-Data-Source', 'live');
      setResponseHeader(event, 'X-Data-Source-Reason', decision.reason);
      // Live GitHub API can't serve custom ranges — same 409 as /api/billing-credits.
      if (hasCustomRange) {
        throw createError({
          statusCode: 409,
          statusMessage:
            `No ingested billing data covers ${window.startDate} → ${window.endDate}. ` +
            `Enable Month view above or run the Billing CSV ingest in the Admin Panel.`,
          data: { reason: 'range-requires-db', window },
        });
      }
    } catch (e) {
      const httpErr = e as { statusCode?: number };
      if (httpErr && typeof httpErr.statusCode === 'number') throw e;
      if (e instanceof Error && /Invalid|day without month|must be|since/i.test(e.message)) {
        throw createError({ statusCode: 400, statusMessage: e.message });
      }
      setResponseHeader(event, 'X-Data-Source', 'live');
      setResponseHeader(event, 'X-Data-Source-Reason',
        `db read failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Custom date ranges without a DB target (plain org scope) — same 409.
  if ((query.since || query.until) && !dbEnterprise) {
    throw createError({
      statusCode: 409,
      statusMessage:
        `Custom date ranges are served from the local database (enterprise-scoped only). ` +
        `Set NUXT_BILLING_ENTERPRISE or enable Month view.`,
      data: { reason: 'range-requires-db' },
    });
  }

  // No fallback to NUXT_GITHUB_TOKEN: GitHub rejects fine-grained PATs and
  // App tokens on the billing endpoints. See billing-credits.get.ts for the
  // full rationale.
  const billingToken = ((config.githubBillingToken as string | undefined) || '').trim();
  if (!billingToken) {
    throw createError({
      statusCode: 503,
      statusMessage: 'No billing credential configured — set NUXT_GITHUB_BILLING_TOKEN (classic PAT with manage_billing:enterprise scope; SSO-authorized).',
    });
  }

  const billingEnterprise = billingEnterpriseEarly;
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

  // Forward documented filter params (year/month/day/model/product/cost_center_id)
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

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < requestedLogins.length) {
      const i = cursor++;
      const login = requestedLogins[i];
      if (login) await fetchOne(login);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, requestedLogins.length) }, () => worker()));

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

function parseLogins(raw: unknown): string[] {
  if (!raw) return [];
  const str = Array.isArray(raw) ? raw.join(',') : String(raw);
  return Array.from(new Set(
    str.split(',').map(s => s.trim()).filter(Boolean)
  ));
}
