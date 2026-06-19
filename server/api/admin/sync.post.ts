/**
 * Admin endpoint to manually trigger data sync
 * POST /api/admin/sync
 */

import { syncMetricsForDate, syncMetricsForDateRange, syncGaps, syncBulk } from '../../services/sync-service';
import { clearFailedSyncsForScope, getFailedSyncsForScope } from '../../storage/sync-storage';
import { Options } from '@/model/Options';
import { isMockMode } from '../../services/github-copilot-usage-api-mock';

export default defineEventHandler(async (event) => {
  const logger = console;
  const query = getQuery(event);
  let rawBody = await readBody(event).catch(() => ({}));
  // If body wasn't parsed as an object (e.g. missing Content-Type header), try JSON.parse
  if (typeof rawBody === 'string') {
    try { rawBody = JSON.parse(rawBody); } catch { rawBody = {}; }
  }
  const body = rawBody || {};

  // Merge query and body parameters
  const params = { ...query, ...body };

  try {
    // Build options from request
    const options = Options.fromQuery(params);

    // Validate scope configuration
    const validation = options.validate();
    if (!validation.isValid) {
      throw createError({
        statusCode: 400,
        statusMessage: JSON.stringify({ error: 'Invalid options', details: validation.errors })
      });
    }

    // Get dates to sync
    const date = params.date as string | undefined;
    const action = params.action as string || 'sync-date';

    // Check if mock mode is enabled via env var
    const mockEnabled = isMockMode();

    // Prepare headers for GitHub API calls (middleware handles authentication)
    const headers = event.context.headers || new Headers();
    if (!headers.has('Authorization') && !mockEnabled) {
      throw createError({ statusCode: 401, statusMessage: 'Authorization header required' });
    }

    // Handle different sync actions
    switch (action) {
      case 'sync-date': {
        // Sync single date
        if (!date) {
          throw createError({ statusCode: 400, statusMessage: 'date parameter required for sync-date action' });
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
          throw createError({ statusCode: 400, statusMessage: 'since and until parameters required for sync-range action' });
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
          throw createError({ statusCode: 400, statusMessage: 'since and until parameters required for sync-gaps action' });
        }

        logger.info(`Syncing gaps from ${options.since} to ${options.until}`);
        const { results, gapsDetected, outsideWindow } = await syncGaps(
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
          gapsDetected,
          gapsFilled: successCount,
          outsideWindow,
          failureCount,
          results
        };
      }

      case 'sync-last-28':
      case 'sync-bulk': {  // backward-compatible alias
        // Bulk download latest 28-day report and store all new days
        logger.info(`Running bulk sync for ${options.scope}:${options.githubOrg || options.githubEnt}`);
        const bulkResult = await syncBulk(
          options.scope!,
          options.githubOrg || options.githubEnt || 'unknown',
          headers,
          options.githubTeam
        );

        return {
          action: 'sync-last-28',
          ...bulkResult
        };
      }

      case 'retry-failed': {
        // Re-attempt every sync_status row in 'failed' state for this scope.
        const identifier = options.githubOrg || options.githubEnt || 'unknown';
        const failed = await getFailedSyncsForScope(options.scope!, identifier, options.githubTeam);

        if (failed.length === 0) {
          return { action: 'retry-failed', retried: 0, successCount: 0, failureCount: 0, results: [] };
        }

        logger.info(`Retrying ${failed.length} failed sync(s) for ${options.scope}:${identifier}`);
        const results = [];
        for (const entry of failed) {
          const r = await syncMetricsForDate({
            scope: options.scope!,
            identifier,
            date: entry.metricsDate,
            teamSlug: options.githubTeam,
            headers,
          });
          results.push(r);
        }

        const successCount = results.filter(r => r.success).length;
        return {
          action: 'retry-failed',
          retried: failed.length,
          successCount,
          failureCount: failed.length - successCount,
          results,
        };
      }

      case 'clear-failed': {
        const scope = options.scope === 'enterprise' ? 'enterprise' : 'organization';
        const identifier = options.githubOrg || options.githubEnt;
        if (!identifier) {
          throw createError({ statusCode: 400, statusMessage: 'organization or enterprise identifier required' });
        }
        const removed = await clearFailedSyncsForScope(scope, identifier, options.githubTeam);
        logger.info(`Cleared ${removed} failed sync row(s) for ${scope}:${identifier}`);
        return { action: 'clear-failed', removed };
      }

      default:
        throw createError({
          statusCode: 400,
          statusMessage: JSON.stringify({ error: `Unknown action: ${action}` })
        });
    }

  } catch (error: unknown) {
    logger.error('Error in sync endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw createError({
      statusCode: 500,
      statusMessage: JSON.stringify({ error: 'Sync failed', message: errorMessage })
    });
  }
});
