/**
 * GET /api/my-usage
 *
 * Personal Copilot usage for the currently-authenticated user, or — when the
 * caller is a usage admin — for a specific user identified by `?login=<other>`.
 *
 * Implementation: filters the existing per-user metrics report
 * (users-28-day, which already includes ai_credits_used since 2026-06-19)
 * to a single user's row, server-side. Non-admins can only see themselves;
 * the `?login` override is checked against `requireUsageAdmin`.
 *
 * Returns:
 *   - 200 with { user, viewingAsAdmin, totals: UserTotals | null, dayRecords: UserDayRecord[] }
 *   - 401 if no session and no `?login` override
 *   - 403 if `?login=<other>` is used by a non-admin
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
import {
  aggregateForBilling,
  decideSource,
  resolveWindow,
} from '../services/billing-credit-reader';
import { buildBillingApiUrl } from '../utils/billing-url';
import { aggregateBillingSpend, type BillingUsageItem } from '../utils/billing-spend-aggregator';
import { isUsageAdminForEvent } from '../utils/usage-admin';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersOrg28Day from '../../public/mock-data/new-api/organization-users-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersEnt28Day from '../../public/mock-data/new-api/enterprise-users-28-day-report.json';

/**
 * Per-user spend roll-up sourced from /enterprises/.../ai_credit/usage?user=<login>.
 * Optional — populated only when NUXT_GITHUB_BILLING_TOKEN is configured.
 *
 * Both net (what the user pays after any discount) AND gross (list-price)
 * totals are exposed — issue #398 reporter's plan fully discounts every
 * item, so netAmount/netQuantity are always 0. The UI needs gross values
 * to render "you used N credits" tiles meaningfully.
 */
export interface MyUsageSpend {
  /** USD net total (what the user is billed) across all SKUs/models. */
  totalAmount: number;
  /** Net credits/units billed (`netQuantity` sum). Zero on fully-discounted plans. */
  totalQuantity: number;
  /** USD gross total (pre-discount list-price). Non-zero even when fully discounted. */
  totalGrossAmount: number;
  /** Gross credits/units consumed (`grossQuantity` sum) — the true "credits used" figure. */
  totalGrossQuantity: number;
  /** Per-model breakdown so the UI can list "claude-sonnet-4.5: $X.XX" etc. */
  byModel: { model: string; amount: number; quantity: number; grossAmount: number; grossQuantity: number }[];
  /** Time period the billing API returned (year/month). */
  timePeriod?: { year?: number; month?: number; day?: number };
  /** Enterprise slug the billing call queried (echoed for the UI footnote). */
  enterprise?: string;
  /**
   * When the response was served from the local billing_credit_usage table
   * (custom since/until range), these fields describe the actual window.
   * When absent, the response came from the live GitHub Billing API and
   * `timePeriod` describes the window instead.
   */
  source?: 'live' | 'db';
  since?: string;
  until?: string;
}

interface MyUsageResponse {
  user: { login: string; email?: string };
  /**
   * True when the response is for a user other than the session user — i.e.
   * an admin is inspecting another login via `?login=<other>`. UI can use
   * this to swap the header from "My Usage" to something like
   * "Usage for <login>" and hide personal chrome (avatar of session user).
   */
  viewingAsAdmin?: boolean;
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

  // ── Identity: session is the ONLY trusted source for the session user ─────
  // Admins may opt in to viewing another user's data via `?login=<other>`
  // (used by the Billing tab's per-user drill-down). Non-admins asking for
  // another login are rejected with 403 by the admin-override branch below.
  const session = await getUserSession(event).catch(() => null);
  const sessionUser = session?.user as { login?: string; email?: string } | undefined;

  const requestedLoginRaw = typeof query.login === 'string' ? query.login.trim() : '';
  const requestedLogin = requestedLoginRaw || undefined;
  let viewingAsAdmin = false;

  // Mock mode: fall back to a fixture user (octocat) so the My Usage tab is
  // exercisable without OAuth in local dev / Playwright runs. The /api/auth/
  // usage-admin probe and /api/billing-credits mirror this bypass.
  let myLogin = sessionUser?.login;
  let myEmail = sessionUser?.email;
  if (!myLogin && options.isDataMocked) {
    myLogin = 'octocat';
    myEmail = undefined;
  }

  // Admin drill-down (`?login=<other>`) works in PAT-only deployments where
  // there is no OAuth session — the operator is admin-by-PAT. Gate on
  // isUsageAdminForEvent and use the requested login as the effective target.
  // This must run BEFORE the "no session → 401" branch so PAT admins can
  // drive the Billing tab's per-user picker.
  if (requestedLogin) {
    if (!myLogin || requestedLogin.toLowerCase() !== myLogin.toLowerCase()) {
      const isAdmin = await isUsageAdminForEvent(event);
      if (!isAdmin) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden: only usage admins can view another user\'s activity.',
        });
      }
      myLogin = requestedLogin;
      myEmail = undefined;
      viewingAsAdmin = true;
    }
  }

  if (!myLogin) {
    throw createError({ statusCode: 401, statusMessage: 'No session — sign in to view My Usage' });
  }

  const responseShell = {
    user: { login: myLogin, email: myEmail },
    viewingAsAdmin,
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
    const mockSpend: MyUsageSpend = (options.since || options.until)
      ? {
          totalAmount: 9.11,
          totalQuantity: 911.0,
          totalGrossAmount: 10.12,
          totalGrossQuantity: 1012.0,
          enterprise: 'mocked-enterprise',
          source: 'db',
          since: options.since,
          until: options.until,
          byModel: [
            { model: 'claude-sonnet-4.5', amount: 4.88, quantity: 488.0, grossAmount: 5.42, grossQuantity: 542.0 },
            { model: 'gpt-5.3-codex',     amount: 2.67, quantity: 267.0, grossAmount: 2.97, grossQuantity: 297.0 },
            { model: 'claude-haiku-4.5',  amount: 1.56, quantity: 156.0, grossAmount: 1.73, grossQuantity: 173.0 },
          ],
        }
      : {
          totalAmount: 18.42,
          totalQuantity: 1842.0,
          totalGrossAmount: 20.46,
          totalGrossQuantity: 2046.0,
          timePeriod: { year: 2026, month: 6 },
          enterprise: 'mocked-enterprise',
          source: 'live',
          byModel: [
            { model: 'claude-sonnet-4.5', amount: 9.87, quantity: 987.0, grossAmount: 10.97, grossQuantity: 1097.0 },
            { model: 'gpt-5.3-codex',     amount: 5.41, quantity: 541.0, grossAmount: 6.01,  grossQuantity: 601.0 },
            { model: 'claude-haiku-4.5',  amount: 3.14, quantity: 314.0, grossAmount: 3.48,  grossQuantity: 348.0 },
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
 * Fetch a target user's AI credit spend, if a billing token is configured.
 * Returns:
 *   - { data: MyUsageSpend } on success
 *   - { warning: string }    on graceful failure (e.g. SSO not authorized, 404)
 *   - null                   when no billing token is configured (silently skip)
 *
 * The `myLogin` argument is always resolved server-side — either from the
 * session (default) or, for admins, from the `?login=<other>` query param
 * (see the admin gate in the main handler). Callers cannot pipe an
 * arbitrary login through this function without going through that gate.
 */
async function fetchSelfSpend(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
  myLogin: string,
  options: Options
): Promise<{ data: MyUsageSpend } | { warning: string } | null> {
  const config = useRuntimeConfig(event);
  const billingToken = ((config.githubBillingToken as string | undefined) || '').trim();
  const billingEnterprise = ((config.billingEnterprise as string | undefined) || '').trim();

  // ── DB-first path when a custom date range is set ────────────────────────
  // The live billing API only supports single day / whole month / whole year
  // windows, so arbitrary since/until ranges must come from ingested rows in
  // billing_credit_usage. Same DB gate as /api/billing-credits: enterprise
  // scope OR org scope with NUXT_BILLING_ENTERPRISE override.
  const hasCustomRange = !!(options.since || options.until);
  if (hasCustomRange) {
    const dbEnterprise = billingEnterprise
      || (options.scope === 'enterprise' ? (options.githubEnt || '') : '')
      || '';
    if (dbEnterprise && isDbConfigured()) {
      try {
        const window = resolveWindow({
          since: options.since,
          until: options.until,
        });
        const decision = await decideSource(dbEnterprise, window.startDate, window.endDate);
        if (decision.source === 'db') {
          const agg = await aggregateForBilling(dbEnterprise, window, { user: myLogin });
          const spend = aggregateBillingSpend(agg.usageItems);
          return {
            data: {
              ...spend,
              enterprise: dbEnterprise,
              source: 'db',
              since: window.startDate,
              until: window.endDate,
            },
          };
        }
        // DB doesn't cover the range and live API can't serve a custom range.
        return {
          warning:
            `No ingested billing data covers ${window.startDate} → ${window.endDate}. ` +
            `Run the Billing CSV ingest in the Admin Panel to import data for this range.`,
        };
      } catch (e) {
        const msg = (e as { message?: string })?.message || String(e);
        return { warning: `DB spend lookup failed: ${msg}` };
      }
    }
    // No enterprise → can't serve custom range from anywhere; skip silently
    // rather than falling back to a misleading month-to-date live call.
    return null;
  }

  // ── Live current-month path ──────────────────────────────────────────────
  if (!billingToken) return null;
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
    const { totalAmount, totalQuantity, totalGrossAmount, totalGrossQuantity, byModel } = aggregateBillingSpend(resp.usageItems);

    return {
      data: {
        totalAmount,
        totalQuantity,
        totalGrossAmount,
        totalGrossQuantity,
        byModel,
        timePeriod: resp.timePeriod,
        enterprise: resp.enterprise || billingEnterprise || undefined,
        source: 'live',
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
