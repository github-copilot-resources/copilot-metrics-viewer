/**
 * Standalone entry point for sync job
 * This can be run as a separate container or cron job
 * 
 * Usage:
 *   node server/sync-entry.ts
 * 
 * Environment variables:
 *   - NUXT_PUBLIC_SCOPE: organization or enterprise
 *   - NUXT_PUBLIC_GITHUB_ORG: GitHub organization slug
 *   - NUXT_PUBLIC_GITHUB_ENT: GitHub enterprise slug
 *   - NUXT_GITHUB_TOKEN: GitHub personal access token
 *   - SYNC_DAYS_BACK: Number of days to sync (default: 1)
 */

import { syncMetricsForDate, syncMetricsForDateRange } from './services/sync-service';

async function runSync() {
  const logger = console;

  // Get configuration from environment
  const scope = process.env.NUXT_PUBLIC_SCOPE || 'organization';
  const githubOrg = process.env.NUXT_PUBLIC_GITHUB_ORG;
  const githubEnt = process.env.NUXT_PUBLIC_GITHUB_ENT;
  const githubTeam = process.env.NUXT_PUBLIC_GITHUB_TEAM;
  const githubToken = process.env.NUXT_GITHUB_TOKEN;
  const daysBack = parseInt(process.env.SYNC_DAYS_BACK || '1', 10);

  if (!githubToken) {
    logger.error('NUXT_GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const identifier = githubOrg || githubEnt || '';
  if (!identifier) {
    logger.error('NUXT_PUBLIC_GITHUB_ORG or NUXT_PUBLIC_GITHUB_ENT must be set');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  logger.info(`Starting sync for ${scope}:${identifier}`);
  logger.info(`Syncing last ${daysBack} day(s)`);

  try {
    if (daysBack === 1) {
      // Sync just yesterday
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const date = yesterday.toISOString().split('T')[0];

      const result = await syncMetricsForDate({
        scope: scope as any,
        identifier,
        date,
        teamSlug: githubTeam || undefined,
        headers
      });

      if (result.success) {
        logger.info(`✓ Successfully synced ${date}`);
      } else {
        logger.error(`✗ Failed to sync ${date}: ${result.error}`);
        process.exit(1);
      }
    } else {
      // Sync date range
      const endDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const startDate = new Date(endDate.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      logger.info(`Syncing range: ${startDateStr} to ${endDateStr}`);

      const results = await syncMetricsForDateRange(
        scope as any,
        identifier,
        startDateStr,
        endDateStr,
        headers,
        githubTeam || undefined
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info(`Sync completed: ${successCount} succeeded, ${failureCount} failed`);

      if (failureCount > 0) {
        logger.error('Some syncs failed:');
        results.filter(r => !r.success).forEach(r => {
          logger.error(`  ${r.date}: ${r.error}`);
        });
        process.exit(1);
      }
    }

    logger.info('Sync job completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Sync job failed:', error);
    process.exit(1);
  }
}

// Run the sync
runSync();
