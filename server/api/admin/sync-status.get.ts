/**
 * Admin endpoint to check sync status
 * GET /api/admin/sync-status
 */

import { getSyncStats } from '../../services/sync-service';
import { getPendingSyncs, getFailedSyncs } from '../../storage/sync-storage';
import { Options } from '@/model/Options';
import {
  getInFlightBillingCsvJob,
  listRecentBillingCsvJobs,
} from '../../storage/billing-csv-sync-status-storage';

export default defineEventHandler(async (event) => {
  const logger = console;
  const query = getQuery(event);

  try {
    const options = Options.fromQuery(query);

    // Billing CSV status is enterprise-scoped (independent of the dashboard
    // scope+identifier), so compute it up front and include it on BOTH
    // response shapes — otherwise the scoped branch below would drop it and
    // the AdminPanel's Billing CSV ingest section never renders.
    let billingCsv: { inFlight: unknown; recent: unknown[] } | null = null;
    const config = useRuntimeConfig();
    const billingEnterprise = (((config as Record<string, unknown>).billingEnterprise as string | undefined) || '').trim();
    if (billingEnterprise) {
      try {
        const [inFlight, recent] = await Promise.all([
          getInFlightBillingCsvJob(billingEnterprise),
          listRecentBillingCsvJobs(billingEnterprise, 10),
        ]);
        billingCsv = { inFlight, recent };
      } catch (e) {
        // DB may not be configured (JSON mode). Surface a clear shape.
        billingCsv = { inFlight: null, recent: [] };
        logger.warn('Billing CSV status query failed:', e instanceof Error ? e.message : String(e));
      }
    }

    // If specific scope provided, get detailed stats
    if (options.scope && (options.githubOrg || options.githubEnt)) {
      const identifier = options.githubOrg || options.githubEnt || '';
      
      // Default to last 30 days if not specified
      const endDate = options.until || new Date().toISOString().split('T')[0]!;
      const startDate = options.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

      const stats = await getSyncStats(
        options.scope,
        identifier,
        startDate,
        endDate,
        options.githubTeam
      );

      return {
        scope: options.scope,
        identifier,
        teamSlug: options.githubTeam,
        dateRange: {
          start: startDate,
          end: endDate
        },
        stats,
        billingCsv,
      };
    }

    // Otherwise, return general sync status
    const pending = await getPendingSyncs();
    const failed = await getFailedSyncs();

    // Sort by creation date (most recent first)
    pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    failed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      pending: pending.length,
      failed: failed.length,
      pendingSyncs: pending.slice(0, 10), // 10 most recent pending
      failedSyncs: failed.slice(0, 10), // 10 most recent failed
      billingCsv,
    };

  } catch (error: unknown) {
    logger.error('Error getting sync status:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw createError({
      statusCode: 500,
      statusMessage: JSON.stringify({ error: 'Failed to get sync status', message: errorMessage })
    });
  }
});
