/**
 * Per-user Copilot usage metrics API endpoint
 * GET /api/user-metrics
 *
 * Returns aggregated per-user Copilot metrics for the organisation or enterprise.
 * Uses the same download-link based pattern as the aggregated metrics endpoint.
 *
 * Large-enterprise support: the download files may be split across multiple
 * signed URLs. All files are fetched in parallel and the user_totals arrays
 * are merged before returning to the client.
 */

import { Options } from '@/model/Options';
import type { H3Event, EventHandlerRequest } from 'h3';
import {
  aggregateUserDayRecords,
  fetchLatestUserReport,
  fetchRawUserDayRecords,
  type UserDayRecord,
  type UserTotals
} from '../services/github-copilot-usage-api';
import { getUserMetricsByDateRange } from '../storage/user-metrics-storage';
import { getUserDayMetricsByDateRange } from '../storage/user-day-metrics-storage';
import { isDbConfigured } from '../storage/db';
import { fetchAllTeamMembers } from './seats';
import { restrictUserRowsToSelf } from '../utils/restrict-user-rows';
import { requireTeamMembershipOrAdmin } from '../utils/team-membership';
import { getSessionLoginForFilter, isUsageAdminForEvent } from '../utils/usage-admin';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersOrg28Day from '../../public/mock-data/new-api/organization-users-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersEnt28Day from '../../public/mock-data/new-api/enterprise-users-28-day-report.json';

const DEFAULT_USER_METRICS_PAGE_SIZE = 500;
const MAX_USER_METRICS_PAGE_SIZE = 500;

interface UserMetricsPagination {
  page: number;
  pageSize: number;
  offset: number;
}

function parsePositiveInt(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === 'string' || typeof raw === 'number'
    ? Number.parseInt(String(raw), 10)
    : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getPagination(query: ReturnType<typeof getQuery>): UserMetricsPagination {
  const page = parsePositiveInt(query.page) ?? 1;
  const requestedPageSize = parsePositiveInt(query.pageSize)
    ?? parsePositiveInt(query.per_page)
    ?? parsePositiveInt(query.limit)
    ?? DEFAULT_USER_METRICS_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_USER_METRICS_PAGE_SIZE);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function applyPage<T>(rows: T[], pagination: UserMetricsPagination): T[] {
  return rows.slice(pagination.offset, pagination.offset + pagination.pageSize);
}

function writePaginationHeaders(
  event: H3Event<EventHandlerRequest>,
  pagination: UserMetricsPagination,
  totalUsers: number
) {
  if (typeof setResponseHeader !== 'function') return;
  setResponseHeader(event, 'X-User-Metrics-Page', String(pagination.page));
  setResponseHeader(event, 'X-User-Metrics-Page-Size', String(pagination.pageSize));
  setResponseHeader(event, 'X-User-Metrics-Total-Count', String(totalUsers));
  setResponseHeader(event, 'X-User-Metrics-Total-Pages', String(Math.max(1, Math.ceil(totalUsers / pagination.pageSize))));
}

async function getSelfFilterLogin(event: H3Event<EventHandlerRequest>): Promise<string | undefined> {
  try {
    if (await isUsageAdminForEvent(event)) return undefined;
    return (await getSessionLoginForFilter(event)) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * If the request is for a team scope, resolve team members and filter
 * the user totals to only include team members.
 *
 * Team members who have never used Copilot will not appear in the usage
 * API response. To support accurate adoption calculations (e.g. "6 of 10
 * members active"), we append zero-filled stubs for those inactive members
 * so the caller sees the complete team roster.
 *
 * Returns the original array unchanged for non-team scopes.
 */
async function filterByTeamIfNeeded(
  userTotals: UserTotals[],
  options: Options,
  headers: Headers
): Promise<UserTotals[]> {
  if (!options.githubTeam) return userTotals;

  const teamMembers = await fetchAllTeamMembers(options, headers);
  if (teamMembers.length === 0) return [];

  const memberIds = new Set(teamMembers.map(m => m.id));
  const memberLogins = new Set(teamMembers.map(m => m.login.toLowerCase()));

  // Active users who are in this team
  const activeInTeam = userTotals.filter(u =>
    (u.user_id && memberIds.has(u.user_id)) ||
    (u.login && memberLogins.has(u.login.toLowerCase()))
  );

  // Zero-filled stubs for team members who have no usage data at all
  const activeIds = new Set(activeInTeam.map(u => u.user_id).filter(Boolean));
  const activeLogins = new Set(activeInTeam.map(u => u.login.toLowerCase()));

  const inactiveStubs: UserTotals[] = teamMembers
    .filter(m => !activeIds.has(m.id) && !activeLogins.has(m.login.toLowerCase()))
    .map(m => ({
      login: m.login,
      user_id: m.id,
      total_active_days: 0,
      user_initiated_interaction_count: 0,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      loc_suggested_to_add_sum: 0,
      loc_suggested_to_delete_sum: 0,
      loc_added_sum: 0,
      loc_deleted_sum: 0,
    }));

  return [...activeInTeam, ...inactiveStubs];
}

/** Filter per-day user records to those falling within the optional date range.
 * Dates must be ISO 8601 YYYY-MM-DD strings; lexicographic comparison is
 * equivalent to chronological order for this format.
 */
function filterDaysByDateRange(records: UserDayRecord[], since?: string, until?: string): UserDayRecord[] {
  if (!since && !until) return records;
  return records.filter(r => {
    if (since && r.day < since) return false;
    if (until && r.day > until) return false;
    return true;
  });
}

export default defineEventHandler(async (event) => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  const pagination = getPagination(query);

  // GDPR / issue #398 — non-admins may only query teams they belong to.
  // No-op for admins, PAT-mode operators, and queries without ?githubTeam.
  await requireTeamMembershipOrAdmin(
    event,
    (options.scope || 'organization') as 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise',
    options.githubOrg,
    options.githubTeam,
  );

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (options.isDataMocked) {
    const isOrg = (options.scope || 'organization') === 'organization';
    const raw = isOrg ? mockUsersOrg28Day : mockUsersEnt28Day;
    // Org mock uses UserDayRecord[] in day_totals → aggregate on the fly.
    // Enterprise mock uses pre-aggregated UserTotals[] in user_totals → return directly.
    const rawDayRecords = (raw as { day_totals?: UserDayRecord[] }).day_totals;
    const dayRecords = rawDayRecords
      ? filterDaysByDateRange(rawDayRecords, options.since, options.until)
      : undefined;
    let userTotals: UserTotals[] = dayRecords
      ? aggregateUserDayRecords(dayRecords)
      : ((raw as { user_totals: UserTotals[] }).user_totals ?? []);

    // Apply team filter in mock mode using the same mock membership table as seats
    if (options.githubTeam) {
      const members = await filterByTeamIfNeeded(userTotals, options, new Headers());
      userTotals = members;
    }
    const visibleRows = await restrictUserRowsToSelf(event, userTotals, { isMocked: true });
    writePaginationHeaders(event, pagination, visibleRows.length);
    return applyPage(visibleRows, pagination);
  }

  // ── Storage / historical mode ───────────────────────────────────────────────
  if (isDbConfigured()) {
    const isTeamScope = !!options.githubTeam;

    // Team-scoped queries require auth to resolve current team membership
    if (isTeamScope && !event.context.headers?.has('Authorization')) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Team-scoped user metrics require a GitHub token to resolve team membership.',
      });
    }

    try {
      const scope = options.scope || 'organization';
      const identifier = options.githubOrg || options.githubEnt || '';
      const selfFilterLogin = isTeamScope ? undefined : await getSelfFilterLogin(event);
      const storagePage = isTeamScope ? undefined : {
        limit: selfFilterLogin ? 1 : pagination.pageSize,
        offset: selfFilterLogin ? 0 : pagination.offset,
        ...(selfFilterLogin ? { userLogin: selfFilterLogin } : {}),
      };
      const stored = await getUserMetricsByDateRange(scope, identifier, options.since, options.until, storagePage);
      if (stored) {
        const filtered = await filterByTeamIfNeeded(stored.userTotals, options, event.context.headers);
        const visibleRows = await restrictUserRowsToSelf(event, filtered);
        const totalUsers = isTeamScope || stored.totalUsers === undefined ? visibleRows.length : stored.totalUsers;
        const pageRows = isTeamScope || stored.totalUsers === undefined
          ? applyPage(visibleRows, pagination)
          : visibleRows;
        writePaginationHeaders(event, pagination, totalUsers);
        logger.info(`Returning ${pageRows.length} user metrics entries from storage (${stored.reportStartDay}–${stored.reportEndDay}; page ${pagination.page}, size ${pagination.pageSize}, total ${totalUsers})`);
        return pageRows;
      }
      logger.info('No user metrics in storage yet, attempting live fetch');
    } catch (err) {
      // Re-throw H3 errors (like 503 above)
      if (err && typeof err === 'object' && 'statusCode' in err) throw err;
      logger.warn('Storage lookup failed, falling back to live fetch:', err);
      if (!event.context.headers?.has('Authorization')) {
        throw createError({
          statusCode: 503,
          statusMessage: 'Historical mode: storage unavailable and no GitHub token configured for live fallback.',
        });
      }
    }
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  if (!event.context.headers?.has('Authorization')) {
    logger.error('No Authentication provided for user-metrics endpoint');
    throw createError({ statusCode: 401, statusMessage: 'No Authentication provided' });
  }

  // ── Live API fetch ─────────────────────────────────────────────────────────
  try {
    const scope = options.scope || 'organization';
    const identifier = options.githubOrg || options.githubEnt || '';

    if (!identifier) {
      throw createError({ statusCode: 400, statusMessage: 'GitHub organization or enterprise must be configured' });
    }

    logger.info(`Fetching user metrics for ${scope}:${identifier}`);

    let userTotals: UserTotals[];

    if (options.since || options.until) {
      // Date range specified.
      // When DB is configured, prefer per-day records stored there — they cover
      // arbitrary historical ranges beyond the 28-day live API window.
      let dayRecords: UserDayRecord[];
      if (isDbConfigured()) {
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
      userTotals = aggregateUserDayRecords(
        filterDaysByDateRange(dayRecords, options.since, options.until)
      );
    } else {
      // No date range: use pre-aggregated report
      const report = await fetchLatestUserReport(
        { scope, identifier, teamSlug: options.githubTeam },
        event.context.headers
      );
      userTotals = report.user_totals ?? [];
    }

    const filtered = await filterByTeamIfNeeded(userTotals, options, event.context.headers);
    const visibleRows = await restrictUserRowsToSelf(event, filtered);
    const pageRows = applyPage(visibleRows, pagination);
    writePaginationHeaders(event, pagination, visibleRows.length);
    logger.info(`Returned ${pageRows.length} user records for ${scope}:${identifier} (${userTotals.length} before team filter; page ${pagination.page}, size ${pagination.pageSize}, total ${visibleRows.length})`);
    return pageRows;

  } catch (error: unknown) {
    logger.error('Error fetching user metrics:', error);
    const status = typeof error === 'object' && error && 'statusCode' in error
      ? (error as { statusCode?: number }).statusCode
      : 500;
    throw createError({
      statusCode: status || 500,
      statusMessage: 'Error fetching user metrics. Error: ' + String(error)
    });
  }
});
