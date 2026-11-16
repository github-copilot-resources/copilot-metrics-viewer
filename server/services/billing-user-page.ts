import { getPool } from '../storage/db';
import type { BillingWindow } from './billing-credit-reader';
import type { BillingUserAliases } from '../../shared/utils/billing-user-identity';
import type { BillingUserPage } from '../../shared/types/billing-user-page';

const SORT_COLUMNS: Record<string, string> = {
  user: 'r.login', tokens: 'r.tokens', credits: 'b.credits',
  grossAmount: 'b.gross_amount', netAmount: 'b.net_amount', models: 'b.models',
};

interface PageInput {
  enterprise: string;
  scope: 'organization' | 'enterprise';
  identifier: string;
  window: BillingWindow;
  usageSince?: string;
  usageUntil?: string;
  membershipVersion?: string;
  page: number;
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
  aliases: BillingUserAliases;
  model?: string;
  sku?: string;
}

export async function getStoredBillingUserPage(input: PageInput): Promise<BillingUserPage> {
  if (!Object.hasOwn(SORT_COLUMNS, input.sort)) throw new Error('Invalid billing sort');
  if (![10, 25, 50].includes(input.limit) || !Number.isSafeInteger(input.page) || input.page < 1
    || !['asc', 'desc'].includes(input.order)) throw new Error('Invalid billing pagination');
  const pool = getPool();
  const { rows: latest } = await pool.query(
    'SELECT MAX(metrics_date) AS latest FROM user_day_metrics WHERE scope = $1 AND identifier = $2',
    [input.scope, input.identifier],
  );
  const latestDate = latest[0]?.latest;
  if (!latestDate && !input.membershipVersion) {
    return { available: false, reason: 'Import user metrics to sort the stored usage roster by billing.' };
  }
  const explicitUsageWindow = !!(input.usageSince || input.usageUntil);
  const end = input.usageUntil ?? (!explicitUsageWindow
    ? (latestDate ? new Date(latestDate).toISOString().slice(0, 10) : input.window.endDate) : undefined);
  const start = input.usageSince ?? (!explicitUsageWindow
    ? new Date(new Date(end!).getTime() - 27 * 86_400_000).toISOString().slice(0, 10) : undefined);
  const params: unknown[] = [];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
  const usageWhere = `scope = ${bind(input.scope)} AND identifier = ${bind(input.identifier)}
    ${start ? `AND metrics_date >= ${bind(start)}::date` : ''}
    ${end ? `AND metrics_date <= ${bind(end)}::date` : ''}`;
  const membership = input.membershipVersion ? bind(input.membershipVersion) : null;
  const billingWhere = `enterprise = ${bind(input.enterprise)}
    AND date BETWEEN ${bind(input.window.startDate)}::date AND ${bind(input.window.endDate)}::date
    ${input.scope === 'organization' ? `AND lower(organization) = lower(${bind(input.identifier)})` : ''}
    ${input.model ? `AND model = ${bind(input.model)}` : ''}
    ${input.sku ? `AND sku = ${bind(input.sku)}` : ''}`;
  const username = 'lower(btrim(username))';
  const aliases = Object.entries(input.aliases);
  const canonical = aliases.length
    ? `CASE ${username} ${aliases.map(([from, to]) => `WHEN ${bind(from)} THEN ${bind(to)}`).join(' ')} ELSE ${username} END`
    : username;
  // The usage roster matches /api/user-metrics' stored date semantics. A team
  // starts from its published membership so inactive members remain visible.
  const ctes = `WITH usage_roster AS (
    SELECT lower(btrim(user_login)) AS login,
      SUM(COALESCE((data->'totals_by_cli'->'token_usage'->>'prompt_tokens_sum')::numeric, 0)
        + COALESCE((data->'totals_by_cli'->'token_usage'->>'output_tokens_sum')::numeric, 0)) AS tokens
    FROM user_day_metrics WHERE ${usageWhere} GROUP BY lower(btrim(user_login))
  ), roster AS (
    ${membership
      ? `SELECT m.normalized_login AS login, COALESCE(u.tokens, 0) AS tokens
         FROM team_membership_rows m LEFT JOIN usage_roster u ON u.login = m.normalized_login WHERE m.version = ${membership}`
      : 'SELECT login, tokens FROM usage_roster'}
  ), billing AS (
    SELECT ${canonical} AS login,
      SUM(CASE WHEN gross_amount > 0 THEN quantity * (net_amount + discount_amount) / gross_amount ELSE quantity END) AS credits,
      SUM(gross_amount) AS gross_amount, SUM(net_amount) AS net_amount,
      COUNT(DISTINCT NULLIF(model, '')) AS models
    FROM billing_credit_usage WHERE ${billingWhere} AND btrim(username) <> ''
    GROUP BY ${canonical}
  )`;
  const { rows: counts } = await pool.query(`${ctes}
    SELECT count(*) AS total FROM roster
    UNION ALL SELECT count(*) AS total FROM billing`, params);
  if (!Number(counts[1]?.total)) {
    return { available: false, reason: 'Import billing for this scope and period to enable Credits, Gross, Net and Models sorting.' };
  }
  const { rows } = await pool.query(`${ctes}
    SELECT r.login, r.tokens, b.credits, b.gross_amount, b.net_amount, b.models
    FROM roster r LEFT JOIN billing b ON b.login = r.login
    ORDER BY ${SORT_COLUMNS[input.sort]} ${input.order.toUpperCase()} NULLS LAST, r.login ASC
    LIMIT ${bind(input.limit)} OFFSET ${bind((input.page - 1) * input.limit)}`, params);
  const { rows: topTokens } = await pool.query(`${ctes}
    SELECT login, tokens FROM roster ORDER BY tokens DESC, login ASC LIMIT 10`, params.slice(0, -2));
  const { rows: imports } = await pool.query(`SELECT MAX(completed_at) AS completed_at FROM billing_csv_sync_status
    WHERE enterprise = $1 AND status = 'completed' AND start_date <= $3::date AND end_date >= $2::date`,
  [input.enterprise, input.window.startDate, input.window.endDate]);
  const nullable = (value: unknown): number | null => value == null ? null : Number(value);
  return {
    available: true, total: Number(counts[0].total), window: input.window,
    topTokenUsers: topTokens.map(row => ({ user: row.login, tokens: Number(row.tokens) })),
    lastImportAt: imports[0]?.completed_at ? new Date(imports[0].completed_at).toISOString() : null,
    rows: rows.map(row => ({
      user: row.login, tokens: Number(row.tokens), credits: nullable(row.credits),
      grossAmount: nullable(row.gross_amount), netAmount: nullable(row.net_amount), models: nullable(row.models),
    })),
  };
}
