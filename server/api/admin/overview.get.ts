/**
 * Admin overview endpoint
 * GET /api/admin/overview
 *
 * Returns a consolidated snapshot of system + per-scope status for the
 * admin panel: DB connectivity, current data mode, version/uptime, available
 * data range, sync stats, and the most recent failed sync entries.
 *
 * Designed to be called once when the panel opens (and after each action) so
 * the frontend doesn't need to fan out to N endpoints.
 */

import { Options } from '@/model/Options';
import { baseScope } from '../../storage/user-day-metrics-storage';
import { getPool, isDbConfigured } from '../../storage/db';
import { getFailedSyncsForScope, getPendingSyncsForScope } from '../../storage/sync-storage';
import { getSyncStats } from '../../services/sync-service';
import { isMockMode } from '../../services/github-copilot-usage-api-mock';

interface OverviewResponse {
  db: { connected: boolean; latencyMs?: number; error?: string };
  mode: 'mock' | 'historical' | 'live';
  version: string;
  uptimeSeconds: number;
  scope: string;
  identifier: string;
  teamSlug?: string;
  dataRange: { earliest: string | null; latest: string | null };
  syncStats: {
    totalDays: number;
    syncedDays: number;
    missingDays: number;
    /** Capped at 100 — full list available via /api/admin/sync-status */
    missingDates: string[];
  };
  pendingCount: number;
  failedCount: number;
  recentFailures: Array<{
    metricsDate: string;
    errorMessage?: string;
    attemptCount: number;
    lastAttemptAt?: string;
  }>;
}

/** Probe the DB with a tiny query and report latency. */
async function probeDb(): Promise<OverviewResponse['db']> {
  const start = Date.now();
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Resolve the current data mode using the same precedence as /api/data-range. */
function resolveMode(isDataMocked: boolean, dbConnected: boolean): OverviewResponse['mode'] {
  if (isDataMocked) return 'mock';
  if (isDbConfigured() && dbConnected) return 'historical';
  return 'live';
}

/** MIN/MAX(metrics_date) across both metrics and user_day_metrics for this scope. */
async function dataRangeFromDb(
  scope: string,
  identifier: string
): Promise<{ earliest: string | null; latest: string | null }> {
  if (!identifier) return { earliest: null, latest: null };
  const pool = getPool();
  const normalizedScope = baseScope(scope);
  const { rows } = await pool.query(
    `SELECT
       LEAST(
         (SELECT MIN(metrics_date) FROM metrics
          WHERE scope = $1 AND identifier = $2),
         (SELECT MIN(metrics_date) FROM user_day_metrics
          WHERE scope = $1 AND identifier = $2)
       ) AS earliest,
       GREATEST(
         (SELECT MAX(metrics_date) FROM metrics
          WHERE scope = $1 AND identifier = $2),
         (SELECT MAX(metrics_date) FROM user_day_metrics
          WHERE scope = $1 AND identifier = $2)
       ) AS latest`,
    [normalizedScope, identifier]
  );
  const row = rows[0];
  return {
    earliest: row?.earliest ? new Date(row.earliest).toISOString().slice(0, 10) : null,
    latest: row?.latest ? new Date(row.latest).toISOString().slice(0, 10) : null,
  };
}

export default defineEventHandler(async (event): Promise<OverviewResponse> => {
  const config = useRuntimeConfig(event);
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  const scope = options.scope || 'organization';
  const identifier = options.githubOrg || options.githubEnt || '';
  const teamSlug = options.githubTeam;

  const dataMocked = options.isDataMocked || isMockMode();
  const db = dataMocked ? { connected: false } : await probeDb();
  const mode = resolveMode(dataMocked, db.connected);

  // Default response shell (used when DB is unavailable / mock mode)
  const response: OverviewResponse = {
    db,
    mode,
    version: config.public.version as string,
    uptimeSeconds: Math.floor(process.uptime()),
    scope,
    identifier,
    teamSlug,
    dataRange: { earliest: null, latest: null },
    syncStats: { totalDays: 0, syncedDays: 0, missingDays: 0, missingDates: [] },
    pendingCount: 0,
    failedCount: 0,
    recentFailures: [],
  };

  if (!db.connected || !identifier) {
    return response;
  }

  // Enrich with DB-derived data whenever the DB is reachable, regardless of
  // mode label: writes happen in any mode that uses the sync pipeline.
  try {
    response.dataRange = await dataRangeFromDb(scope, identifier);

    if (response.dataRange.earliest && response.dataRange.latest) {
      const stats = await getSyncStats(
        scope,
        identifier,
        response.dataRange.earliest,
        response.dataRange.latest,
        teamSlug
      );
      response.syncStats = {
        totalDays: stats.totalDays,
        syncedDays: stats.syncedDays,
        missingDays: stats.missingDays,
        missingDates: stats.missingDates.slice(0, 100),
      };
    }

    const [pending, failed] = await Promise.all([
      getPendingSyncsForScope(scope, identifier, teamSlug),
      getFailedSyncsForScope(scope, identifier, teamSlug),
    ]);
    response.pendingCount = pending.length;
    response.failedCount = failed.length;
    response.recentFailures = failed.slice(0, 10).map(f => ({
      metricsDate: f.metricsDate,
      errorMessage: f.errorMessage,
      attemptCount: f.attemptCount,
      lastAttemptAt: f.lastAttemptAt,
    }));
  } catch (err) {
    console.warn('[admin/overview] Enrichment failed:', err);
  }

  return response;
});
