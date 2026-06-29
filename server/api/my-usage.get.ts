/**
 * GET /api/my-usage
 *
 * Personal Copilot usage for the currently-authenticated user.
 *
 * Implementation: filters the existing per-user metrics report
 * (users-28-day, which already includes ai_credits_used since 2026-06-19)
 * to just the session user's row, server-side. The client cannot tamper
 * with the user filter because it is read from the session, not the query.
 *
 * Returns:
 *   - 200 with { user, totals: UserTotals | null, dayRecords: UserDayRecord[] }
 *   - 401 if no session
 *   - 503 if no GitHub credential is configured
 *
 * Auth modes:
 *   - PAT (NUXT_GITHUB_TOKEN) — works for everyone, server-side fetch
 *   - GitHub App installation — works for everyone, server-side fetch
 *   - OAuth-only fallback — only works if the user's own token has
 *     org-admin / enterprise-admin rights (same constraint as every other
 *     metrics endpoint in this app)
 */

import { Options } from '@/model/Options';
import {
  aggregateUserDayRecords,
  fetchLatestUserReport,
  fetchRawUserDayRecords,
  type UserDayRecord,
  type UserTotals,
} from '../services/github-copilot-usage-api';
import { getUserDayMetricsByDateRange } from '../storage/user-day-metrics-storage';
import { isDbConfigured } from '../storage/db';
import { buildBillingApiUrl } from '../utils/billing-url';
import { aggregateBillingSpend, type BillingUsageItem } from '../utils/billing-spend-aggregator';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersOrg28Day from '../../public/mock-data/new-api/organization-users-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersEnt28Day from '../../public/mock-data/new-api/enterprise-users-28-day-report.json';

/**
 * Per-user spend roll-up sourced from /enterprises/.../ai_credit/usage?user=<login>.
 * Optional — populated only when NUXT_GITHUB_BILLING_TOKEN is configured.
 */
export interface MyUsageSpend {
  /** USD (or local currency) total for the user across all SKUs/models in the period. */
  totalAmount: number;
  /** Total credits/units billed (`netQuantity` sum — typically AI credits). */
  totalQuantity: number;
  /** Per-model breakdown so the UI can list "claude-sonnet-4.5: $X.XX" etc. */
  byModel: { model: string; amount: number; quantity: number }[];
  /** Time period the billing API returned (year/month). */
  timePeriod?: { year?: number; month?: number; day?: number };
  /** Enterprise slug the billing call queried (echoed for the UI footnote). */
  enterprise?: string;
}

interface MyUsageResponse {
  user: { login: string; email?: string };
  totals: UserTotals | null;
  dayRecords: UserDayRecord[];
  reportStartDay?: string;
  reportEndDay?: string;
  spend?: MyUsageSpend;
  /**
   * Non-fatal warning surfaced when spend was requested (billingEnabled) but
   * the billing call itself failed (e.g. SSO not authorized for the dedicated
   * billing token). UI can show a small inline notice without breaking the
   * metrics view.
   */
  spendWarning?: string;
}

function filterDaysByDateRange(
  records: UserDayRecord[],
  since?: string,
  until?: string
): UserDayRecord[] {
  if (!since && !until) return records;
  return records.filter(r => {
    if (since && r.day < since) return false;
    if (until && r.day > until) return false;
    return true;
  });
}

function matchesLogin(login: string, candidate: string | undefined): boolean {
  return !!candidate && candidate.toLowerCase() === login.toLowerCase();
}

export default defineEventHandler(async (event): Promise<MyUsageResponse> => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // ── Identity: session is the ONLY trusted source for the user filter ──────
  const session = await getUserSession(event).catch(() => null);
  const sessionUser = session?.user as { login?: string; email?: string } | undefined;

  // Mock mode: fall back to a fixture user (octocat) so the My Usage tab is
  // exercisable without OAuth in local dev / Playwright runs. The /api/auth/
  // usage-admin probe and /api/billing-credits mirror this bypass.
  let myLogin = sessionUser?.login;
  let myEmail = sessionUser?.email;
  if (!myLogin && options.isDataMocked) {
    myLogin = 'octocat';
    myEmail = undefined;
  }
  if (!myLogin) {
    throw createError({ statusCode: 401, statusMessage: 'No session — sign in to view My Usage' });
  }

  const responseShell = {
    user: { login: myLogin, email: myEmail },
  };

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (options.isDataMocked) {
    const isOrg = (options.scope || 'organization') === 'organization';
    const raw = isOrg ? mockUsersOrg28Day : mockUsersEnt28Day;
    const rawDayRecords = (raw as { day_totals?: UserDayRecord[] }).day_totals;
    const dayRecords = rawDayRecords
      ? filterDaysByDateRange(rawDayRecords, options.since, options.until)
          .filter(r => matchesLogin(myLogin, r.user_login))
      : [];

    let totals: UserTotals | null = null;
    if (dayRecords.length > 0) {
      totals = aggregateUserDayRecords(dayRecords)[0] ?? null;
    } else {
      // Pre-aggregated fixture path — pick the matching user_totals row
      const preAgg = (raw as { user_totals?: UserTotals[] }).user_totals;
      totals = preAgg?.find(u => matchesLogin(myLogin, u.login)) ?? null;
    }

    // Synthetic per-user spend fixture so the "Your AI credit spend" card is
    // exercisable in mock mode / Playwright (no live billing endpoint needed).
    // Values are anonymized — derived from realistic SKU/model mixes scaled
    // down for the fixture user.
    const mockSpend: MyUsageSpend = {
      totalAmount: 18.42,
      totalQuantity: 1842.0,
      timePeriod: { year: 2026, month: 6 },
      enterprise: 'mocked-enterprise',
      byModel: [
        { model: 'claude-sonnet-4.5', amount: 9.87, quantity: 987.0 },
        { model: 'gpt-5.3-codex', amount: 5.41, quantity: 541.0 },
        { model: 'claude-haiku-4.5', amount: 3.14, quantity: 314.0 },
      ],
    };

    return { ...responseShell, totals, dayRecords, spend: mockSpend };
  }

  // ── Live API fetch ─────────────────────────────────────────────────────────
  if (!event.context.headers?.has('Authorization')) {
    logger.error('No Authentication provided for my-usage endpoint');
    throw createError({
      statusCode: 503,
      statusMessage: 'No GitHub credential configured — set NUXT_GITHUB_TOKEN or NUXT_GITHUB_APP_ID + NUXT_GITHUB_APP_PRIVATE_KEY',
    });
  }

  const scope = options.scope || 'organization';
  const identifier = options.githubOrg || options.githubEnt || '';
  if (!identifier) {
    throw createError({ statusCode: 400, statusMessage: 'GitHub organization or enterprise must be configured' });
  }

  try {
    let baseResponse: MyUsageResponse;
    if (options.since || options.until) {
      // Date range specified. Prefer the DB-backed user_day_metrics table —
      // when admin bulk sync has been run, it stores per-day per-user records
      // for arbitrary historical dates (the live 28-day report only covers
      // the latest 28 days, so it can't satisfy ranges starting older than that).
      let dayRecords: UserDayRecord[];
      if (isDbConfigured() && !options.githubTeam) {
        const since = options.since ?? '1970-01-01';
        const until = options.until ?? '9999-12-31';
        dayRecords = await getUserDayMetricsByDateRange(scope, identifier, since, until);
        // Fall back to the live API if the DB is empty for this range (e.g.
        // sync hasn't run yet) — better than returning blank.
        if (dayRecords.length === 0) {
          dayRecords = await fetchRawUserDayRecords(
            { scope, identifier, teamSlug: options.githubTeam },
            event.context.headers
          );
        }
      } else {
        dayRecords = await fetchRawUserDayRecords(
          { scope, identifier, teamSlug: options.githubTeam },
          event.context.headers
        );
      }
      const myDays = filterDaysByDateRange(dayRecords, options.since, options.until)
        .filter(r => matchesLogin(myLogin, r.user_login));
      const aggregated = aggregateUserDayRecords(myDays);
      baseResponse = {
        ...responseShell,
        totals: aggregated[0] ?? null,
        dayRecords: myDays,
      };
    } else {
      // No date range — use the pre-aggregated 28-day report. The report file
      // already embeds per-day per-user rows in `day_totals`, so we can render
      // the day-by-day chart without making 28 follow-up 1-day calls.
      const report = await fetchLatestUserReport(
        { scope, identifier, teamSlug: options.githubTeam },
        event.context.headers
      );
      const mine = report.user_totals.find(u => matchesLogin(myLogin, u.login)) ?? null;
      const myDays = (report.day_totals ?? [])
        .filter(r => matchesLogin(myLogin, r.user_login));
      baseResponse = {
        ...responseShell,
        totals: mine,
        dayRecords: myDays,
        reportStartDay: report.report_start_day,
        reportEndDay: report.report_end_day,
      };
    }

    // Inline per-user billing spend (self-service — never leaks other users' $).
    const spend = await fetchSelfSpend(event, myLogin, options);
    if (spend && 'data' in spend) {
      baseResponse.spend = spend.data;
    } else if (spend && 'warning' in spend) {
      baseResponse.spendWarning = spend.warning;
    }
    return baseResponse;
  } catch (error: unknown) {
    logger.error('Error fetching my-usage:', error);
    const status = typeof error === 'object' && error && 'statusCode' in error
      ? (error as { statusCode?: number }).statusCode
      : 500;
    throw createError({
      statusCode: status || 500,
      statusMessage: 'Error fetching my Copilot usage: ' + String(error),
    });
  }
});

/**
 * Fetch the caller's own AI credit spend, if a billing token is configured.
 * Returns:
 *   - { data: MyUsageSpend } on success
 *   - { warning: string }    on graceful failure (e.g. SSO not authorized, 404)
 *   - null                   when no billing token is configured (silently skip)
 *
 * Always uses `?user=<session-login>` — there is no way for a caller to
 * read another user's spend through this endpoint.
 */
async function fetchSelfSpend(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
  myLogin: string,
  options: Options
): Promise<{ data: MyUsageSpend } | { warning: string } | null> {
  const config = useRuntimeConfig(event);
  const billingToken = ((config.githubBillingToken as string | undefined) || '').trim();
  if (!billingToken) return null;

  const billingEnterprise = ((config.billingEnterprise as string | undefined) || '').trim();
  const baseUrl = (config.githubApiBaseUrl as string | undefined) || 'https://api.github.com';

  let url: string;
  try {
    url = buildBillingApiUrl({
      baseUrl,
      scope: options.scope,
      githubOrg: options.githubOrg,
      githubEnt: options.githubEnt,
      billingEnterprise,
    });
  } catch {
    // No valid identifier — silently skip spend rather than failing the metrics call.
    return null;
  }
  url += (url.includes('?') ? '&' : '?') + `user=${encodeURIComponent(myLogin)}`;

  try {
    const headers = new Headers({
      Authorization: `token ${billingToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    });
    interface BillingResp { timePeriod?: { year?: number; month?: number; day?: number }; enterprise?: string; usageItems: BillingUsageItem[] }
    const resp = await $fetch<BillingResp>(url, { headers });
    const { totalAmount, totalQuantity, byModel } = aggregateBillingSpend(resp.usageItems);

    return {
      data: {
        totalAmount,
        totalQuantity,
        byModel,
        timePeriod: resp.timePeriod,
        enterprise: resp.enterprise || billingEnterprise || undefined,
      },
    };
  } catch (error: unknown) {
    const err = (typeof error === 'object' && error) ? error as {
      statusCode?: number; data?: { message?: string }; message?: string;
    } : {};
    const status = err.statusCode || 0;
    const msg = err.data?.message || err.message || String(error);
    // Surface as warning rather than failing the entire my-usage call.
    return { warning: `Billing fetch failed (${status}): ${msg}` };
  }
}
