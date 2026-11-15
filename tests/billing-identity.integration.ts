// Owns a disposable Postgres container; never uses a configured application DB.
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, createError, defineEventHandler, getHeader, getQuery, setResponseHeader, toNodeListener, type H3Event } from 'h3';
import { closePool, getPool, initSchema } from '../server/storage/db';
import { aggregateForBillingByUser, resolveWindow } from '../server/services/billing-credit-reader';
import type { BillingCreditsResponse } from '../server/api/billing-credits.get';

vi.mock('../server/services/billing-credit-reader', async original => ({
  ...await original<typeof import('../server/services/billing-credit-reader')>(),
  decideSource: vi.fn(async () => ({ source: 'db', reason: 'synthetic fixture coverage', lastIngestAt: null })),
}));

let container = '';
let server: Server;
let base = '';
const window = resolveWindow({ year: 2026, month: 6 });
const querySpy = vi.fn();

beforeAll(async () => {
  container = execFileSync('docker', [
    'run', '--rm', '-d', '-p', '127.0.0.1::5432',
    '-e', 'POSTGRES_USER=synthetic', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=pr439', 'postgres:16-alpine',
  ], { encoding: 'utf8' }).trim();
  console.info(`Owned disposable synthetic Postgres container: ${container}`);
  const binding = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' }).trim();
  if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected owned loopback Postgres');
  process.env.DATABASE_URL = `postgres://synthetic@${binding}/pr439`;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { await getPool().query('SELECT 1'); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  expect(ready).toBe(true);
  await initSchema();
  await getPool().query(`INSERT INTO billing_credit_usage
    (enterprise, date, product, sku, username, organization, repository, model,
     unit_type, quantity, applied_cost_per_quantity, gross_amount, net_amount)
    SELECT 'fake-ent', '2026-06-15', 'copilot', 'fake-sku',
      'fake-user-' || lpad(i::text, 3, '0'), 'fake-org', 'fake-repo', 'fake-model',
      'credits', 2, 0.1, 0.2, 0.2 FROM generate_series(0,599) i`);
  await getPool().query(`INSERT INTO billing_credit_usage
    (enterprise, date, product, sku, username, organization, repository, model,
     unit_type, quantity, applied_cost_per_quantity, gross_amount, net_amount) VALUES
    ('fake-ent','2026-06-15','copilot','fake-sku','OPAQUE_000','fake-org','fake-repo','fake-model','credits',3,0.1,0.3,0.3),
    ('other-ent','2026-06-15','copilot','fake-sku','opaque_000','fake-org','fake-repo','fake-model','credits',999,0.1,99.9,99.9),
    ('fake-ent','2026-05-31','copilot','fake-sku','opaque_000','fake-org','fake-repo','fake-model','credits',888,0.1,88.8,88.8),
    ('fake-ent','2026-06-15','copilot','other-sku','opaque_000','other-org','other-repo','other-model','credits',777,0.1,77.7,77.7)`);
  const pool = getPool();
  const originalQuery = pool.query.bind(pool);
  vi.spyOn(pool, 'query').mockImplementation((...args: Parameters<typeof originalQuery>) => {
    querySpy(args[0]);
    return originalQuery(...args);
  });
  vi.stubGlobal('defineEventHandler', defineEventHandler);
  vi.stubGlobal('getQuery', getQuery);
  vi.stubGlobal('createError', createError);
  vi.stubGlobal('setResponseHeader', setResponseHeader);
  vi.stubGlobal('useRuntimeConfig', () => ({
    usageAdmins: 'fake-admin', public: { requireAuth: true },
  }));
  vi.stubGlobal('getUserSession', async (event: H3Event) => ({
    user: getHeader(event, 'x-synthetic-login') ? { login: getHeader(event, 'x-synthetic-login') } : undefined,
  }));
  vi.stubGlobal('$fetch', vi.fn(() => { throw new Error('Live access prohibited in this fixture'); }));
  const { default: handler } = await import('../server/api/billing-credits-by-user.get');
  server = createServer(toNodeListener(createApp().use('/api/billing-credits-by-user', handler)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected fixture HTTP listener');
  base = `http://127.0.0.1:${address.port}/api/billing-credits-by-user?scope=enterprise&githubEnt=fake-ent&isDataMocked=false&year=2026&month=6&sku=fake-sku&model=fake-model`;
}, 30_000);

beforeEach(() => {
  process.env.NUXT_BILLING_USER_ALIASES = '{"opaque_000":"fake-user-000"}';
  querySpy.mockClear();
});

afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await closePool();
  if (container) execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
  delete process.env.DATABASE_URL;
  delete process.env.NUXT_BILLING_USER_ALIASES;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('real Postgres billing aliases → HTTP privacy contract', () => {
  it.each([undefined, 'fake-member'])('denies %s before reading aliases or arbitrary requested users', async login => {
    process.env.NUXT_BILLING_USER_ALIASES = '{';
    const response = await fetch(`${base}&logins=fake-user-599&aliases={"x":"fake-user-599"}`, {
      headers: login ? { 'x-synthetic-login': login } : {},
    });
    expect(response.status).toBe(403);
    expect(querySpy).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('fake-user-599');
  });

  it('aggregates direct plus alias lines exactly once and never labels the other 599 users unmatched', async () => {
    const response = await fetch(`${base}&logins=Fake-User-000,fake-user-000,opaque_000`, {
      headers: { 'x-synthetic-login': 'fake-admin' },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as BillingCreditsResponse;
    expect(body.identityReconciliation).toBe('unknown');
    expect(body).not.toHaveProperty('unmatchedBillingUsernames');
    expect(new Set(body.usageItems.map(item => item.user))).toEqual(new Set(['fake-user-000']));
    expect(body.usageItems.reduce((sum, item) => sum + item.grossQuantity, 0)).toBe(5);
    expect(body.usageItems.reduce((sum, item) => sum + item.netAmount, 0)).toBeCloseTo(0.5);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).not.toMatch(/opaque|other-ent|fake-user-599/);
    const later = await fetch(`${base}&logins=fake-user-599`, { headers: { 'x-synthetic-login': 'fake-admin' } });
    const page = await later.json() as BillingCreditsResponse;
    expect(page.identityReconciliation).toBe('unknown');
    expect(page.usageItems[0]).toMatchObject({ user: 'fake-user-599', grossQuantity: 2 });
  });

  it('keeps enterprise, organization, repository, date, SKU, model filters bound during alias expansion', async () => {
    const filters = { organization: 'fake-org', repository: 'fake-repo', sku: 'fake-sku', model: 'fake-model' };
    const read = (enterprise: string, extra = {}) => aggregateForBillingByUser(
      enterprise, window, ['FAKE-USER-000'], { ...filters, ...extra },
    );
    expect((await read('fake-ent')).usageItems.reduce((sum, item) => sum + item.grossQuantity, 0)).toBe(5);
    expect((await read('absent-ent')).usageItems).toEqual([]);
    expect((await read('fake-ent', { organization: 'absent-org' })).usageItems).toEqual([]);
    expect((await read('fake-ent', { repository: 'absent-repo' })).usageItems).toEqual([]);
    expect((await read('fake-ent', { model: "fake-model'; DROP TABLE billing_credit_usage; --" })).usageItems).toEqual([]);
    expect((await read('fake-ent', { sku: 'absent-sku' })).usageItems).toEqual([]);
  });

  it('returns a successful empty result for a real zero, not for configuration errors', async () => {
    const zero = await fetch(`${base}&logins=fake-zero`, { headers: { 'x-synthetic-login': 'fake-admin' } });
    expect(zero.status).toBe(200);
    expect((await zero.json() as BillingCreditsResponse).usageItems).toEqual([]);
    querySpy.mockClear();
    process.env.NUXT_BILLING_USER_ALIASES = '{"private-fake-handle":42}';
    const failure = await fetch(`${base}&logins=fake-zero`, { headers: { 'x-synthetic-login': 'fake-admin' } });
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain('private-fake-handle');
    expect(querySpy).not.toHaveBeenCalled();
  });
});
