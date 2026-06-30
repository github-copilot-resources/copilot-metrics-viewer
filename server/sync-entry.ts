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
 *   - NUXT_GITHUB_TOKEN: GitHub personal access token (alternative to GitHub App)
 *   - NUXT_GITHUB_APP_ID: GitHub App ID (alternative to PAT)
 *   - NUXT_GITHUB_APP_PRIVATE_KEY: GitHub App private key (alternative to PAT)
 *   - NUXT_GITHUB_API_BASE_URL: Optional API base URL override for GHE.com (e.g. https://api.SUBDOMAIN.ghe.com)
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
import { getSyncAuthHeaders } from './utils/sync-auth';
import { runForegroundIngest } from './services/billing-csv-ingester';
import { BillingCsvJobInFlightError } from './storage/billing-csv-sync-status-storage';

export async function runSync() {
  const logger = console;

  // Get configuration from environment
  const rawScope = process.env.NUXT_PUBLIC_SCOPE || 'organization';
  const scope = (rawScope === 'team-organization' ? 'organization'
    : rawScope === 'team-enterprise' ? 'enterprise'
    : rawScope) as 'organization' | 'enterprise';
  const githubOrg = process.env.NUXT_PUBLIC_GITHUB_ORG;
  const githubEnt = process.env.NUXT_PUBLIC_GITHUB_ENT;
  const daysBack = parseInt(process.env.SYNC_DAYS_BACK || '28', 10);

  const identifier = githubOrg || githubEnt || '';
  if (!identifier) {
    logger.error('NUXT_PUBLIC_GITHUB_ORG or NUXT_PUBLIC_GITHUB_ENT must be set');
    process.exit(1);
    return; // guard: allows tests to mock process.exit without continuing
  }

  // Get authentication headers (supports both PAT and GitHub App)
  let headers: Headers;
  try {
    headers = await getSyncAuthHeaders(logger, identifier);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
    return; // guard: allows tests to mock process.exit without continuing
  }

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

    // Optional billing CSV ingest. Only runs when both env vars are set and
    // the database mode is active (this entry point requires DB). Failures
    // are logged but do NOT roll back the metrics sync we just completed.
    await runBillingCsvIfConfigured(logger);

  } catch (error) {
    logger.error('Sync job failed:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

/**
 * Run a billing CSV ingest in the foreground when configured. Surfaces
 * failure via process.exitCode=1 so the CronJob runner sees a non-zero
 * exit, but does not throw — the metrics-sync commit upstream is preserved.
 * Skips quietly when NUXT_GITHUB_BILLING_TOKEN or NUXT_BILLING_ENTERPRISE is
 * missing, and logs+exits 0 if another job is already in flight (next cron
 * tick picks up).
 */
async function runBillingCsvIfConfigured(logger: Console): Promise<void> {
  const token = (process.env.NUXT_GITHUB_BILLING_TOKEN || '').trim();
  const enterprise = (process.env.NUXT_BILLING_ENTERPRISE || '').trim();
  if (!token || !enterprise) {
    logger.info('Billing CSV ingest skipped (NUXT_GITHUB_BILLING_TOKEN or NUXT_BILLING_ENTERPRISE not set)');
    return;
  }
  const daysBack = Math.max(1, parseInt(process.env.BILLING_CSV_DAYS_BACK || '30', 10));
  const end = new Date();
  const start = new Date(end.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  logger.info(`Starting billing CSV ingest for ${enterprise}: ${startDate} → ${endDate}`);
  try {
    const result = await runForegroundIngest(token, enterprise, startDate, endDate, 'sync-container');
    if (result.status === 'completed') {
      logger.info(`Billing CSV ingest completed: ${result.rowsIngested} row(s) from ${result.downloadUrlCount} file(s)`);
    } else {
      logger.error(`Billing CSV ingest finished with status=${result.status}: ${result.errorMessage}`);
      process.exitCode = 1;
    }
  } catch (e) {
    if (e instanceof BillingCsvJobInFlightError) {
      logger.warn(`Billing CSV ingest skipped: ${e.message}. Next sync will retry.`);
      return;
    }
    logger.error('Billing CSV ingest crashed:', e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

// Run the sync only when executed as the main entry point (not when imported for testing).
// Using fileURLToPath(import.meta.url) is the standard ESM way to detect the main module —
// it works correctly with tsx (.ts), compiled output (.js), and bundled builds alike.
import { fileURLToPath } from 'node:url';
const _isMain = fileURLToPath(import.meta.url) === process.argv[1];
if (_isMain) {
  runSync();
}
