/**
 * GET /api/user-metrics-history
 *
 * Two modes:
 *
 * 1. Without ?login=  → aggregate snapshots
 *    Returns UserMetricsHistoryEntry[] — one entry per stored 28-day window with
 *    org-level totals (total_users, active_users, acceptance_rate).
 *
 * 2. With ?login=<username>  → per-user time series
 *    Returns UserTimeSeriesEntry[] — one entry per snapshot where the user appears,
 *    showing that individual user's stats over time.
 *
 * Only available when ENABLE_HISTORICAL_MODE=true.
 */

import { Options } from '@/model/Options';
import { getUserMetricsHistory, getUserTimeSeries } from '../storage/user-metrics-storage';
import { isUsageAdminForEvent, getSessionLoginForFilter } from '../utils/usage-admin';

export default defineEventHandler(async (event) => {
  const logger = console;

  if (process.env.ENABLE_HISTORICAL_MODE !== 'true') {
    throw createError({
      statusCode: 503,
      statusMessage: 'user-metrics-history endpoint requires ENABLE_HISTORICAL_MODE=true'
    });
  }

  const query      = getQuery(event);
  const options    = Options.fromQuery(query);
  const scope      = options.scope      || 'organization';
  const identifier = options.githubOrg  || options.githubEnt || '';
  const login      = typeof query.login === 'string' ? query.login.trim() : '';

  if (!identifier) {
    throw createError({ statusCode: 400, statusMessage: 'GitHub org or enterprise must be configured' });
  }

  try {
    if (login) {
      // Issue #398: per-user time series is per-user data — must be admin-gated.
      // Non-admin callers may only retrieve their OWN login's series; any other
      // login returns 403. Comparison is case-insensitive (GitHub logins).
      const isAdmin = await isUsageAdminForEvent(event);
      if (!isAdmin) {
        const sessionLogin = await getSessionLoginForFilter(event);
        if (!sessionLogin || sessionLogin.toLowerCase() !== login.toLowerCase()) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden: only NUXT_USAGE_ADMINS may view other users\' history.'
          });
        }
      }
      // Per-user time series
      const series = await getUserTimeSeries(scope, identifier, login);
      logger.info(`Returning ${series.length} time-series entries for user "${login}" in ${scope}:${identifier}`);
      return series;
    }

    // Aggregate snapshot history
    const history = await getUserMetricsHistory(scope, identifier);
    logger.info(`Returning ${history.length} user-metrics history entries for ${scope}:${identifier}`);
    return history;
  } catch (error: unknown) {
    // Re-throw H3 errors (createError) — e.g. the 403 above MUST surface.
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    // Storage is unavailable (e.g. DB misconfigured). Return empty results with
    // a warning rather than a 500 — the frontend can handle an empty history
    // gracefully, whereas a 500 breaks the entire analytics tab.
    logger.warn('user-metrics-history: storage lookup failed, returning empty results:', error);
    return [];
  }
});
