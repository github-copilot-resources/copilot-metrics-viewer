import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { UserDayRecord } from '../services/github-copilot-usage-api';
import { getPool } from './db';

export type RosterScope = 'organization' | 'enterprise';
export interface MembershipKey {
  scope: RosterScope;
  identifier: string;
  teamKind: 'github' | 'reports-to';
  teamKey: string;
  /** Enterprise scopes can use an organization team; its namespace is significant. */
  githubOrg?: string;
}
export interface CompactMember { login: string; userId: string | number | null }
export type MembershipUnavailable = { available: false; reason: 'membership-unavailable' | 'membership-stale' };
export interface MembershipSnapshot {
  available: true;
  version: string;
  fetchedAt: string;
  completedAt: string;
  memberCount: number;
  source: 'github';
}
export type MembershipResult = MembershipSnapshot | MembershipUnavailable;
export interface UsageCoverage {
  available: true;
  scope: RosterScope;
  identifier: string;
  since: string;
  until: string;
  days: Array<{ day: string; version: string }>;
}

function scopeKey(scope: RosterScope, identifier: string): void {
  if (!['organization', 'enterprise'].includes(scope) || !identifier.trim()) throw new Error('Invalid roster scope');
}
function membershipValues(key: MembershipKey): string[] {
  scopeKey(key.scope, key.identifier);
  if (!key.teamKey.trim()) throw new Error('Missing team key');
  return [key.scope, key.identifier, key.teamKind, key.teamKey, key.githubOrg ?? ''];
}
export function validateUsageWindow(since: string, until: string): number {
  const valid = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day)
    && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
  if (!valid(since) || !valid(until)) throw new Error('Invalid usage date');
  const days = (Date.parse(until) - Date.parse(since)) / 86_400_000 + 1;
  if (days < 1 || days > 366) throw new Error('Usage window must contain 1..366 days');
  return days;
}
async function transaction(work: (client: pg.PoolClient) => Promise<void>): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await work(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function beginMembershipSnapshot(key: MembershipKey): Promise<string> {
  const values = membershipValues(key);
  if (key.teamKind !== 'github' || key.teamKey.startsWith('reports-to:')) throw new Error('membership-unavailable');
  const version = randomUUID();
  await getPool().query(`INSERT INTO team_membership_snapshots
    (version, scope, identifier, team_kind, team_key, github_org) VALUES ($1,$2,$3,$4,$5,$6)`, [version, ...values]);
  return version;
}
export async function stageMembershipBatch(version: string, members: CompactMember[]): Promise<void> {
  if (members.length > 100) throw new Error('Membership batch exceeds 100');
  if (!members.length) return;
  const unique = new Map(members.map(member => [member.login.trim().toLowerCase(), member]));
  if (unique.has('')) throw new Error('Invalid member login');
  const values: unknown[] = [version];
  const tuples = [...unique].map(([login, member], i) => {
    values.push(login, member.userId);
    return `($1::uuid, $${i * 2 + 2}::text, $${i * 2 + 3}::bigint)`;
  });
  await transaction(async client => {
    const header = await client.query(`SELECT version FROM team_membership_snapshots WHERE version = $1 AND state = 'staging' FOR UPDATE`, [version]);
    if (!header.rowCount) throw new Error('Membership version is not staging');
    await client.query(`INSERT INTO team_membership_rows (version, normalized_login, user_id)
      VALUES ${tuples.join(',')} ON CONFLICT (version, normalized_login) DO UPDATE SET user_id = EXCLUDED.user_id`, values);
  });
}
export async function publishMembershipSnapshot(version: string, fetchedAt: Date, completedAt: Date): Promise<void> {
  await transaction(async client => {
    const result = await client.query(`UPDATE team_membership_snapshots
      SET state = 'complete', fetched_at = $2, completed_at = $3
      WHERE version = $1 AND state = 'staging' RETURNING version`, [version, fetchedAt, completedAt]);
    if (!result.rowCount) throw new Error('Membership version is not staging');
    await client.query(`INSERT INTO team_membership_publications AS current
      (scope, identifier, team_kind, team_key, github_org, version)
      SELECT scope, identifier, team_kind, team_key, github_org, version FROM team_membership_snapshots WHERE version = $1
      ON CONFLICT (scope, identifier, team_kind, team_key, github_org) DO UPDATE SET version = EXCLUDED.version
      WHERE (SELECT fetched_at FROM team_membership_snapshots WHERE version = current.version)
        <= (SELECT fetched_at FROM team_membership_snapshots WHERE version = EXCLUDED.version)`, [version]);
  });
}
export async function failMembershipSnapshot(version: string): Promise<void> {
  await getPool().query(`UPDATE team_membership_snapshots SET state = 'failed' WHERE version = $1 AND state = 'staging'`, [version]);
}
export async function getMembershipSnapshot(key: MembershipKey, now: Date): Promise<MembershipResult> {
  const values = membershipValues(key);
  if (key.teamKind !== 'github' || key.teamKey.startsWith('reports-to:')) return { available: false, reason: 'membership-unavailable' };
  const { rows } = await getPool().query<{
    version: string; fetched_at: Date; completed_at: Date; member_count: string;
  }>(`SELECT s.version, s.fetched_at, s.completed_at,
      (SELECT count(*) FROM team_membership_rows r WHERE r.version = s.version) AS member_count
    FROM team_membership_publications p JOIN team_membership_snapshots s ON s.version = p.version
    WHERE p.scope = $1 AND p.identifier = $2 AND p.team_kind = $3 AND p.team_key = $4 AND p.github_org = $5
      AND s.state = 'complete'`, values);
  const row = rows[0];
  if (!row) return { available: false, reason: 'membership-unavailable' };
  if (now.getTime() - row.fetched_at.getTime() >= 86_400_000) return { available: false, reason: 'membership-stale' };
  return {
    available: true, version: row.version, fetchedAt: row.fetched_at.toISOString(),
    completedAt: row.completed_at.toISOString(), memberCount: Number(row.member_count), source: 'github',
  };
}
export async function getMembershipPage(
  key: MembershipKey, now: Date, options: { limit: number; after?: string },
): Promise<MembershipUnavailable | (MembershipSnapshot & { rows: CompactMember[]; next?: string })> {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100) throw new Error('Membership page limit must be 1..100');
  const snapshot = await getMembershipSnapshot(key, now);
  if (!snapshot.available) return snapshot;
  const { rows } = await getPool().query<{ login: string; userId: string | null }>(`SELECT normalized_login AS login, user_id AS "userId"
    FROM team_membership_rows WHERE version = $1 AND ($2::text IS NULL OR normalized_login COLLATE "C" > $2 COLLATE "C")
    ORDER BY normalized_login COLLATE "C" LIMIT $3`, [snapshot.version, options.after ?? null, options.limit]);
  return { ...snapshot, rows, next: rows.length === options.limit ? rows.at(-1)?.login : undefined };
}

export async function beginUsageSnapshot(scope: RosterScope, identifier: string, since: string, until: string, expectedParts: number): Promise<string> {
  scopeKey(scope, identifier);
  validateUsageWindow(since, until);
  if (!Number.isSafeInteger(expectedParts) || expectedParts < 1) throw new Error('Missing report parts');
  const version = randomUUID();
  await getPool().query(`INSERT INTO user_usage_snapshots (version, scope, identifier, since, until, expected_parts)
    VALUES ($1,$2,$3,$4,$5,$6)`, [version, scope, identifier, since, until, expectedParts]);
  return version;
}
export async function stageUsageBatch(version: string, records: UserDayRecord[]): Promise<void> {
  if (records.length > 1000) throw new Error('Usage batch exceeds 1000');
  if (!records.length) return;
  const unique = new Map(records.map(row => [`${row.day}:${row.user_login.trim().toLowerCase()}`, row]));
  const values: unknown[] = [version];
  const tuples = [...unique.values()].map((record, i) => {
    values.push(record.day, record.user_login.trim().toLowerCase(), record.user_id ?? null,
      record.totals_by_cli?.token_usage?.prompt_tokens_sum ?? 0, record.totals_by_cli?.token_usage?.output_tokens_sum ?? 0);
    return `($1::uuid,$${i * 5 + 2}::date,$${i * 5 + 3}::text,$${i * 5 + 4}::bigint,$${i * 5 + 5}::numeric,$${i * 5 + 6}::numeric)`;
  });
  await transaction(async client => {
    const header = await client.query(`SELECT version FROM user_usage_snapshots WHERE version = $1 AND state = 'staging' FOR UPDATE`, [version]);
    if (!header.rowCount) throw new Error('Usage version is not staging');
    await client.query(`INSERT INTO user_usage_rows (version, metrics_date, normalized_login, user_id, prompt_tokens, output_tokens)
      VALUES ${tuples.join(',')} ON CONFLICT (version, metrics_date, normalized_login)
      DO UPDATE SET user_id = EXCLUDED.user_id, prompt_tokens = EXCLUDED.prompt_tokens, output_tokens = EXCLUDED.output_tokens`, values);
  });
}
export async function completeUsagePart(version: string, part: number): Promise<void> {
  const { rowCount } = await getPool().query(`INSERT INTO user_usage_parts (version, part_index)
    SELECT version, $2 FROM user_usage_snapshots WHERE version = $1 AND state = 'staging' AND $2 >= 0 AND $2 < expected_parts
    ON CONFLICT DO NOTHING`, [version, part]);
  if (!rowCount) throw new Error('Invalid or already completed usage part');
}
export async function publishUsageSnapshot(version: string, fetchedAt: Date, completedAt: Date): Promise<void> {
  await transaction(async client => {
    const result = await client.query(`UPDATE user_usage_snapshots s
      SET state = 'complete', fetched_at = $2, completed_at = $3
      WHERE version = $1 AND state = 'staging'
        AND expected_parts = (SELECT count(*) FROM user_usage_parts p WHERE p.version = s.version)
        AND NOT EXISTS (SELECT 1 FROM user_usage_rows r WHERE r.version = s.version AND r.metrics_date NOT BETWEEN s.since AND s.until)
      RETURNING version`, [version, fetchedAt, completedAt]);
    if (!result.rowCount) throw new Error('Usage report is not completely stored');
    await client.query(`INSERT INTO user_usage_publications AS current (scope, identifier, metrics_date, version)
      SELECT s.scope, s.identifier, d::date, s.version FROM user_usage_snapshots s,
        LATERAL generate_series(s.since, s.until, interval '1 day') d WHERE s.version = $1
      ORDER BY d
      ON CONFLICT (scope, identifier, metrics_date) DO UPDATE SET version = EXCLUDED.version
      WHERE (SELECT started_at FROM user_usage_snapshots WHERE version = current.version)
        <= (SELECT started_at FROM user_usage_snapshots WHERE version = EXCLUDED.version)`, [version]);
  });
}
export async function failUsageSnapshot(version: string): Promise<void> {
  await getPool().query(`UPDATE user_usage_snapshots SET state = 'failed' WHERE version = $1 AND state = 'staging'`, [version]);
}
export async function getUsageCoverage(
  scope: RosterScope, identifier: string, since: string, until: string,
): Promise<UsageCoverage | { available: false; reason: 'roster-coverage-missing' }> {
  scopeKey(scope, identifier);
  const count = validateUsageWindow(since, until);
  const { rows } = await getPool().query<{ day: string; version: string }>(`SELECT to_char(p.metrics_date, 'YYYY-MM-DD') AS day, p.version
    FROM user_usage_publications p JOIN user_usage_snapshots s ON s.version = p.version
    WHERE p.scope = $1 AND p.identifier = $2 AND p.metrics_date BETWEEN $3 AND $4 AND s.state = 'complete'
    ORDER BY p.metrics_date`, [scope, identifier, since, until]);
  if (rows.length !== count) return { available: false, reason: 'roster-coverage-missing' };
  return { available: true, scope, identifier, since, until, days: rows };
}
