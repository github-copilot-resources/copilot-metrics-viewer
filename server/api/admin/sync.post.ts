/**
 * Admin endpoint to manually trigger data sync
 * POST /api/admin/sync
 */

import { syncMetricsForDate, syncMetricsForDateRange, syncGaps } from '../../services/sync-service';
import { Options } from '@/model/Options';

export default defineEventHandler(async (event) => {
  const logger = console;
  const query = getQuery(event);
  const body = await readBody(event).catch(() => ({}));

  // Merge query and body parameters
  const params = { ...query, ...body };

  try {
    // Build options from request
    const options = Options.fromQuery(params);

    // Validate scope configuration
    const validation = options.validate();
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid options', details: validation.errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get dates to sync
    const date = params.date as string | undefined;
    const action = params.action as string || 'sync-date';

    // Prepare headers for GitHub API calls
    const headers = event.context.headers;
    if (!headers.has('Authorization')) {
      // In mock mode, Authorization is optional
      if (!options.isDataMocked) {
        return new Response('Authorization header required', { status: 401 });
      }
    }

    // Handle different sync actions
    switch (action) {
      case 'sync-date': {
        // Sync single date
        if (!date) {
          return new Response('date parameter required for sync-date action', { status: 400 });
        }

        logger.info(`Syncing metrics for ${date}`);
        const result = await syncMetricsForDate({
          scope: options.scope!,
          identifier: options.githubOrg || options.githubEnt || 'unknown',
          date,
          teamSlug: options.githubTeam,
          headers
        });

        return { action: 'sync-date', result };
      }

      case 'sync-range': {
        // Sync date range
        if (!options.since || !options.until) {
          return new Response('since and until parameters required for sync-range action', { status: 400 });
        }

        logger.info(`Syncing metrics from ${options.since} to ${options.until}`);
        const results = await syncMetricsForDateRange(
          options.scope!,
          options.githubOrg || options.githubEnt || 'unknown',
          options.since,
          options.until,
          headers,
          options.githubTeam
        );

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        return {
          action: 'sync-range',
          totalDays: results.length,
          successCount,
          failureCount,
          results
        };
      }

      case 'sync-gaps': {
        // Sync only missing dates in range
        if (!options.since || !options.until) {
          return new Response('since and until parameters required for sync-gaps action', { status: 400 });
        }

        logger.info(`Syncing gaps from ${options.since} to ${options.until}`);
        const results = await syncGaps(
          options.scope!,
          options.githubOrg || options.githubEnt || 'unknown',
          options.since,
          options.until,
          headers,
          options.githubTeam
        );

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        return {
          action: 'sync-gaps',
          gapsFilled: results.length,
          successCount,
          failureCount,
          results
        };
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    logger.error('Error in sync endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Sync failed', message: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
