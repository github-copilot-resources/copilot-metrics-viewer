// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, createError, defineEventHandler, getHeader, getQuery, setResponseHeader, toNodeListener, type H3Event } from 'h3';
import { DataType, newDb } from 'pg-mem';
import type { Pool } from 'pg';
import type { TopBillingUsersResponse } from '../server/services/billing-credit-reader';
import { buildTopSpendersChartData } from '../app/utils/billingTopSpenders';

const storage = vi.hoisted(() => ({ query: vi.fn(), covered: true }));
vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => ({ billingEnterprise: 'synthetic-ent' }),
}));
vi.mock('../server/storage/db', () => ({ getPool: () => ({ query: storage.query }) }));
vi.mock('../server/utils/usage-admin', () => ({
  requireUsageAdmin: vi.fn(async (event: H3Event) => {
    const role = getHeader(event, 'x-test-role');
    if (role !== 'admin') throw createError({ statusCode: role ? 403 : 401 });
  }),
}));
vi.mock('../server/services/billing-credit-reader', async (original) => ({
  ...await original<typeof import('../server/services/billing-credit-reader')>(),
  decideSource: vi.fn(async () => ({
    source: storage.covered ? 'db' : 'live', reason: 'synthetic coverage', lastIngestAt: null,
  })),
}));

describe('billing top users HTTP → global aggregation → chart contract', () => {
  let server: Server;
  let pool: Pool;
  let base: string;

  beforeAll(async () => {
    const db = newDb();
    db.public.registerEquivalentType({ name: 'float8', equivalentTo: DataType.float, isValid: () => true });
    db.public.registerFunction({
      name: 'nullif', args: [DataType.text, DataType.text], returns: DataType.text,
      implementation: (a: string, b: string) => a === b ? null : a,
    });
    pool = new (db.adapters.createPg().Pool)() as Pool;
    await pool.query(`CREATE TABLE billing_credit_usage (
      enterprise TEXT, date DATE, username TEXT, organization TEXT DEFAULT '',
      repository TEXT DEFAULT '', sku TEXT DEFAULT 'sku-a', model TEXT DEFAULT 'model-a',
      quantity NUMERIC, gross_amount NUMERIC, net_amount NUMERIC
    )`);
    const values: unknown[] = [];
    const rows = Array.from({ length: 600 }, (_, i) => {
      values.push('synthetic-ent', '2026-06-15', `user-${String(i).padStart(4, '0')}`, 10, i === 599 ? 999999 : i, 0);
      return `(${Array.from({ length: 6 }, (_v, j) => `$${i * 6 + j + 1}`).join(',')})`;
    });
    await pool.query(`INSERT INTO billing_credit_usage
      (enterprise, date, username, quantity, gross_amount, net_amount) VALUES ${rows.join(',')}`, values);
    await pool.query(`INSERT INTO billing_credit_usage
      (enterprise, date, username, quantity, gross_amount, net_amount) VALUES
      ('other-ent', '2026-06-15', 'private-other-enterprise', 999999, 9999999, 999999),
      ('synthetic-ent', '2026-05-31', 'outside-period', 999999, 9999999, 999999),
      ('synthetic-ent', '2026-06-15', '', 999999, 9999999, 999999),
      ('synthetic-ent', '2026-06-30', 'user-0599', 5, 1, 0)`);
    storage.query.mockImplementation((sql: string, params: unknown[]) => pool.query(sql, params));
    vi.stubGlobal('defineEventHandler', defineEventHandler);
    vi.stubGlobal('getQuery', getQuery);
    vi.stubGlobal('createError', createError);
    vi.stubGlobal('setResponseHeader', setResponseHeader);
    vi.stubGlobal('useRuntimeConfig', () => ({ billingEnterprise: 'synthetic-ent' }));
    const { default: handler } = await import('../server/api/billing-credits-top-users.get');
    const app = createApp().use('/api/billing-credits-top-users', handler);
    server = createServer(toNodeListener(app));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test listener');
    base = `http://127.0.0.1:${address.port}/api/billing-credits-top-users?year=2026&month=6&metric=auto`;
  });

  beforeEach(() => {
    storage.covered = true;
    storage.query.mockClear();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
    await pool?.end();
    vi.unstubAllGlobals();
  });

  it.each([undefined, 'member'])('blocks role %s before querying any global spend or revealing its metric', async (role) => {
    const response = await fetch(base, { headers: role ? { 'x-test-role': role } : {} });
    expect(response.status).toBe(role ? 403 : 401);
    expect(storage.query).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('grossAmount');
  });

  it('returns the gross outlier beyond the zero-net top ten and first 500, with the correct chart label', async () => {
    const response = await fetch(base, { headers: { 'x-test-role': 'admin' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-data-source')).toBe('db');
    const body = await response.json() as TopBillingUsersResponse;
    expect(body.metric).toBe('grossAmount');
    expect(body.users).toHaveLength(10);
    expect(body.users[0]).toMatchObject({ user: 'user-0599', credits: 15, grossAmount: 1000000, netAmount: 0 });
    const chart = buildTopSpendersChartData(body.users, '#3f51b5', body.metric as 'grossAmount');
    expect(chart?.labels[0]).toBe('user-0599');
    expect(chart?.datasets[0]).toMatchObject({ label: 'Gross spend (USD)', data: [1000000, 598, 597, 596, 595, 594, 593, 592, 591, 590] });
  });

  it('keeps empty scoped results neutral and never falls back to live or per-user data', async () => {
    const response = await fetch(`${base}&model=missing`, { headers: { 'x-test-role': 'admin' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ metric: 'netAmount', users: [] });
    storage.covered = false;
    const unavailable = await fetch(base, { headers: { 'x-test-role': 'admin' } });
    expect(unavailable.status).toBe(409);
  });
});
