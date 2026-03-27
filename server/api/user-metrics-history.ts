/**
 * GET /api/user-metrics-history
 *
 * Two modes:
 *
 * 1. Without ?login=  → aggregate snapshots
 *    Returns UserMetricsHistoryEntry[] — one entry per stored 28-day window with
 *    org-level totals (total_users, active_users, premium_requests, acceptance_rate).
 *
 * 2. With ?login=<username>  → per-user time series
 *    Returns UserTimeSeriesEntry[] — one entry per snapshot where the user appears,
 *    showing that individual user's stats over time.
 *
 * Only available when ENABLE_HISTORICAL_MODE=true.
 */

import { Options } from '@/model/Options';
import { getUserMetricsHistory, getUserTimeSeries } from '../storage/user-metrics-storage';

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
    logger.error('Error fetching user-metrics history:', error);
    throw createError({ statusCode: 500, statusMessage: 'Error fetching user-metrics history: ' + String(error) });
  }
});
