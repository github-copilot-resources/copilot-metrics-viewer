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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersOrg28Day from '../../public/mock-data/new-api/organization-users-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersEnt28Day from '../../public/mock-data/new-api/enterprise-users-28-day-report.json';

interface MyUsageResponse {
  user: { login: string; email?: string };
  totals: UserTotals | null;
  dayRecords: UserDayRecord[];
  reportStartDay?: string;
  reportEndDay?: string;
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
  if (!sessionUser?.login) {
    throw createError({ statusCode: 401, statusMessage: 'No session — sign in to view My Usage' });
  }
  const myLogin = sessionUser.login;

  const responseShell = {
    user: { login: myLogin, email: sessionUser.email },
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

    return { ...responseShell, totals, dayRecords };
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
    if (options.since || options.until) {
      // Date range specified: fetch per-day, filter both by date AND by user
      const dayRecords = await fetchRawUserDayRecords(
        { scope, identifier, teamSlug: options.githubTeam },
        event.context.headers
      );
      const myDays = filterDaysByDateRange(dayRecords, options.since, options.until)
        .filter(r => matchesLogin(myLogin, r.user_login));
      const aggregated = aggregateUserDayRecords(myDays);
      return {
        ...responseShell,
        totals: aggregated[0] ?? null,
        dayRecords: myDays,
      };
    }

    // No date range — use the pre-aggregated 28-day report
    const report = await fetchLatestUserReport(
      { scope, identifier, teamSlug: options.githubTeam },
      event.context.headers
    );
    const mine = report.user_totals.find(u => matchesLogin(myLogin, u.login)) ?? null;
    return {
      ...responseShell,
      totals: mine,
      dayRecords: [],
      reportStartDay: report.report_start_day,
      reportEndDay: report.report_end_day,
    };
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
