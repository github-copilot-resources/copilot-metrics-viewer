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
 *   - SYNC_DAYS_BACK: Number of days to sync (default: 28, uses bulk download)
 */

import { syncBulk, syncMetricsForDateRange } from './services/sync-service';

async function runSync() {
  const logger = console;

  // Get configuration from environment
  const scope = process.env.NUXT_PUBLIC_SCOPE || 'organization';
  const githubOrg = process.env.NUXT_PUBLIC_GITHUB_ORG;
  const githubEnt = process.env.NUXT_PUBLIC_GITHUB_ENT;
  const githubTeam = process.env.NUXT_PUBLIC_GITHUB_TEAM;
  const githubToken = process.env.NUXT_GITHUB_TOKEN;
  const daysBack = parseInt(process.env.SYNC_DAYS_BACK || '28', 10);

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
  logger.info(`Syncing last ${daysBack} day(s) via bulk download`);

  try {
    // Use bulk download — one API call for up to 28 days
    const result = await syncBulk(
      scope as any,
      identifier,
      headers,
      githubTeam || undefined
    );

    logger.info(`Sync completed: ${result.savedDays} saved, ${result.skippedDays} skipped`);

    if (result.errors.length > 0) {
      logger.error('Some days failed:');
      result.errors.forEach(e => logger.error(`  ${e.date}: ${e.error}`));
      process.exit(1);
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
