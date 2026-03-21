/**
 * GET /api/user-metrics-history
 *
 * Returns a time-series of per-user metrics aggregated per stored 28-day
 * snapshot.  Only available when ENABLE_HISTORICAL_MODE=true (data is
 * collected by the daily sync job).
 *
 * Response: UserMetricsHistoryEntry[]
 *   { report_start_day, report_end_day, total_users, active_users,
 *     total_premium_requests, avg_acceptance_rate }
 */

import { Options } from '@/model/Options';
import { getUserMetricsHistory } from '../storage/user-metrics-storage';

export default defineEventHandler(async (event) => {
  const logger = console;

  if (process.env.ENABLE_HISTORICAL_MODE !== 'true') {
    return new Response(
      'user-metrics-history endpoint requires ENABLE_HISTORICAL_MODE=true',
      { status: 404 }
    );
  }

  const query      = getQuery(event);
  const options    = Options.fromQuery(query);
  const scope      = options.scope      || 'organization';
  const identifier = options.githubOrg  || options.githubEnt || '';

  if (!identifier) {
    return new Response('GitHub org or enterprise must be configured', { status: 400 });
  }

  try {
    const history = await getUserMetricsHistory(scope, identifier);
    logger.info(`Returning ${history.length} user-metrics history entries for ${scope}:${identifier}`);
    return history;
  } catch (error: unknown) {
    logger.error('Error fetching user-metrics history:', error);
    return new Response('Error fetching user-metrics history: ' + String(error), { status: 500 });
  }
});
