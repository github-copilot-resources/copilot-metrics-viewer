import { Options } from '@/model/Options';
import { requireUsageAdmin } from '../utils/usage-admin';
import { requireTeamMembershipOrAdmin } from '../utils/team-membership';
import { isDbConfigured } from '../storage/db';
import { getMembershipSnapshot } from '../storage/roster-foundation-storage';
import { resolveWindow } from '../services/billing-credit-reader';
import { getStoredBillingUserPage } from '../services/billing-user-page';
import { parseBillingUserAliases } from '../../shared/utils/billing-user-identity';
import type { BillingUserPage } from '../../shared/types/billing-user-page';

export default defineEventHandler(async (event): Promise<BillingUserPage> => {
  const query = getQuery(event);
  const options = Options.fromQuery(query);
  if (!options.isDataMocked) await requireUsageAdmin(event);
  await requireTeamMembershipOrAdmin(event, options.scope ?? 'organization', options.githubOrg, options.githubTeam);
  const unavailable = (reason: string): BillingUserPage => ({ available: false, reason });
  if (options.isDataMocked || !isDbConfigured()) {
    return unavailable('Import billing for this scope and period to enable Credits, Gross, Net and Models sorting.');
  }
  if (options.githubTeam?.startsWith('reports-to:') || query.users) {
    return unavailable('Stored billing sorting is not available for reports-to groups. User and Tokens sorting still works.');
  }
  const scope = options.scope === 'enterprise' ? 'enterprise' : 'organization';
  const identifier = scope === 'enterprise' ? options.githubEnt : options.githubOrg;
  const enterprise = String(useRuntimeConfig(event).billingEnterprise || (scope === 'enterprise' ? identifier : '')).trim();
  if (!enterprise || !identifier) return unavailable('Configure a billing enterprise and import billing to enable billing sorting.');
  let window;
  let aliases;
  try {
    window = resolveWindow({
      year: query.year ? Number(query.year) : undefined, month: query.month ? Number(query.month) : undefined,
      day: query.day ? Number(query.day) : undefined, since: query.since ? String(query.since) : undefined,
      until: query.until ? String(query.until) : undefined,
    });
    aliases = parseBillingUserAliases(process.env.NUXT_BILLING_USER_ALIASES);
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Invalid billing query' });
  }
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 25);
  const sort = String(query.sort ?? 'user');
  const order = String(query.order ?? 'asc');
  if (!['user', 'tokens', 'credits', 'grossAmount', 'netAmount', 'models'].includes(sort)
    || !['asc', 'desc'].includes(order) || ![10, 25, 50].includes(limit)
    || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * limit)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid billing sort or pagination' });
  }
  // Month mode changes billing dates only; the parent usage window remains
  // independent, just as on /api/user-metrics.
  const usageSince = query.usageSince ? String(query.usageSince) : undefined;
  const usageUntil = query.usageUntil ? String(query.usageUntil) : undefined;
  if ([usageSince, usageUntil].some(date => date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid usage dates' });
  }
  try {
    let membershipVersion: string | undefined;
    if (options.githubTeam) {
      const membership = await getMembershipSnapshot({
        scope, identifier, teamKind: 'github', teamKey: options.githubTeam,
        githubOrg: scope === 'enterprise' ? options.githubOrg : undefined,
      }, new Date());
      if (!membership.available) return unavailable('Sync team membership to enable safely scoped stored billing sorting.');
      membershipVersion = membership.version;
    }
    return await getStoredBillingUserPage({
      enterprise, scope, identifier, window, aliases, usageSince, usageUntil, membershipVersion,
      page, limit, sort, order: order as 'asc' | 'desc',
      model: query.model ? String(query.model) : undefined, sku: query.sku ? String(query.sku) : undefined,
    });
  } catch {
    return unavailable('Stored billing is unavailable. User and Tokens sorting and page-by-page billing loading still work.');
  }
});
