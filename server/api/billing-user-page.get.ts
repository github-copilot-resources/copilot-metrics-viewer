import { Options } from '@/model/Options';
import { requireUsageAdmin } from '../utils/usage-admin';
import { requireTeamMembershipOrAdmin } from '../utils/team-membership';
import { resolveWindow } from '../services/billing-credit-reader';
import { BillingPageUnavailable, readBillingUserPage } from '../services/billing-user-page';
import { BillingUserAliasError, parseBillingUserAliases } from '../../shared/utils/billing-user-identity';
import type { BillingUserPage, BillingUserPageRow, BillingUserSort } from '../../shared/types/billing-user-page';
import mockBilling from '../../public/mock-data/billing-credits-synthetic-attribution-demo.json';

const sorts = new Set(['user', 'tokens', 'credits', 'grossAmount', 'netAmount', 'models']);

export default defineEventHandler(async (event): Promise<BillingUserPage> => {
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  const config = useRuntimeConfig(event);
  if (!options.isDataMocked) await requireUsageAdmin(event);
  await requireTeamMembershipOrAdmin(event, options.scope ?? 'organization', options.githubOrg, options.githubTeam);
  const scalar = (key: string, fallback = ''): string => {
    const value = query[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: `Invalid ${key}` });
    return value;
  };
  if (options.githubTeam?.toLowerCase().startsWith('reports-to:')) {
    throw createError({ statusCode: 409, statusMessage: 'Virtual team membership is unavailable.', data: { reason: 'membership-unavailable' } });
  }
  if (query.logins !== undefined || query.users !== undefined || query.cost_center_id !== undefined || query.search !== undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Client roster lists, search and cost_center_id are not supported by the snapshot page contract.' });
  }
  const page = Number(scalar('page', '1'));
  const itemsPerPage = Number(scalar('itemsPerPage', '25'));
  const sortKey = scalar('sortKey', 'user') as BillingUserSort;
  const sortOrder = scalar('sortOrder', 'asc');
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(itemsPerPage)
    || itemsPerPage < 1 || itemsPerPage > 50 || !sorts.has(sortKey) || !['asc', 'desc'].includes(sortOrder)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid billing page options.' });
  }
  // The mock dataset is explicitly synthetic, not a published source certification.
  if (options.isDataMocked) {
    const byUser = new Map<string, BillingUserPageRow>();
    const models = new Map<string, Set<string>>();
    for (const item of mockBilling.usageItems) {
      if (!item.user) continue;
      const key = item.user.toLowerCase();
      const row = byUser.get(key) ?? { user: key, tokens: 0, credits: 0, grossAmount: 0, netAmount: 0, models: 1, billingState: 'loaded' as const };
      const userModels = models.get(key) ?? new Set<string>();
      if (item.model) userModels.add(item.model);
      models.set(key, userModels);
      row.models = userModels.size;
      row.credits! += item.netQuantity + item.discountQuantity;
      row.grossAmount! += item.grossAmount;
      row.netAmount! += item.netAmount;
      byUser.set(key, row);
    }
    const rows = [...byUser.values()].sort((a, b) => {
      const av = a[sortKey]!;
      const bv = b[sortKey]!;
      const comparison = typeof av === 'string' ? (av < String(bv) ? -1 : av > String(bv) ? 1 : 0) : av - Number(bv);
      return comparison * (sortOrder === 'desc' ? -1 : 1) || (a.user < b.user ? -1 : a.user > b.user ? 1 : 0);
    });
    return { rows: rows.slice((page - 1) * itemsPerPage, page * itemsPerPage), total: rows.length, page, itemsPerPage, version: 'synthetic-demo', billingSortAvailable: true };
  }
  const scope = options.scope === 'enterprise' ? 'enterprise' : 'organization';
  const identifier = (scope === 'enterprise' ? options.githubEnt : options.githubOrg) ?? '';
  const enterprise = String(config.billingEnterprise || (scope === 'enterprise' ? options.githubEnt : '') || '').trim();
  if (!enterprise) throw createError({ statusCode: 409, statusMessage: 'Bounded billing pages require ingested enterprise billing data.', data: { reason: 'billing-coverage-missing' } });
  try {
    const window = resolveWindow({
      since: scalar('since') || undefined, until: scalar('until') || undefined,
      year: query.year ? Number(scalar('year')) : undefined,
      month: query.month ? Number(scalar('month')) : undefined,
      day: query.day ? Number(scalar('day')) : undefined,
    });
    return await readBillingUserPage({
      scope, identifier, enterprise, team: options.githubTeam, githubOrg: options.githubOrg,
      usageSince: scalar('usageSince'), usageUntil: scalar('usageUntil'),
      billingSince: window.startDate, billingUntil: window.endDate, page, itemsPerPage, sortKey,
      sortOrder: sortOrder as 'asc' | 'desc', version: scalar('version') || undefined,
      aliases: parseBillingUserAliases(process.env.NUXT_BILLING_USER_ALIASES),
      filters: {
        model: scalar('model') || undefined, sku: scalar('sku') || undefined,
        product: scalar('product') || undefined, organization: scalar('organization') || undefined,
        repository: scalar('repository') || undefined,
      },
    });
  } catch (error) {
    if (error instanceof BillingUserAliasError) {
      throw createError({ statusCode: 503, statusMessage: 'Invalid NUXT_BILLING_USER_ALIASES configuration.' });
    }
    if (error instanceof BillingPageUnavailable) {
      throw createError({ statusCode: 409, statusMessage: `Per-user billing unavailable: ${error.reason}`, data: { reason: error.reason } });
    }
    if (error instanceof Error && /Invalid|window|scope|filter|ALIASES/.test(error.message)) {
      throw createError({ statusCode: 400, statusMessage: error.message });
    }
    throw createError({ statusCode: 503, statusMessage: 'Per-user billing could not be read. Retry after checking snapshot ingestion.' });
  }
});
