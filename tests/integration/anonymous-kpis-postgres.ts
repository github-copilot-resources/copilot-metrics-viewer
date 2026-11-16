/**
 * Explicit integration runner (not part of the default unit suite):
 * DATABASE_URL=<isolated database> node --import tsx --test tests/integration/anonymous-kpis-postgres.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createError, defineEventHandler, getHeader, getQuery, setHeader, toNodeListener } from 'h3';
import { initSchema, closePool, getPool } from '../../server/storage/db';
import { saveUserDayMetricsBatch } from '../../server/storage/user-day-metrics-storage';
import { saveSeats } from '../../server/storage/seats-storage';
import type { UserDayRecord, UserTotals } from '../../server/services/github-copilot-usage-api';
import { Seat } from '../../app/model/Seat';

test('isolated PostgreSQL route: date, identifier, scope, team and real session/self boundaries', async context => {
  assert.ok(process.env.DATABASE_URL, 'An explicitly isolated DATABASE_URL is required');
  const database = new URL(process.env.DATABASE_URL);
  assert.equal(database.hostname, '127.0.0.1');
  assert.equal(database.pathname, '/issue464');
  context.after(closePool);
  Object.assign(globalThis, {
    defineEventHandler, getQuery, createError, setHeader,
    useRuntimeConfig: () => ({ public: { requireAuth: true }, usageAdmins: 'synthetic-admin' }),
    getUserSession: async (event: Parameters<typeof getHeader>[0]) => ({
      user: getHeader(event, 'x-test-login') ? { login: getHeader(event, 'x-test-login') } : undefined,
      secure: { tokens: { access_token: 'synthetic-only' } },
    }),
    $fetch: Object.assign(async (url: string) => {
      assert.match(url, /\/orgs\/synthetic-org\/teams\/synthetic-team\/members$/);
      return [{ login: 'synthetic-self', id: 1 }, { login: 'synthetic-inactive', id: 3 }];
    }, { raw: async () => ({ status: 200, _data: { role: 'member', state: 'active' } }) }),
  });
  const record = (user: number, day: string, generated: number, accepted: number): UserDayRecord => ({
    report_start_day: day, report_end_day: day, day, user_id: user,
    user_login: user === 1 ? 'synthetic-self' : 'synthetic-other',
    organization_id: 'synthetic-org', enterprise_id: 'synthetic-ent',
    user_initiated_interaction_count: 1, code_generation_activity_count: generated,
    code_acceptance_activity_count: accepted,
    loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0,
  });
  await initSchema();
  await getPool().query('TRUNCATE user_day_metrics, seats');
  await saveUserDayMetricsBatch('organization', 'synthetic-org', [
    ...Array.from({ length: 9 }, (_, i) => record(1, `2026-01-0${i + 1}`, 1, 1)),
    record(2, '2026-01-01', 91, 9), record(2, '2026-02-01', 999, 999),
  ]);
  await saveUserDayMetricsBatch('organization', 'synthetic-other-org', [record(2, '2026-01-01', 777, 777)]);
  await saveUserDayMetricsBatch('enterprise', 'synthetic-org', [record(2, '2026-01-01', 888, 888)]);
  const seats: [Seat, Seat] = [new Seat({ assignee: { id: 1, login: 'synthetic-self' }, last_activity_at: null }),
    new Seat({ assignee: { id: 2, login: 'synthetic-other' }, last_activity_at: '2000-01-01T00:00:00Z' })];
  await saveSeats('organization', 'synthetic-org', '2026-01-09', [...seats, seats[0]]);
  await saveSeats('organization', 'synthetic-other-org', '2026-01-09', [seats[1]]);
  const app = createApp();
  app.use((await import('../../server/middleware/github')).default);
  app.use('/api/seats', (await import('../../server/api/seats')).default);
  app.use('/api/user-metrics', (await import('../../server/api/user-metrics')).default);
  const server = createServer(toNodeListener(app));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const query = 'scope=organization&githubOrg=synthetic-org&since=2026-01-01&until=2026-01-09';
  try {
    for (const login of ['synthetic-self', 'synthetic-admin']) {
      const response = await fetch(`${base}/user-metrics?${query}`, { headers: { 'x-test-login': login } });
      assert.equal(response.status, 200);
      const users: UserTotals[] = await response.json();
      assert.equal(users.length, login === 'synthetic-self' ? 1 : 2);
      if (login === 'synthetic-self') assert.equal(users[0]?.login, 'synthetic-self');
      assert.deepEqual(JSON.parse(response.headers.get('x-copilot-user-summary')!), {
        total_users: 2, active_users: 1, generated: 100, accepted: 18,
      });
    }
    const team = await fetch(`${base}/user-metrics?${query}&githubTeam=synthetic-team`, {
      headers: { 'x-test-login': 'synthetic-self' },
    });
    assert.deepEqual(JSON.parse(team.headers.get('x-copilot-user-summary')!), {
      total_users: 2, active_users: 1, generated: 9, accepted: 9,
    });
    assert.equal((await team.json()).length, 1);
    const seatResponse = await fetch(`${base}/seats?${query}&per_page=1&page=2`, {
      headers: { 'x-test-login': 'synthetic-self' },
    });
    const result = await seatResponse.json();
    assert.equal(result.total_seats, 1);
    assert.equal(result.total_pages, 1);
    assert.equal(result.seats[0].login, 'synthetic-self');
    assert.deepEqual(result.summary, { assigned: 2, never_used: 1, inactive_7: 1, inactive_30: 1 });
    assert.equal((await fetch(`${base}/user-metrics?${query}`)).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
