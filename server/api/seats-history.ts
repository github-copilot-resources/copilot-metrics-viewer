/**
 * GET /api/seats-history
 *
 * Returns a time-series of daily seat snapshots aggregated into summary
 * statistics.  Only available when ENABLE_HISTORICAL_MODE=true (data is
 * collected by the daily sync job).
 *
 * Response: SeatHistoryEntry[]
 *   { snapshot_date, total_seats, never_active, inactive_7d, inactive_30d }
 */

import { Options } from '@/model/Options';
import { getSeatsHistorySummary } from '../storage/seats-storage';

export default defineEventHandler(async (event) => {
  const logger = console;

  if (process.env.ENABLE_HISTORICAL_MODE !== 'true') {
    throw createError({
      statusCode: 503,
      statusMessage: 'seats-history endpoint requires ENABLE_HISTORICAL_MODE=true'
    });
  }

  const query   = getQuery(event);
  const options = Options.fromQuery(query);
  const scope   = options.scope      || 'organization';
  const identifier = options.githubOrg || options.githubEnt || '';

  if (!identifier) {
    throw createError({ statusCode: 400, statusMessage: 'GitHub org or enterprise must be configured' });
  }

  try {
    const history = await getSeatsHistorySummary(scope, identifier);
    logger.info(`Returning ${history.length} seat history entries for ${scope}:${identifier}`);
    return history;
  } catch (error: unknown) {
    logger.error('Error fetching seats history:', error);
    throw createError({ statusCode: 500, statusMessage: 'Error fetching seats history: ' + String(error) });
  }
});
