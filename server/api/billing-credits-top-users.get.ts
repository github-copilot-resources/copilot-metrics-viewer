/**
 * GET /api/billing-credits-top-users — admin only
 *
 * Returns a global top-N per-user billing ranking from the local
 * billing_credit_usage table. This endpoint is intentionally DB-only in real
 * mode because GitHub's live AI-credit billing JSON cannot rank all users.
 */

import { Options } from '@/model/Options';
import { requireUsageAdmin } from '../utils/usage-admin';
import {
  aggregateTopBillingUsers,
  decideSource,
  resolveWindow,
  type TopBillingUsersResponse,
} from '../services/billing-credit-reader';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockBilling from '../../public/mock-data/billing-credits.json';
import type { BillingCreditsResponse } from './billing-credits.get';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export default defineEventHandler(async (event): Promise<TopBillingUsersResponse> => {
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  const config = useRuntimeConfig(event);

  if (!options.isDataMocked) {
    await requireUsageAdmin(event);
  }

  const limit = parseLimit(query.limit);
  const metric = parseMetric(query.metric);

  const window = resolveWindow({
    year: query.year ? Number(query.year) : undefined,
    month: query.month ? Number(query.month) : undefined,
    day: query.day ? Number(query.day) : undefined,
    since: query.since ? String(query.since) : undefined,
    until: query.until ? String(query.until) : undefined,
  });

  if (options.isDataMocked) {
    return topUsersFromMock(mockBilling as BillingCreditsResponse, limit, metric);
  }

  const billingEnterprise = ((config.billingEnterprise as string | undefined) || '').trim();
  const dbEnterprise = billingEnterprise
    || (options.scope === 'enterprise' ? options.githubEnt : '')
    || '';
  if (!dbEnterprise) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Top spenders requires DB-backed enterprise billing data.',
      data: { reason: 'top-users-requires-db' },
    });
  }

  const decision = await decideSource(dbEnterprise, window.startDate, window.endDate);
  if (decision.source !== 'db') {
    setResponseHeader(event, 'X-Data-Source', 'live');
    setResponseHeader(event, 'X-Data-Source-Reason', decision.reason);
    throw createError({
      statusCode: 409,
      statusMessage:
        `No ingested billing data covers ${window.startDate} → ${window.endDate}. ` +
        `Top spenders requires DB-backed enterprise billing data.`,
      data: { reason: 'top-users-requires-db', window },
    });
  }

  setResponseHeader(event, 'X-Data-Source', 'db');
  if (decision.lastIngestAt) {
    setResponseHeader(event, 'X-Data-Source-Synced-At', decision.lastIngestAt);
  }
  setResponseHeader(event, 'X-Data-Source-Reason', decision.reason);

  return await aggregateTopBillingUsers(dbEnterprise, window, {
    limit,
    metric,
    model: query.model ? String(query.model) : undefined,
    sku: query.sku ? String(query.sku) : undefined,
  });
});

function parseLimit(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = raw === undefined ? DEFAULT_LIMIT : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(Math.trunc(n), MAX_LIMIT));
}

function parseMetric(value: unknown): 'netAmount' | 'grossAmount' | 'credits' {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'grossAmount' || raw === 'credits') return raw;
  return 'netAmount';
}

function topUsersFromMock(
  mock: BillingCreditsResponse,
  limit: number,
  metric: 'netAmount' | 'grossAmount' | 'credits',
): TopBillingUsersResponse {
  const byUser = new Map<string, { user: string; credits: number; grossAmount: number; netAmount: number; models: Set<string> }>();
  for (const item of mock.usageItems ?? []) {
    const user = (item.user || '').trim();
    if (!user) continue;
    const key = user.toLowerCase();
    const agg = byUser.get(key) || { user, credits: 0, grossAmount: 0, netAmount: 0, models: new Set<string>() };
    agg.credits += Number.isFinite(item.netQuantity) ? item.netQuantity : 0;
    agg.credits += Number.isFinite(item.discountQuantity) ? item.discountQuantity : 0;
    agg.grossAmount += Number.isFinite(item.grossAmount) ? item.grossAmount : 0;
    agg.netAmount += Number.isFinite(item.netAmount) ? item.netAmount : 0;
    if (item.model) agg.models.add(item.model);
    byUser.set(key, agg);
  }
  const metricKey = metric;
  return {
    timePeriod: mock.timePeriod,
    enterprise: mock.enterprise || '',
    users: [...byUser.values()]
      .sort((a, b) => b[metricKey] - a[metricKey] || a.user.localeCompare(b.user))
      .slice(0, limit)
      .map(u => ({
        user: u.user,
        credits: u.credits,
        grossAmount: u.grossAmount,
        netAmount: u.netAmount,
        models: u.models.size,
      })),
  };
}
