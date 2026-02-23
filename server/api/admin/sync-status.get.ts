/**
 * Admin endpoint to check sync status
 * GET /api/admin/sync-status
 */

import { getSyncStats, detectGaps } from '../../services/sync-service';
import { getPendingSyncs, getFailedSyncs } from '../../storage/sync-storage';
import { Options } from '@/model/Options';

export default defineEventHandler(async (event) => {
  const logger = console;
  const query = getQuery(event);

  try {
    const options = Options.fromQuery(query);

    // If specific scope provided, get detailed stats
    if (options.scope && (options.githubOrg || options.githubEnt)) {
      const identifier = options.githubOrg || options.githubEnt || '';
      
      // Default to last 30 days if not specified
      const endDate = options.until || new Date().toISOString().split('T')[0];
      const startDate = options.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const stats = await getSyncStats(
        options.scope,
        identifier,
        startDate,
        endDate,
        options.githubTeam
      );

      return {
        scope: options.scope,
        identifier,
        teamSlug: options.githubTeam,
        dateRange: {
          start: startDate,
          end: endDate
        },
        stats
      };
    }

    // Otherwise, return general sync status
    const pending = await getPendingSyncs();
    const failed = await getFailedSyncs();

    return {
      pending: pending.length,
      failed: failed.length,
      pendingSyncs: pending.slice(0, 10), // Limit to 10 most recent
      failedSyncs: failed.slice(0, 10)
    };

  } catch (error: unknown) {
    logger.error('Error getting sync status:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Failed to get sync status', message: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
