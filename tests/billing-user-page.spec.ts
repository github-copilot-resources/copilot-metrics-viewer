// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newDb, DataType } from 'pg-mem';
import { getStoredBillingUserPage } from '../server/services/billing-user-page';

const { poolHolder } = vi.hoisted(() => ({ poolHolder: { pool: null as unknown } }));
vi.mock('../server/storage/db', () => ({ getPool: () => poolHolder.pool }));

describe('stored billing user pages', () => {
  const input = {
    enterprise: 'synthetic-ent', scope: 'organization' as const, identifier: 'synthetic-org',
    window: { startDate: '2026-06-01', endDate: '2026-06-30', timePeriod: { year: 2026, month: 6 } },
    usageSince: '2026-06-01', usageUntil: '2026-06-30',
    page: 1, limit: 10, sort: 'netAmount', order: 'desc' as const, aliases: { 'old-zed': 'zed' },
  };
  beforeEach(async () => {
    const db = newDb();
    db.public.registerFunction({ name: 'btrim', args: [DataType.text], returns: DataType.text, implementation: (s: string) => s.trim() });
    db.public.registerFunction({ name: 'nullif', args: [DataType.text, DataType.text], returns: DataType.text, implementation: (a: string, b: string) => a === b ? null : a });
    poolHolder.pool = new (db.adapters.createPg().Pool)();
    await db.public.none(`
      CREATE TABLE user_day_metrics(scope text, identifier text, user_login text, metrics_date date, data jsonb);
      CREATE TABLE billing_credit_usage(enterprise text, date date, username text, organization text, model text,
        quantity numeric, gross_amount numeric, net_amount numeric, discount_amount numeric);
      CREATE TABLE billing_csv_sync_status(enterprise text, status text, start_date date, end_date date, completed_at timestamptz);
      CREATE TABLE team_membership_rows(version text, normalized_login text, login text);
      INSERT INTO billing_csv_sync_status VALUES ('synthetic-ent','completed','2026-06-01','2026-06-02','2026-07-01T10:00:00Z'),
        ('synthetic-ent','failed','2026-06-01','2026-06-30','2026-07-02T10:00:00Z');
    `);
    for (const login of ['alpha', 'zed', 'tie-a', 'tie-b', 'unknown', ...Array.from({ length: 10 }, (_, i) => `later-${i}`)]) {
      db.public.none(`INSERT INTO user_day_metrics VALUES ('organization','synthetic-org','${login}','2026-06-10','{}')`);
    }
    db.public.none(`INSERT INTO billing_credit_usage VALUES
      ('synthetic-ent','2026-06-10','alpha','synthetic-org','one',10,10,10,0),
      ('synthetic-ent','2026-06-10','zed','synthetic-org','one',8,8,8,0),
      ('synthetic-ent','2026-06-10','old-zed','synthetic-org','two',8,8,8,0),
      ('synthetic-ent','2026-06-10','tie-a','synthetic-org','one',5,5,5,0),
      ('synthetic-ent','2026-06-10','tie-b','synthetic-org','one',10,10,5,2),
      ('synthetic-ent','2026-07-10','alpha','synthetic-org','outside',999,999,999,0),
      ('synthetic-ent','2026-06-10','alpha','other-org','outside',999,999,999,0),
      ('other-ent','2026-06-10','alpha','synthetic-org','outside',999,999,999,0);
      INSERT INTO team_membership_rows VALUES ('permitted-team','alpha','alpha'), ('permitted-team','unknown','unknown');`);
    db.public.none(`UPDATE user_day_metrics SET data = '{"totals_by_cli":{"token_usage":{"prompt_tokens_sum":3,"output_tokens_sum":4}}}' WHERE user_login = 'zed';
      INSERT INTO user_day_metrics VALUES ('organization','synthetic-org','zed','2026-06-11','{"totals_by_cli":{"token_usage":{"prompt_tokens_sum":5,"output_tokens_sum":0}}}');`);
  });

  it('aggregates all aliases/models before global ordering and pagination, keeping missing rows unknown', async () => {
    const first = await getStoredBillingUserPage(input);
    expect(first.available).toBe(true);
    if (!first.available) return;
    expect(first.total).toBe(15);
    expect(first.rows.slice(0, 4).map(r => [r.user, r.netAmount])).toEqual([
      ['zed', 16], ['alpha', 10], ['tie-a', 5], ['tie-b', 5],
    ]);
    expect(first.rows[0]).toMatchObject({ credits: 16, models: 2 });
    expect(first.rows[3]).toMatchObject({ credits: 7 });
    expect(first.lastImportAt).toBe('2026-07-01T10:00:00.000Z');
    const second = await getStoredBillingUserPage({ ...input, page: 2 });
    expect(second.available && second.rows).toHaveLength(5);
    expect(second.available && second.rows.find(r => r.user === 'unknown')).toMatchObject({ netAmount: null, credits: null });
    const tokens = await getStoredBillingUserPage({ ...input, sort: 'tokens' });
    expect(tokens.available && tokens.rows[0]).toMatchObject({ user: 'zed', tokens: 12 });
  });

  it('restricts aggregates and counts to the published team, including members without usage or billing', async () => {
    const result = await getStoredBillingUserPage({ ...input, membershipVersion: 'permitted-team' });
    expect(result.available && result.total).toBe(2);
    expect(result.available && result.rows.map(r => r.user)).toEqual(['alpha', 'unknown']);
    expect(result.available && result.rows[1]).toMatchObject({ netAmount: null });
  });

  it('does not require daily usage coverage or a covering import job; disables sorting when selected storage is empty', async () => {
    expect((await getStoredBillingUserPage(input)).available).toBe(true);
    const unmatched = await getStoredBillingUserPage({
      ...input, aliases: { alpha: 'other-a', zed: 'other-z', 'old-zed': 'other-z', 'tie-a': 'other-c', 'tie-b': 'other-d' },
    });
    expect(unmatched.available).toBe(true);
    expect(unmatched.available && unmatched.rows.every(row => row.credits === null)).toBe(true);
    expect(await getStoredBillingUserPage({ ...input, window: { ...input.window, startDate: '2025-01-01', endDate: '2025-01-31' } })).toMatchObject({ available: false });
    await expect(getStoredBillingUserPage({ ...input, sort: 'netAmount; DROP TABLE users' })).rejects.toThrow('sort');
  });
});
