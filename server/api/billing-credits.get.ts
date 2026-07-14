/**
 * GET /api/billing-credits — admin only
 *
 * Wraps the GitHub AI credit billing usage endpoint:
 *   - /organizations/{org}/settings/billing/ai_credit/usage
 *   - /enterprises/{ent}/settings/billing/ai_credit/usage
 *
 * Returns the aggregate breakdown by SKU/model/cost-center/repo that GitHub
 * provides natively.
 *
 * URL selection (in priority order):
 *   1. NUXT_BILLING_ENTERPRISE set → always /enterprises/{slug}/... (escape
 *      hatch for org-scoped dashboards whose org is enterprise-owned).
 *   2. Otherwise → derived from dashboard scope (org or ent).
 *
 * Token selection:
 *   - Uses NUXT_GITHUB_BILLING_TOKEN (dedicated classic PAT with
 *     `manage_billing:enterprise` / `manage_billing:copilot` and SSO-authorized
 *     for the target org/enterprise). Falls back to NUXT_GITHUB_TOKEN for
 *     backwards compatibility with existing deployments that only set the
 *     primary token.
 *   - GitHub Apps cannot get billing permissions today; fine-grained PATs
 *     don't fully cover billing. Hence the separate classic-PAT-only env var.
 *
 * Auth:
 *   - 401 if no session (caught by middleware)
 *   - 403 if the session user is not in NUXT_USAGE_ADMINS
 *   - 503 if no billing token is configured
 *
 * Forwarded query params: year, month, day, model, product, cost_center_id, user
 */

import { Options } from '@/model/Options';
import { requireUsageAdmin } from '../utils/usage-admin';
import { buildBillingApiUrl } from '../utils/billing-url';
import {
  decideSource,
  resolveWindow,
  aggregateForBilling,
} from '../services/billing-credit-reader';
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
  user?: string;
}

export interface BillingCreditsResponse {
  timePeriod: { year?: number; month?: number; day?: number };
  organization?: string;
  enterprise?: string;
  user?: string;
  usageItems: BillingUsageItem[];
}

/**
 * Build the billing API URL, honoring the NUXT_BILLING_ENTERPRISE override.
 *
 * Implementation lives in server/utils/billing-url.ts so it can be unit-tested
 * without Nuxt's auto-imported runtime helpers. Re-exported here for callers
 * that already import from this file.
 */
export { buildBillingApiUrl } from '../utils/billing-url';

export default defineEventHandler(async (event): Promise<BillingCreditsResponse> => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  const config = useRuntimeConfig(event);

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

  // ── DB-first read path (Phase B) ───────────────────────────────────────────
  // If the CSV ingest has materialized a job whose [start_date, end_date]
  // window covers the requested period, serve the aggregate from Postgres
  // and skip the live GitHub call entirely. This unlocks two things the live
  // JSON endpoint can't do today:
  //   - historical windows older than GitHub's rolling 90-day cap
  //   - per-user filtering (the JSON endpoint hides usernames)
  //
  // The DB only has enterprise-scoped data (ingester is enterprise-only), so
  // we only attempt this branch when we can resolve an enterprise key. Both
  // enterprise-scoped calls AND org-scoped calls with NUXT_BILLING_ENTERPRISE
  // set (the documented escape hatch for enterprise-billed orgs) qualify;
  // plain org-scoped calls without that override fall through to live.
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
        return await aggregateForBilling(dbEnterprise, window, {
          user: query.user ? String(query.user) : undefined,
          model: query.model ? String(query.model) : undefined,
          // product → SKU is non-trivial (multiple SKUs per product); we only
          // filter on it when the caller specifically asks for a known SKU.
          sku: query.sku ? String(query.sku) : undefined,
        });
      }
      // decision.source === 'live' falls through to the live fetch below.
      // Record why so curl users can see in the response headers.
      setResponseHeader(event, 'X-Data-Source', 'live');
      setResponseHeader(event, 'X-Data-Source-Reason', decision.reason);

      // Custom date ranges (since/until) can't be served by the live GitHub
      // API — it only supports single-day or whole-month lookups. Rather
      // than silently return the wrong window, fail loudly so the client
      // can surface the "enable Month view or run Billing CSV ingest" banner.
      if (hasCustomRange) {
        throw createError({
          statusCode: 409,
          statusMessage:
            `No ingested billing data covers ${window.startDate} → ${window.endDate}. ` +
            `The GitHub Billing API only accepts a single day or a whole calendar month, ` +
            `so custom ranges must be served from the local database. ` +
            `Enable Month view above to look at a specific calendar month, or run the ` +
            `Billing CSV ingest in the Admin Panel to import billing data for this range.`,
          data: { reason: 'range-requires-db', window },
        });
      }
    } catch (e) {
      // Preserve typed HTTP errors thrown above (e.g. the 409 for uncovered
      // ranges) — only convert bare Error/validation failures to 400.
      const httpErr = e as { statusCode?: number };
      if (httpErr && typeof httpErr.statusCode === 'number') throw e;
      // Resolve-window 400s shouldn't be swallowed — re-throw as a clean 400.
      if (e instanceof Error && /Invalid|day without month|must be|since/i.test(e.message)) {
        throw createError({ statusCode: 400, statusMessage: e.message });
      }
      // Any other DB-side error: fall through to the live path, but flag it
      // so curl users can see we tried and bailed.
      setResponseHeader(event, 'X-Data-Source', 'live');
      setResponseHeader(event, 'X-Data-Source-Reason',
        `db read failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Custom date ranges require the DB path. If we couldn't resolve an
  // enterprise for DB (e.g. plain org-scoped call without NUXT_BILLING_ENTERPRISE),
  // reject with the same 409 rather than silently ignoring the range.
  if ((query.since || query.until) && !dbEnterprise) {
    throw createError({
      statusCode: 409,
      statusMessage:
        `Custom date ranges on the Billing tab are served from the local database, ` +
        `which is only populated for enterprise-scoped dashboards. ` +
        `Set NUXT_BILLING_ENTERPRISE=<enterprise-slug> on the deployment, or ` +
        `enable Month view above to look at a specific calendar month.`,
      data: { reason: 'range-requires-db' },
    });
  }

  // ── Token selection ────────────────────────────────────────────────────────
  // No fallback to NUXT_GITHUB_TOKEN: that variable is usually a fine-grained
  // PAT or a GitHub App installation token, neither of which GitHub accepts on
  // the billing endpoints (the request returns a confusing 401/403). Require
  // an explicit classic PAT instead so the failure surfaces as a clean 503
  // with configuration instructions.
  const billingToken = ((config.githubBillingToken as string | undefined) || '').trim();
  if (!billingToken) {
    throw createError({
      statusCode: 503,
      statusMessage: 'No billing credential configured — set NUXT_GITHUB_BILLING_TOKEN (classic PAT with manage_billing:enterprise scope; SSO-authorized).',
    });
  }

  // ── URL selection ──────────────────────────────────────────────────────────
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

  // Forward documented filter params. The `user` filter is supported on the
  // enterprise endpoint (verified 2026-06+) — we forward it when present so
  // callers (e.g. /api/my-usage) can request per-user breakdowns.
  const forwardParams: Record<string, string> = {};
  for (const key of ['year', 'month', 'day', 'model', 'product', 'cost_center_id', 'user']) {
    const v = query[key];
    if (v !== undefined && v !== null && v !== '') {
      forwardParams[key] = String(v);
    }
  }

  const urlWithParams = Object.keys(forwardParams).length > 0
    ? `${apiUrl}?${new URLSearchParams(forwardParams).toString()}`
    : apiUrl;

  logger.info(`Fetching billing credits from ${apiUrl}${billingEnterprise ? ' (NUXT_BILLING_ENTERPRISE override)' : ''}`);

  try {
    // Build headers explicitly — the billing API requires X-GitHub-Api-Version
    // 2026-03-10. (We're NOT going through authenticateAndGetGitHubHeaders so
    // there's no risk of header concatenation; this also keeps the billing
    // token isolated from the rest of the request pipeline.)
    const ghHeaders = new Headers({
      Authorization: `token ${billingToken}`,
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

    // Sharpen the 404 message — the most common cause is that the org is
    // enterprise-owned and the caller didn't set NUXT_BILLING_ENTERPRISE.
    let statusMessage = `GitHub billing API error (${status}): ${ghMessage}`;
    if (status === 404 && !billingEnterprise && options.scope === 'organization') {
      statusMessage = `GitHub returned 404 for /organizations/${options.githubOrg}/settings/billing/ai_credit/usage. ` +
        `If this org's billing is consolidated at an enterprise (very common), set ` +
        `NUXT_BILLING_ENTERPRISE=<enterprise-slug> on the deployment to query the enterprise billing endpoint instead.`;
    }

    throw createError({
      statusCode: status,
      statusMessage,
      data: err.data,
    });
  }
});
