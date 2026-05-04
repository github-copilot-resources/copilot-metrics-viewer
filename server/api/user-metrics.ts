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
import {
  aggregateUserDayRecords,
  fetchLatestUserReport,
  type UserDayRecord,
  type UserTotals
} from '../services/github-copilot-usage-api';
import { getLatestUserMetrics } from '../storage/user-metrics-storage';
import { fetchAllTeamMembers } from './seats';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersOrg28Day from '../../public/mock-data/new-api/organization-users-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockUsersEnt28Day from '../../public/mock-data/new-api/enterprise-users-28-day-report.json';

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

export default defineEventHandler(async (event) => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (options.isDataMocked) {
    const isOrg = (options.scope || 'organization') === 'organization';
    const raw = isOrg ? mockUsersOrg28Day : mockUsersEnt28Day;
    // Org mock uses UserDayRecord[] in day_totals → aggregate on the fly.
    // Enterprise mock uses pre-aggregated UserTotals[] in user_totals → return directly.
    const dayRecords = (raw as { day_totals?: UserDayRecord[] }).day_totals;
    let userTotals: UserTotals[] = dayRecords
      ? aggregateUserDayRecords(dayRecords)
      : ((raw as { user_totals: UserTotals[] }).user_totals ?? []);

    // Apply team filter in mock mode using the same mock membership table as seats
    if (options.githubTeam) {
      const members = await filterByTeamIfNeeded(userTotals, options, new Headers());
      userTotals = members;
    }
    return userTotals;
  }

  // ── Storage / historical mode ───────────────────────────────────────────────
  if (process.env.ENABLE_HISTORICAL_MODE === 'true') {
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
      const stored = await getLatestUserMetrics(scope, identifier);
      if (stored) {
        const filtered = await filterByTeamIfNeeded(stored.userTotals, options, event.context.headers);
        logger.info(`Returning ${filtered.length} user metrics entries from storage (${stored.reportStartDay}–${stored.reportEndDay})`);
        return filtered;
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

    const report = await fetchLatestUserReport(
      { scope, identifier, teamSlug: options.githubTeam },
      event.context.headers
    );

    const userTotals = report.user_totals ?? [];
    const filtered = await filterByTeamIfNeeded(userTotals, options, event.context.headers);
    logger.info(`Returned ${filtered.length} user records for ${scope}:${identifier} (${userTotals.length} before team filter)`);
    return filtered;

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
