/**
 * Per-user Copilot usage metrics API endpoint
 * GET /api/user-metrics
 *
 * Returns aggregated per-user Copilot metrics for the organisation or enterprise.
 * Uses the same download-link based pattern as the aggregated metrics endpoint.
 *
 * Large-enterprise support: the download files may be split across multiple
 * signed URLs. All files are fetched in parallel and the user_totals arrays
 * are merged before returning to the client.
 */

import { Options } from '@/model/Options';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  fetchLatestUserReport,
  type UserReport
} from '../services/github-copilot-usage-api';
import { getLatestUserMetrics } from '../storage/user-metrics-storage';

export default defineEventHandler(async (event) => {
  const logger = console;
  const query = getQuery(event);
  const options = Options.fromQuery(query);

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (options.isDataMocked) {
    const mockPath = options.getUserMetricsMockDataPath();
    try {
      const path = resolve(mockPath);
      const data = readFileSync(path, 'utf8');
      const report = JSON.parse(data) as UserReport;
      return report.user_totals;
    } catch (err) {
      logger.error('Failed to read user metrics mock data:', err);
      return [];
    }
  }

  // ── Storage / historical mode ───────────────────────────────────────────────
  if (process.env.ENABLE_HISTORICAL_MODE === 'true') {
    try {
      const scope = options.scope || 'organization';
      const identifier = options.githubOrg || options.githubEnt || '';
      const stored = await getLatestUserMetrics(scope, identifier);
      if (stored) {
        logger.info(`Returning ${stored.userTotals.length} user metrics entries from storage (${stored.reportStartDay}–${stored.reportEndDay})`);
        return stored.userTotals;
      }
      logger.info('No user metrics in storage yet, attempting live fetch');
    } catch (err) {
      logger.warn('Storage lookup failed, falling back to live fetch:', err);
    }
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  if (!event.context.headers?.has('Authorization')) {
    logger.error('No Authentication provided for user-metrics endpoint');
    throw createError({ statusCode: 401, statusMessage: 'No Authentication provided' });
  }

  // ── Live API fetch ─────────────────────────────────────────────────────────
  try {
    const scope = options.scope || 'organization';
    const identifier = options.githubOrg || options.githubEnt || '';

    if (!identifier) {
      throw createError({ statusCode: 400, statusMessage: 'GitHub organization or enterprise must be configured' });
    }

    logger.info(`Fetching user metrics for ${scope}:${identifier}`);

    const report = await fetchLatestUserReport(
      { scope, identifier, teamSlug: options.githubTeam },
      event.context.headers
    );

    const userTotals = report.user_totals ?? [];
    logger.info(`Returned ${userTotals.length} user records for ${scope}:${identifier}`);
    return userTotals;

  } catch (error: unknown) {
    logger.error('Error fetching user metrics:', error);
    const status = typeof error === 'object' && error && 'statusCode' in error
      ? (error as { statusCode?: number }).statusCode
      : 500;
    throw createError({
      statusCode: status || 500,
      statusMessage: 'Error fetching user metrics. Error: ' + String(error)
    });
  }
});
