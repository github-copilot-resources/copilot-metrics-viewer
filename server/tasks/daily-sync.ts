/**
 * Daily sync scheduled task
 * Automatically syncs yesterday's metrics data
 * 
 * This task runs on a schedule defined by SYNC_SCHEDULE env var (default: 2 AM daily)
 * Can be disabled by setting SYNC_ENABLED=false
 */

import { syncMetricsForDate } from '../services/sync-service';

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

    // Sync yesterday's data (most recent available)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const date = yesterday.toISOString().split('T')[0];

    logger.info(`Starting daily sync for ${scope}:${identifier} on ${date}`);

    try {
      const result = await syncMetricsForDate({
        scope,
        identifier,
        date,
        teamSlug: githubTeam || undefined,
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      logger.info(`Sync completed for ${date}:`, result);

      return {
        result: 'success',
        date,
        syncResult: result
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Sync failed for ${date}:`, errorMessage);

      return {
        result: 'error',
        date,
        error: errorMessage
      };
    }
  }
});
