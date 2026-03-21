/**
 * Daily sync scheduled task
 * Downloads the latest 28-day report and saves any new days to storage.
 * Also syncs per-user metrics using the users-28-day report.
 * 
 * This task runs on a schedule defined by SYNC_SCHEDULE env var (default: 2 AM daily)
 * Can be disabled by setting SYNC_ENABLED=false
 */

import { syncBulk, syncUserMetrics, syncSeats, type SeatsSyncResult } from '../services/sync-service';

export default defineTask({
  meta: {
    name: 'daily-metrics-sync',
    description: 'Sync Copilot metrics daily from GitHub API to storage',
  },
  async run() {
    const logger = console;
    const config = useRuntimeConfig();

    // Check if sync is enabled
    const syncEnabled = process.env.SYNC_ENABLED === 'true';
    if (!syncEnabled) {
      logger.info('Sync is disabled (SYNC_ENABLED=false), skipping');
      return { result: 'skipped', reason: 'disabled' };
    }

    // Get configuration
    const scope = (config.public.scope as 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise') || 'organization';
    const githubOrg = config.public.githubOrg;
    const githubEnt = config.public.githubEnt;
    const githubTeam = config.public.githubTeam;
    const githubToken = config.githubToken;

    if (!githubToken) {
      logger.error('NUXT_GITHUB_TOKEN not configured, cannot run sync');
      return { result: 'error', reason: 'no_token' };
    }

    const identifier = githubOrg || githubEnt || '';
    if (!identifier) {
      logger.error('No GitHub org or enterprise configured');
      return { result: 'error', reason: 'no_identifier' };
    }

    logger.info(`Starting daily bulk sync for ${scope}:${identifier}`);

    const headers = {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    try {
      const result = await syncBulk(
        scope,
        identifier,
        headers,
        githubTeam || undefined
      );

      logger.info(`Aggregated sync completed: ${result.savedDays} saved, ${result.skippedDays} skipped, ${result.errors.length} errors`);

      // Also sync per-user metrics
      const userResult = await syncUserMetrics(
        scope,
        identifier,
        headers,
        githubTeam || undefined
      );

      logger.info(`User metrics sync completed: ${userResult.userCount} users, success=${userResult.success}`);

      // Sync seats snapshot when historical mode is enabled
      let seatsResult: SeatsSyncResult | undefined;
      if (process.env.ENABLE_HISTORICAL_MODE === 'true') {
        seatsResult = await syncSeats(scope, identifier, headers);
        logger.info(`Seats sync completed: ${seatsResult.seatCount} seats, success=${seatsResult.success}`);
      }

      const overallSuccess = result.success && userResult.success && (seatsResult == null || seatsResult.success);
      return {
        result: overallSuccess ? 'success' : 'partial',
        syncResult: result,
        userMetricsSyncResult: userResult,
        ...(seatsResult != null && { seatsSyncResult: seatsResult })
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Sync failed:`, errorMessage);

      return {
        result: 'error',
        error: errorMessage
      };
    }
  }
});
