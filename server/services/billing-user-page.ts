import { createHash } from 'node:crypto';
import { getPool } from '../storage/db';
import { validateUsageWindow, type RosterScope } from '../storage/roster-foundation-storage';
import type { BillingUserAliases } from '../../shared/utils/billing-user-identity';
import type { BillingUserPage, BillingUserSort } from '../../shared/types/billing-user-page';

export class BillingPageUnavailable extends Error {
  constructor(public reason: string) { super(reason); }
}
export interface BillingUserPageInput {
  scope: RosterScope;
  identifier: string;
  enterprise: string;
  team?: string;
  githubOrg?: string;
  usageSince: string;
  usageUntil: string;
  billingSince: string;
  billingUntil: string;
  page: number;
  itemsPerPage: number;
  sortKey: BillingUserSort;
  sortOrder: 'asc' | 'desc';
  aliases: BillingUserAliases;
  filters?: { organization?: string; repository?: string; model?: string; sku?: string; product?: string };
  version?: string;
  now?: Date;
}
const columns: Record<BillingUserSort, string> = {
  user: '"user" COLLATE "C"', tokens: 'tokens', credits: 'credits',
  grossAmount: '"grossAmount"', netAmount: '"netAmount"', models: 'models',
};

/** Snapshot-only: no report download, roster array, live fan-out or inferred identity. */
export async function readBillingUserPage(input: BillingUserPageInput): Promise<BillingUserPage> {
  const days = validateUsageWindow(input.usageSince, input.usageUntil);
  validateUsageWindow(input.billingSince, input.billingUntil);
  if (!input.identifier.trim() || !input.enterprise.trim()
    || !['organization', 'enterprise'].includes(input.scope)
    || !Object.hasOwn(columns, input.sortKey) || !['asc', 'desc'].includes(input.sortOrder)
    || !Number.isSafeInteger(input.page) || input.page < 1
    || !Number.isSafeInteger(input.itemsPerPage) || input.itemsPerPage < 1 || input.itemsPerPage > 50
    || !Number.isSafeInteger((input.page - 1) * input.itemsPerPage)) throw new Error('Invalid billing page options');
  if (input.team?.toLowerCase().startsWith('reports-to:')) throw new BillingPageUnavailable('membership-unavailable');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '10s'");
    const coverage = await client.query<{ day: string; version: string }>(`
      SELECT to_char(p.metrics_date, 'YYYY-MM-DD') AS day, p.version
      FROM user_usage_publications p JOIN user_usage_snapshots s ON s.version = p.version
      WHERE p.scope = $1 AND p.identifier = $2 AND p.metrics_date BETWEEN $3::date AND $4::date
        AND s.state = 'complete' ORDER BY p.metrics_date`,
    [input.scope, input.identifier, input.usageSince, input.usageUntil]);
    if (coverage.rows.length !== days) throw new BillingPageUnavailable('roster-coverage-missing');
    let membership: string | null = null;
    if (input.team) {
      const { rows } = await client.query<{ version: string; fetched_at: Date }>(`
        SELECT s.version, s.fetched_at FROM team_membership_publications p
        JOIN team_membership_snapshots s ON s.version = p.version
        WHERE p.scope = $1 AND p.identifier = $2 AND p.team_kind = 'github'
          AND p.team_key = $3 AND p.github_org = $4 AND s.state = 'complete'`,
      [input.scope, input.identifier, input.team, input.scope === 'enterprise' ? input.githubOrg ?? '' : '']);
      if (!rows[0]) throw new BillingPageUnavailable('membership-unavailable');
      const age = (input.now ?? new Date()).getTime() - rows[0].fetched_at.getTime();
      if (age < 0 || age >= 86_400_000) throw new BillingPageUnavailable('membership-stale');
      membership = rows[0].version;
    }
    // Refuse an overlapping failed/in-flight replacement rather than certify its rows
    // using an older completed export header.
    const billing = await client.query<{ id: number; status: string; covers: boolean; completed_at: Date }>(`
      SELECT id, status, completed_at, start_date <= $2::date AND end_date >= $3::date AS covers
      FROM billing_csv_sync_status WHERE enterprise = $1 AND start_date <= $3::date AND end_date >= $2::date
      ORDER BY created_at DESC, id DESC LIMIT 1`, [input.enterprise, input.billingSince, input.billingUntil]);
    const job = billing.rows[0];
    if (!job || job.status !== 'completed' || !job.covers || !job.completed_at) {
      throw new BillingPageUnavailable('billing-coverage-missing');
    }
    const version = createHash('sha256').update(JSON.stringify([
      coverage.rows, membership, job.id, job.completed_at,
      input.scope, input.identifier, input.enterprise, input.team, input.usageSince, input.usageUntil,
      input.billingSince, input.billingUntil, input.filters ?? {}, Object.entries(input.aliases).sort(),
    ])).digest('hex');
    if (input.version && input.version !== version) throw new BillingPageUnavailable('dataset-changed');
    const organization = input.scope === 'organization' ? input.identifier : input.filters?.organization ?? null;
    if (input.scope === 'organization' && input.filters?.organization && input.filters.organization !== input.identifier) {
      throw new Error('Organization filter conflicts with scope');
    }
    const params = [
      JSON.stringify(coverage.rows), membership, input.enterprise, input.billingSince, input.billingUntil,
      JSON.stringify(input.aliases), organization, input.filters?.repository ?? null,
      input.filters?.model ?? null, input.filters?.sku ?? null, input.filters?.product ?? null,
      input.itemsPerPage, (input.page - 1) * input.itemsPerPage,
    ];
    const { rows } = await client.query<{ total: string; unknown: string; unsafe_tokens: boolean; rows: BillingUserPage['rows'] }>(`
      WITH usage AS (
        SELECT r.normalized_login AS login, SUM(r.prompt_tokens + r.output_tokens) AS tokens
        FROM jsonb_to_recordset($1::jsonb) AS p(day text, version uuid)
        JOIN user_usage_rows r ON r.version = p.version AND r.metrics_date = p.day::date
        GROUP BY r.normalized_login
      ), roster AS (
        SELECT login, tokens FROM usage WHERE $2::uuid IS NULL
        UNION ALL
        SELECT m.normalized_login, COALESCE(u.tokens, 0) FROM team_membership_rows m
        LEFT JOIN usage u ON u.login = m.normalized_login WHERE m.version = $2::uuid
      ), billing AS (
        SELECT COALESCE($6::jsonb ->> lower(btrim(b.username)), lower(btrim(b.username))) AS login,
          b.quantity, b.gross_amount, b.net_amount, b.model,
          ($8::text IS NULL OR b.repository = $8) AND ($9::text IS NULL OR b.model = $9)
            AND ($10::text IS NULL OR b.sku = $10) AND ($11::text IS NULL OR b.product = $11) AS included
        FROM billing_credit_usage b WHERE b.enterprise = $3 AND b.date BETWEEN $4::date AND $5::date
          AND ($7::text IS NULL OR b.organization = $7)
      ), source_status AS (
        SELECT EXISTS (
          SELECT 1 FROM billing b WHERE NOT EXISTS (SELECT 1 FROM usage u WHERE u.login = b.login)
            AND NOT EXISTS (SELECT 1 FROM team_membership_rows m WHERE m.version = $2::uuid AND m.normalized_login = b.login)
        ) AS unresolved
      ), amounts AS (
        SELECT r.login, MAX(r.tokens) AS tokens,
          COUNT(b.login) > 0 AND NOT (SELECT unresolved FROM source_status) AS known,
          COALESCE(SUM(b.quantity) FILTER (WHERE b.included), 0)::float8 AS credits,
          COALESCE(SUM(b.gross_amount) FILTER (WHERE b.included), 0)::float8 AS gross,
          COALESCE(SUM(b.net_amount) FILTER (WHERE b.included), 0)::float8 AS net,
          COUNT(DISTINCT NULLIF(b.model, '')) FILTER (WHERE b.included)::int AS models
        FROM roster r LEFT JOIN billing b ON b.login = r.login GROUP BY r.login
      ), compact AS (
        SELECT login AS "user", tokens::float8 AS tokens,
          CASE WHEN known THEN credits END AS credits, CASE WHEN known THEN gross END AS "grossAmount",
          CASE WHEN known THEN net END AS "netAmount", CASE WHEN known THEN models END AS models,
          CASE WHEN known THEN 'loaded' ELSE 'Unavailable' END AS "billingState" FROM amounts
      ), page AS (
        SELECT * FROM compact ORDER BY ${columns[input.sortKey]} ${input.sortOrder === 'desc' ? 'DESC' : 'ASC'} NULLS LAST,
          "user" COLLATE "C" ASC LIMIT $12 OFFSET $13
      )
      SELECT (SELECT count(*) FROM compact) AS total,
        (SELECT count(*) FROM amounts WHERE NOT known) AS unknown,
        COALESCE((SELECT bool_or(tokens > 9007199254740991) FROM amounts), false) AS unsafe_tokens,
        COALESCE((SELECT jsonb_agg(p) FROM page p), '[]'::jsonb) AS rows`, params);
    const result = rows[0]!;
    if (result.unsafe_tokens) throw new BillingPageUnavailable('token-precision-unavailable');
    const billingSortAvailable = Number(result.unknown) === 0;
    if (!billingSortAvailable && !['user', 'tokens'].includes(input.sortKey)) {
      throw new BillingPageUnavailable('billing-attribution-unavailable');
    }
    await client.query('COMMIT');
    return { rows: result.rows, total: Number(result.total), page: input.page, itemsPerPage: input.itemsPerPage, version, billingSortAvailable };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
