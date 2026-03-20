/**
 * Admin endpoint to manually trigger data sync
 * POST /api/admin/sync
 */

import { syncMetricsForDate, syncMetricsForDateRange, syncGaps, syncBulk } from '../../services/sync-service';
import { Options } from '@/model/Options';
import { isMockMode } from '../../services/github-copilot-usage-api-mock';

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

    // Check if mock mode is enabled via env var
    const mockEnabled = isMockMode();

    // Prepare headers for GitHub API calls (middleware handles authentication)
    const headers = event.context.headers || new Headers();
    if (!headers.has('Authorization') && !mockEnabled) {
      return new Response('Authorization header required', { status: 401 });
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

      case 'sync-bulk': {
        // Bulk download latest 28-day report and store all new days
        logger.info(`Running bulk sync for ${options.scope}:${options.githubOrg || options.githubEnt}`);
        const bulkResult = await syncBulk(
          options.scope!,
          options.githubOrg || options.githubEnt || 'unknown',
          headers,
          options.githubTeam
        );

        return {
          action: 'sync-bulk',
          ...bulkResult
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
