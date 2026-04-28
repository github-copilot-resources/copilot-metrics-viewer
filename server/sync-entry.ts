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
 *   - DATABASE_URL: PostgreSQL connection string (or use PG* env vars)
 *   - HTTP_PROXY: Optional HTTP/HTTPS proxy URL (e.g. http://proxy:8080)
 *   - CUSTOM_CA_PATH: Optional path to a custom CA certificate file
 */

// Initialize proxy agent before any fetch calls
import { initializeProxyAgent } from './utils/proxy-agent';
initializeProxyAgent(true /* exitOnError */);

import { syncBulk } from './services/sync-service';
import { initSchema } from './storage/db';
import { closePool } from './storage/db';

export async function runSync() {
  const logger = console;

  // Get configuration from environment
  const rawScope = process.env.NUXT_PUBLIC_SCOPE || 'organization';
  const scope = (rawScope === 'team-organization' ? 'organization'
    : rawScope === 'team-enterprise' ? 'enterprise'
    : rawScope) as 'organization' | 'enterprise';
  const githubOrg = process.env.NUXT_PUBLIC_GITHUB_ORG;
  const githubEnt = process.env.NUXT_PUBLIC_GITHUB_ENT;
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

  try {
    // Initialize database schema
    logger.info('Initializing database schema...');
    await initSchema();

    logger.info(`Starting sync for ${scope}:${identifier}`);
    logger.info(`Syncing last ${daysBack} day(s) via bulk download`);

    // Use bulk download — one API call for up to 28 days
    const result = await syncBulk(
      scope,
      identifier,
      headers,
      undefined,
      daysBack
    );

    logger.info(`Sync completed: ${result.savedDays} saved, ${result.skippedDays} skipped`);

    if (result.errors.length > 0) {
      logger.error('Some days failed:');
      result.errors.forEach(e => logger.error(`  ${e.date}: ${e.error}`));
    }

    logger.info('Sync job completed successfully');

  } catch (error) {
    logger.error('Sync job failed:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

// Run the sync only when executed as the main entry point (not when imported for testing)
const _isMain = process.argv[1]?.endsWith('sync-entry.ts') || process.argv[1]?.endsWith('sync-entry.js');
if (_isMain) {
  runSync();
}
