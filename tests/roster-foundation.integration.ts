// Owns an ephemeral, loopback-only PostgreSQL container. Never uses application credentials.
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, getPool, initSchema } from '../server/storage/db';

const mocks = vi.hoisted(() => {
  const fetch = vi.fn();
  vi.stubGlobal('$fetch', fetch);
  vi.stubGlobal('fetch', async (url: string, options: unknown) => {
    const body = await fetch(url, options);
    return body instanceof Response ? body : new Response(body);
  });
  return { fetch, links: vi.fn() };
});
vi.mock('../server/services/github-copilot-usage-api', async importOriginal => ({
  ...await importOriginal<typeof import('../server/services/github-copilot-usage-api')>(),
  requestUserDownloadLinks: mocks.links,
}));

let container = '';
const now = new Date('2026-11-15T12:00:00Z');
const key = { scope: 'organization', identifier: 'synthetic-org', teamKind: 'github', teamKey: 'synthetic-team', githubOrg: '' } as const;
const request = { scope: 'organization', identifier: 'synthetic-org' } as const;
const day = '2026-11-13';
const record = (login = 'Synthetic-User') => ({ day, user_login: login, user_id: 1, totals_by_cli: { token_usage: { prompt_tokens_sum: 20, output_tokens_sum: 3 } } });

beforeAll(async () => {
  container = execFileSync('docker', [
    'run', '--rm', '-d', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_USER=synthetic',
    '-e', 'POSTGRES_PASSWORD=synthetic-test-only', '-e', 'POSTGRES_DB=synthetic', 'postgres:16-alpine',
  ], { encoding: 'utf8' }).trim();
  const binding = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' }).trim();
  expect(binding).toMatch(/^127\.0\.0\.1:\d+$/);
  process.env.DATABASE_URL = `postgres://synthetic:synthetic-test-only@${binding}/synthetic`;
  for (let i = 0; i < 60; i++) {
    try { await getPool().query('SELECT 1'); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  await initSchema();
}, 30_000);

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.links.mockReset();
});
afterAll(async () => {
  vi.restoreAllMocks();
  await closePool();
  delete process.env.DATABASE_URL;
  if (container) execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
});

describe('authoritative publication in isolated PostgreSQL', () => {
  it('additively initializes existing and fresh schemas without certifying legacy user rows', async () => {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT to_regclass('team_membership_snapshots') AS membership,
      to_regclass('user_usage_snapshots') AS usage`);
    expect(rows[0]).toEqual({ membership: 'team_membership_snapshots', usage: 'user_usage_snapshots' });
    await pool.query(`INSERT INTO user_day_metrics (scope, identifier, user_login, metrics_date, data)
      VALUES ('organization', 'legacy', 'synthetic', $1, '{}')`, [day]);
    await pool.query(`DROP TABLE team_membership_publications, team_membership_rows, team_membership_snapshots,
      user_usage_publications, user_usage_parts, user_usage_rows, user_usage_snapshots`);
    await initSchema();
    await initSchema();
    const storage = await import('../server/storage/roster-foundation-storage');
    expect(await storage.getUsageCoverage('organization', 'legacy', day, day)).toEqual({ available: false, reason: 'roster-coverage-missing' });
    await pool.query('CREATE SCHEMA fresh_foundation');
    const client = await pool.connect();
    const connect = vi.spyOn(pool, 'query').mockImplementation(client.query.bind(client));
    try {
      await client.query('SET search_path = fresh_foundation');
      await initSchema();
      const fresh = await client.query(`SELECT count(*)::int AS count FROM team_membership_snapshots`);
      expect(fresh.rows[0].count).toBe(0);
    } finally {
      connect.mockRestore();
      await client.query('SET search_path = public');
      client.release();
    }
  });

  it('streams 601+ memberships in 100-row batches, publishes once, and reads only bounded normalized rows', async () => {
    const storage = await import('../server/storage/roster-foundation-storage');
    const { syncTeamMembership } = await import('../server/services/roster-foundation-sync');
    let requests = 0;
    let stagedBeforeNextFetch = 0;
    mocks.fetch.mockImplementation(async (_url, options) => {
      requests++;
      const staged = await getPool().query('SELECT count(*)::int AS count FROM team_membership_rows');
      stagedBeforeNextFetch = Math.max(stagedBeforeNextFetch, staged.rows[0].count);
      expect(await storage.getMembershipSnapshot(key, now)).toEqual({ available: false, reason: 'membership-unavailable' });
      const offset = (options.params.page - 1) * 100;
      return Array.from({ length: Math.min(100, 602 - offset) }, (_, i) => ({
        login: offset + i === 601 ? 'SYNTHETIC-0000' : `Synthetic-${String(offset + i).padStart(4, '0')}`,
        id: offset + i === 601 ? 1 : offset + i + 1,
      }));
    });
    const completion = new Date(now.getTime() + 60_000);
    const result = await syncTeamMembership(key, new Headers(), () => completion);
    expect(result.available).toBe(true);
    expect(requests).toBe(7);
    expect(stagedBeforeNextFetch).toBe(600);
    const metadata = await storage.getMembershipSnapshot(key, completion);
    expect(metadata).toMatchObject({ available: true, memberCount: 601, fetchedAt: completion.toISOString() });
    let after: string | undefined;
    let seen = 0;
    do {
      const page = await storage.getMembershipPage(key, completion, { limit: 25, after });
      expect(page.available).toBe(true);
      if (!page.available) throw new Error('missing published membership');
      expect(page.rows.length).toBeLessThanOrEqual(25);
      expect(page.rows.every(r => Object.keys(r).sort().join(',') === 'login,userId')).toBe(true);
      seen += page.rows.length;
      after = page.next;
    } while (after);
    expect(seen).toBe(601);
    expect(mocks.fetch).toHaveBeenCalledTimes(7);
    for (const other of [
      { ...key, identifier: 'another-org' }, { ...key, teamKey: 'other-team' },
      { ...key, scope: 'enterprise' as const }, { ...key, githubOrg: 'different-org' },
    ]) expect((await storage.getMembershipSnapshot(other, completion)).available).toBe(false);
  });

  it('isolates published organizations, enterprises, teams and enterprise organization namespaces', async () => {
    const storage = await import('../server/storage/roster-foundation-storage');
    const others = [
      { ...key, identifier: 'another-org' }, { ...key, teamKey: 'other-team' },
      { ...key, scope: 'enterprise' as const }, { ...key, githubOrg: 'different-org' },
    ];
    for (const [index, other] of others.entries()) {
      const version = await storage.beginMembershipSnapshot(other);
      await storage.stageMembershipBatch(version, [{ login: `synthetic-isolated-${index}`, userId: 900 + index }]);
      await storage.publishMembershipSnapshot(version, now, now);
      expect(await storage.getMembershipPage(other, now, { limit: 25 })).toMatchObject({
        version, rows: [{ login: `synthetic-isolated-${index}`, userId: String(900 + index) }],
      });
    }
    expect(await storage.getMembershipSnapshot(key, now)).toMatchObject({ memberCount: 601 });
  });

  it('keeps old publication on fetch/store failure and expires exactly at 24h, not on retry', async () => {
    const storage = await import('../server/storage/roster-foundation-storage');
    const { syncTeamMembership } = await import('../server/services/roster-foundation-sync');
    const original = await storage.getMembershipSnapshot(key, now);
    mocks.fetch.mockRejectedValue(new Error('synthetic fetch failure'));
    const neverPublished = { ...key, teamKey: 'synthetic-never-published' };
    await expect(syncTeamMembership(neverPublished, new Headers(), () => now)).rejects.toThrow('synthetic fetch failure');
    expect(await storage.getMembershipSnapshot(neverPublished, now)).toEqual({ available: false, reason: 'membership-unavailable' });
    await expect(syncTeamMembership(key, new Headers(), () => now)).rejects.toThrow('synthetic fetch failure');
    expect(await storage.getMembershipSnapshot(key, now)).toEqual(original);
    const trigger = `CREATE FUNCTION reject_synthetic_membership() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic membership store failure'; END $$;
      CREATE TRIGGER reject_member BEFORE INSERT ON team_membership_rows FOR EACH ROW EXECUTE FUNCTION reject_synthetic_membership()`;
    await getPool().query(trigger);
    mocks.fetch.mockResolvedValue([{ login: 'synthetic-next', id: 2 }]);
    try { await expect(syncTeamMembership(key, new Headers(), () => now)).rejects.toThrow('synthetic membership store failure'); }
    finally { await getPool().query('DROP TRIGGER reject_member ON team_membership_rows; DROP FUNCTION reject_synthetic_membership()'); }
    expect(await storage.getMembershipSnapshot(key, now)).toEqual(original);
    if (!original.available) throw new Error('missing old snapshot');
    const fetched = Date.parse(original.fetchedAt);
    expect((await storage.getMembershipSnapshot(key, new Date(fetched + 86_400_000 - 1))).available).toBe(true);
    expect(await storage.getMembershipSnapshot(key, new Date(fetched + 86_400_000))).toEqual({ available: false, reason: 'membership-stale' });
    expect(await storage.getMembershipPage(key, new Date(fetched + 86_400_000), { limit: 25 })).toEqual({ available: false, reason: 'membership-stale' });
  });

  it('does not replace a newer snapshot with a late older writer; empty and virtual sources stay distinct', async () => {
    const storage = await import('../server/storage/roster-foundation-storage');
    const { syncTeamMembership } = await import('../server/services/roster-foundation-sync');
    mocks.fetch.mockResolvedValue([]);
    const emptyKey = { ...key, teamKey: 'synthetic-empty' };
    await syncTeamMembership(emptyKey, new Headers(), () => now);
    expect(await storage.getMembershipPage(emptyKey, now, { limit: 50 })).toMatchObject({ available: true, memberCount: 0, rows: [] });
    const earlier = await storage.beginMembershipSnapshot(emptyKey);
    await storage.stageMembershipBatch(earlier, [{ login: 'late-old', userId: 7 }]);
    await storage.publishMembershipSnapshot(earlier, new Date(now.getTime() - 1), now);
    expect(await storage.getMembershipSnapshot(emptyKey, now)).toMatchObject({ memberCount: 0 });
    mocks.fetch.mockClear();
    const virtual = { ...key, teamKind: 'reports-to' as const, teamKey: 'reports-to:synthetic-manager', reportToLogins: ['synthetic-unverified-outsider'] };
    expect(await syncTeamMembership(virtual, new Headers(), () => now)).toEqual({ available: false, reason: 'membership-unavailable' });
    expect(await storage.getMembershipPage(virtual, now, { limit: 25 })).toEqual({ available: false, reason: 'membership-unavailable' });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('rolls back membership pointer and completion together when COMMIT fails', async () => {
    const storage = await import('../server/storage/roster-foundation-storage');
    const { syncTeamMembership } = await import('../server/services/roster-foundation-sync');
    const old = await storage.getMembershipSnapshot(key, now);
    mocks.fetch.mockResolvedValue([{ user: { login: 'synthetic-inactive', id: 8 } }]);
    await getPool().query(`CREATE FUNCTION reject_synthetic_membership_commit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic membership commit failure'; END $$;
      CREATE CONSTRAINT TRIGGER reject_member_commit AFTER INSERT OR UPDATE ON team_membership_publications
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_synthetic_membership_commit()`);
    try { await expect(syncTeamMembership(key, new Headers(), () => new Date(now.getTime() + 120_000))).rejects.toThrow('synthetic membership commit failure'); }
    finally { await getPool().query('DROP TRIGGER reject_member_commit ON team_membership_publications; DROP FUNCTION reject_synthetic_membership_commit()'); }
    expect(await storage.getMembershipSnapshot(key, now)).toEqual(old);
    const { rows } = await getPool().query(`SELECT count(*)::int AS count FROM team_membership_snapshots WHERE state = 'staging'`);
    expect(rows[0].count).toBe(0);
  });

  it('stores NDJSON incrementally in at most 1000-row batches and rejects later malformed rows without publication', async () => {
    const { syncUserUsage } = await import('../server/services/roster-foundation-sync');
    const storage = await import('../server/storage/roster-foundation-storage');
    mocks.links.mockResolvedValue({ download_links: ['synthetic:stream'], report_day: day });
    const identifier = 'synthetic-stream';
    const payload = Array.from({ length: 2001 }, (_, index) => JSON.stringify(record(`synthetic-stream-${index}`))).join('\n');
    mocks.fetch.mockResolvedValue(payload);
    await syncUserUsage({ ...request, identifier }, new Headers(), day, () => now);
    const { rows } = await getPool().query(`SELECT count(*)::int AS count FROM user_usage_rows r
      JOIN user_usage_publications p ON p.version = r.version AND p.metrics_date = r.metrics_date
      WHERE p.identifier = $1`, [identifier]);
    expect(rows[0].count).toBe(2001);
    mocks.fetch.mockResolvedValue(`${payload}\n{"unexpected":"format"}`);
    await expect(syncUserUsage({ ...request, identifier: 'synthetic-malformed' }, new Headers(), day, () => now)).rejects.toThrow('raw per-day');
    expect((await storage.getUsageCoverage(request.scope, 'synthetic-malformed', day, day)).available).toBe(false);
    expect((await getPool().query(`SELECT count(*)::int AS count FROM user_usage_rows r
      JOIN user_usage_snapshots s ON s.version = r.version WHERE s.identifier = 'synthetic-malformed'`)).rows[0].count).toBe(2000);
  });

  it('publishes all report parts only after storage succeeds, including verified empty days and immutable history', async () => {
    const { syncUserUsage } = await import('../server/services/roster-foundation-sync');
    const storage = await import('../server/storage/roster-foundation-storage');
    mocks.links.mockResolvedValue({ download_links: ['synthetic:part-1', 'synthetic:part-2'], report_start_day: day, report_end_day: '2026-11-14' });
    mocks.fetch.mockImplementation(async url => {
      expect(await storage.getUsageCoverage(request.scope, request.identifier, day, '2026-11-14')).toEqual({ available: false, reason: 'roster-coverage-missing' });
      return url === 'synthetic:part-1' ? JSON.stringify(record()) : '';
    });

    await syncUserUsage(request, new Headers(), undefined, () => now);
    const complete = await storage.getUsageCoverage(request.scope, request.identifier, day, '2026-11-14');
    expect(complete).toMatchObject({ available: true, since: day, until: '2026-11-14' });
    const { rows } = await getPool().query(`SELECT normalized_login, prompt_tokens::text, output_tokens::text
      FROM user_usage_rows r JOIN user_usage_publications p ON p.version = r.version AND p.metrics_date = r.metrics_date
      WHERE p.scope = $1 AND p.identifier = $2`, [request.scope, request.identifier]);
    expect(rows).toEqual([{ normalized_login: 'synthetic-user', prompt_tokens: '20', output_tokens: '3' }]);
    expect((await storage.getUsageCoverage('enterprise', request.identifier, day, day)).available).toBe(false);
    expect((await storage.getUsageCoverage(request.scope, 'different', day, day)).available).toBe(false);
    expect((await storage.getUsageCoverage(request.scope, request.identifier, day, '2026-11-15')).available).toBe(false);
    // Historical coverage has no membership-style TTL.
    expect(await storage.getUsageCoverage(request.scope, request.identifier, day, '2026-11-14')).toEqual(complete);
    mocks.fetch.mockRejectedValue(new Error('synthetic retry failure'));
    await expect(syncUserUsage(request, new Headers(), undefined, () => new Date('2027-01-01'))).rejects.toThrow('synthetic retry failure');
    expect(await storage.getUsageCoverage(request.scope, request.identifier, day, '2026-11-14')).toEqual(complete);
  });

  it('does not publish an interrupted body stream or an oversized line', async () => {
    const { syncUserUsage } = await import('../server/services/roster-foundation-sync');
    const storage = await import('../server/storage/roster-foundation-storage');
    mocks.links.mockResolvedValue({ download_links: ['synthetic:stream'], report_day: day });
    const chunk = new TextEncoder().encode(Array.from({ length: 1000 }, (_, i) => JSON.stringify(record(`synthetic-interrupted-${i}`))).join('\n') + '\n');
    let sent = false;
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream({
      pull(controller) {
        if (!sent) { sent = true; controller.enqueue(chunk); }
        else controller.error(new Error('synthetic stream disconnected'));
      },
    })));
    await expect(syncUserUsage({ ...request, identifier: 'synthetic-interrupted' }, new Headers(), day, () => now)).rejects.toThrow('synthetic stream disconnected');
    expect((await storage.getUsageCoverage(request.scope, 'synthetic-interrupted', day, day)).available).toBe(false);
    mocks.fetch.mockResolvedValue('x'.repeat(1024 * 1024 + 1));
    await expect(syncUserUsage({ ...request, identifier: 'synthetic-oversized' }, new Headers(), day, () => now)).rejects.toThrow('exceeds 1 MiB');
    expect((await storage.getUsageCoverage(request.scope, 'synthetic-oversized', day, day)).available).toBe(false);
  });

  it('refuses incomplete direct publication and pins fully stored versions through overlapping reports', async () => {
    const storage = await import('../server/storage/roster-foundation-storage');
    const identifier = 'synthetic-overlap';
    const version = await storage.beginUsageSnapshot(request.scope, identifier, day, '2026-11-14', 2);
    await storage.stageUsageBatch(version, [record() as import('../server/services/github-copilot-usage-api').UserDayRecord]);
    await storage.completeUsagePart(version, 0);
    await expect(storage.publishUsageSnapshot(version, now, now)).rejects.toThrow('not completely stored');
    expect((await storage.getUsageCoverage(request.scope, identifier, day, day)).available).toBe(false);
    await storage.completeUsagePart(version, 1);
    await storage.publishUsageSnapshot(version, now, now);
    await expect(storage.stageUsageBatch(version, [record() as import('../server/services/github-copilot-usage-api').UserDayRecord])).rejects.toThrow('not staging');
    const lateOlder = await storage.beginUsageSnapshot(request.scope, identifier, '2026-11-14', '2026-11-14', 1);
    const newer = await storage.beginUsageSnapshot(request.scope, identifier, '2026-11-14', '2026-11-14', 1);
    await storage.completeUsagePart(newer, 0);
    await storage.publishUsageSnapshot(newer, now, now);
    await storage.completeUsagePart(lateOlder, 0);
    await storage.publishUsageSnapshot(lateOlder, now, now);
    expect(await storage.getUsageCoverage(request.scope, identifier, day, '2026-11-14')).toMatchObject({
      available: true, days: [{ day, version }, { day: '2026-11-14', version: newer }],
    });
  });

  it.each(['fetch', 'legacy-store', 'staging-store', 'publication', 'commit'])('does not publish partial/failed %s attempts, and a fresh retry is idempotent', async failure => {
    const { syncUserUsage } = await import('../server/services/roster-foundation-sync');
    const storage = await import('../server/storage/roster-foundation-storage');
    const identifier = `synthetic-failure-${failure}`;
    mocks.links.mockResolvedValue({ download_links: ['synthetic:first', 'synthetic:last'], report_day: day });
    mocks.fetch.mockImplementation(async url => {
      if (failure === 'fetch' && url === 'synthetic:last') throw new Error('synthetic part failure');
      return JSON.stringify(record());
    });
    const table = failure === 'legacy-store' ? 'user_day_metrics' : failure === 'staging-store' ? 'user_usage_rows'
      : ['publication', 'commit'].includes(failure) ? 'user_usage_publications' : '';
    if (table) await getPool().query(`CREATE FUNCTION reject_synthetic_usage() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic store failure'; END $$;
      CREATE ${failure === 'commit' ? 'CONSTRAINT' : ''} TRIGGER reject_usage
      ${failure === 'commit' ? 'AFTER' : 'BEFORE'} INSERT ON ${table}
      ${failure === 'commit' ? 'DEFERRABLE INITIALLY DEFERRED' : ''}
      FOR EACH ROW EXECUTE FUNCTION reject_synthetic_usage()`);
    try {
      await expect(syncUserUsage({ ...request, identifier }, new Headers(), day, () => now)).rejects.toThrow(/synthetic/);
    } finally {
      if (table) await getPool().query(`DROP TRIGGER reject_usage ON ${table}; DROP FUNCTION reject_synthetic_usage()`);
    }
    expect(await storage.getUsageCoverage(request.scope, identifier, day, day)).toEqual({ available: false, reason: 'roster-coverage-missing' });
    mocks.fetch.mockResolvedValue('[]');
    await syncUserUsage({ ...request, identifier }, new Headers(), day, () => now);
    await syncUserUsage({ ...request, identifier }, new Headers(), day, () => now);
    expect(await storage.getUsageCoverage(request.scope, identifier, day, day)).toMatchObject({ available: true });
    const { rows } = await getPool().query(`SELECT count(*)::int AS count FROM user_usage_publications WHERE scope = $1 AND identifier = $2`, [request.scope, identifier]);
    expect(rows[0].count).toBe(1);
  });
});
