import { execFileSync } from 'node:child_process';
import { spawn, type ChildProcess } from 'node:child_process';
import { openSync, closeSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool, initSchema } from '../server/storage/db';
import {
  beginUsageSnapshot, stageUsageBatch, completeUsagePart, publishUsageSnapshot,
  beginMembershipSnapshot, stageMembershipBatch, publishMembershipSnapshot,
} from '../server/storage/roster-foundation-storage';
import { readBillingUserPage } from '../server/services/billing-user-page';

let container = '';
const now = new Date('2026-11-15T12:00:00Z');
const day = '2026-11-13';
const base = {
  scope: 'organization' as const, identifier: 'synthetic-org', enterprise: 'synthetic-enterprise',
  usageSince: day, usageUntil: day, billingSince: '2026-11-01', billingUntil: '2026-11-30',
  page: 1, itemsPerPage: 25, sortKey: 'netAmount' as const, sortOrder: 'desc' as const,
  aliases: { 'synthetic-emu': 'synthetic-060' }, now,
};
const users = Array.from({ length: 61 }, (_, i) => `synthetic-${String(i).padStart(3, '0')}`);
let membership = '';
let server: ChildProcess | undefined;

beforeAll(async () => {
  container = execFileSync('docker', ['run', '--rm', '-d', '-p', '127.0.0.1::5432',
    '-e', 'POSTGRES_USER=synthetic', '-e', 'POSTGRES_PASSWORD=synthetic-test-only',
    '-e', 'POSTGRES_DB=synthetic', 'postgres:16-alpine'], { encoding: 'utf8' }).trim();
  const binding = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' }).trim();
  expect(binding).toMatch(/^127\.0\.0\.1:\d+$/);
  process.env.DATABASE_URL = `postgres://synthetic:synthetic-test-only@${binding}/synthetic`;
  for (let i = 0; i < 60; i++) {
    try { await getPool().query('SELECT 1'); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  await initSchema();
  const version = await beginUsageSnapshot('organization', base.identifier, day, day, 1);
  await stageUsageBatch(version, users.map((user_login, i) => ({
    day, user_login, totals_by_cli: { token_usage: { prompt_tokens_sum: i, output_tokens_sum: 0 } },
  })) as Parameters<typeof stageUsageBatch>[1]);
  await completeUsagePart(version, 0);
  await publishUsageSnapshot(version, now, now);
  const pool = getPool();
  for (const [i, user] of users.entries()) {
    for (const model of i === 60 ? ['model-a', 'model-b'] : ['model-a']) {
      await pool.query(`INSERT INTO billing_credit_usage
        (enterprise, date, product, sku, username, organization, model, quantity, gross_amount, net_amount)
        VALUES ($1,'2026-11-02','copilot','synthetic-sku',$2,$3,$4,$5,$6,$7)`,
      [base.enterprise, i === 60 ? 'synthetic-emu' : user, base.identifier, model, i === 60 ? 900 : i,
        i === 60 ? 900 : i, i === 60 ? 800 : i]);
    }
  }
  await pool.query(`INSERT INTO billing_csv_sync_status
    (enterprise,start_date,end_date,status,completed_at) VALUES ($1,'2026-11-01','2026-11-30','completed',$2)`, [base.enterprise, now]);
  const key = { scope: 'organization' as const, identifier: base.identifier, teamKind: 'github' as const, teamKey: 'synthetic-team' };
  membership = await beginMembershipSnapshot(key);
  await stageMembershipBatch(membership, [{ login: users[0]!, userId: 1 }, { login: users[60]!, userId: 61 }]);
  await publishMembershipSnapshot(membership, now, now);
}, 30_000);
afterAll(async () => {
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await new Promise(resolve => server!.once('exit', resolve));
  }
  await closePool();
  delete process.env.DATABASE_URL;
  if (container) execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
});

describe('bounded complete-user billing pages in real PostgreSQL16', () => {
  it.each(['netAmount', 'grossAmount', 'credits', 'models', 'tokens'] as const)('sorts %s before paging and includes the unseen multi-model outlier', async sortKey => {
    const result = await readBillingUserPage({ ...base, sortKey });
    expect(result.total).toBe(61);
    expect(result.rows).toHaveLength(25);
    expect(result.rows[0]).toMatchObject({ user: 'synthetic-060', credits: 1800, grossAmount: 1800, netAmount: 1600, models: 2 });
    expect(JSON.stringify(result)).not.toContain('synthetic-emu');
    expect(result.rows[0]?.tokens).toBe(60);
  });
  it('pages once, canonicalizes ties and retains verified explicit zero', async () => {
    const first = await readBillingUserPage({ ...base, sortKey: 'user', sortOrder: 'asc' });
    const second = await readBillingUserPage({ ...base, sortKey: 'user', sortOrder: 'asc', page: 2, version: first.version });
    expect(first.rows[0]).toMatchObject({ user: users[0], credits: 0, netAmount: 0, billingState: 'loaded' });
    expect(second.rows.map(row => row.user)).toEqual(users.slice(25, 50));
    const ties = await readBillingUserPage({ ...base, sortKey: 'models', sortOrder: 'asc' });
    expect(ties.rows.map(row => row.user)).toEqual(users.slice(0, 25));
    expect((await readBillingUserPage({ ...base, page: 20 })).rows).toEqual([]);
  });
  it('intersects the fresh team version before count and order; exactly24h is stale', async () => {
    const result = await readBillingUserPage({ ...base, team: 'synthetic-team' });
    expect(result.total).toBe(2);
    expect(result.rows.map(row => row.user)).toEqual([users[60], users[0]]);
    expect((await readBillingUserPage({ ...base, team: 'synthetic-team', now: new Date(now.getTime() + 86399999) })).total).toBe(2);
    await expect(readBillingUserPage({ ...base, team: 'synthetic-team', now: new Date(now.getTime() + 86400000) }))
      .rejects.toMatchObject({ reason: 'membership-stale' });
    await expect(readBillingUserPage({ ...base, team: 'synthetic-unpublished-team' }))
      .rejects.toMatchObject({ reason: 'membership-unavailable' });
    await expect(readBillingUserPage({ ...base, team: 'reports-to:synthetic-manager' }))
      .rejects.toMatchObject({ reason: 'membership-unavailable' });
  });
  it('pins enterprise-team organization membership and filters while retaining an inactive verified-zero member', async () => {
    const usage = await beginUsageSnapshot('enterprise', base.enterprise, day, day, 1);
    await stageUsageBatch(usage, users.map((user_login, i) => ({
      day, user_login, totals_by_cli: { token_usage: { prompt_tokens_sum: i, output_tokens_sum: 0 } },
    })) as Parameters<typeof stageUsageBatch>[1]);
    await completeUsagePart(usage, 0);
    await publishUsageSnapshot(usage, now, now);
    const membership = await beginMembershipSnapshot({
      scope: 'enterprise', identifier: base.enterprise, teamKind: 'github', teamKey: 'synthetic-team', githubOrg: base.identifier,
    });
    const inactive = 'synthetic-inactive';
    await stageMembershipBatch(membership, [users[0]!, users[60]!, inactive].map(login => ({ login, userId: null })));
    await publishMembershipSnapshot(membership, now, now);
    await getPool().query(`INSERT INTO billing_credit_usage
      (enterprise,date,product,sku,username,organization,model,quantity,gross_amount,net_amount)
      VALUES ($1,'2026-11-02','copilot','synthetic-sku',$2,$3,'model-a',0,0,0)`, [base.enterprise, inactive, base.identifier]);
    try {
      const input = {
        ...base, scope: 'enterprise' as const, identifier: base.enterprise, githubOrg: base.identifier, team: 'synthetic-team',
        filters: { organization: base.identifier, model: 'model-b', sku: 'synthetic-sku', product: 'copilot' },
      };
      const result = await readBillingUserPage(input);
      expect(result.total).toBe(3);
      expect(result.rows[0]).toMatchObject({ user: users[60], credits: 900, grossAmount: 900, netAmount: 800, models: 1 });
      expect(result.rows.find(row => row.user === inactive)).toMatchObject({ tokens: 0, credits: 0, netAmount: 0, billingState: 'loaded' });
      const emptyFilter = await readBillingUserPage({ ...input, filters: { ...input.filters, repository: 'synthetic-missing-repo' } });
      expect(emptyFilter.rows.every(row => row.netAmount === 0 && row.billingState === 'loaded')).toBe(true);
      await expect(readBillingUserPage({ ...input, githubOrg: 'other-org' })).rejects.toMatchObject({ reason: 'membership-unavailable' });
    } finally { await getPool().query('DELETE FROM billing_credit_usage WHERE username = $1', [inactive]); }
  });
  it('pins windows/publications and does not infer coverage or matched identities', async () => {
    await expect(readBillingUserPage({ ...base, usageSince: '2026-11-12' })).rejects.toMatchObject({ reason: 'roster-coverage-missing' });
    await expect(readBillingUserPage({ ...base, version: 'old-version' })).rejects.toMatchObject({ reason: 'dataset-changed' });
    await expect(readBillingUserPage({ ...base, identifier: 'other-org' })).rejects.toMatchObject({ reason: 'roster-coverage-missing' });
    await expect(readBillingUserPage({ ...base, aliases: {} })).rejects.toMatchObject({ reason: 'billing-attribution-unavailable' });
    const names = await readBillingUserPage({ ...base, aliases: {}, sortKey: 'user', sortOrder: 'asc', page: 3 });
    expect(names.rows.at(-1)).toMatchObject({ user: users[60], billingState: 'Unavailable', netAmount: null });
  });
  it('applies model filters after identity verification, preserving zero and complete-user sums', async () => {
    const result = await readBillingUserPage({ ...base, filters: { model: 'model-b' } });
    expect(result.rows[0]).toMatchObject({ user: users[60], credits: 900, netAmount: 800, models: 1 });
    expect(result.rows[1]).toMatchObject({ user: users[0], credits: 0, netAmount: 0 });
  });
  it.each(['credits', 'tokens', 'netAmount', 'grossAmount', 'models'] as const)('orders %s ascending across the roster with canonical ties', async sortKey => {
    const result = await readBillingUserPage({ ...base, sortKey, sortOrder: 'asc' });
    expect(result.rows[0]?.user).toBe(users[0]);
    expect(result.rows).toHaveLength(25);
  });
  it('does not expose foreign organization usernames or treat partial attribution as complete', async () => {
    const pool = getPool();
    const insert = `INSERT INTO billing_credit_usage
      (enterprise,date,product,sku,username,organization,quantity,gross_amount,net_amount)
      VALUES ($1,'2026-11-02','copilot','test-extra',$2,$3,10,10,10)`;
    await pool.query(insert, [base.enterprise, 'synthetic-foreign-opaque', 'other-org']);
    try { expect((await readBillingUserPage(base)).rows[0]?.user).toBe(users[60]); }
    finally { await pool.query(`DELETE FROM billing_credit_usage WHERE sku = 'test-extra'`); }
    await pool.query(insert, [base.enterprise, 'synthetic-unresolved-opaque', base.identifier]);
    try {
      await expect(readBillingUserPage(base)).rejects.toMatchObject({ reason: 'billing-attribution-unavailable' });
      const result = await readBillingUserPage({ ...base, sortKey: 'user' });
      expect(result.rows.every(row => row.netAmount === null && row.billingState === 'Unavailable')).toBe(true);
      expect(JSON.stringify(result)).not.toContain('synthetic-unresolved-opaque');
    } finally { await pool.query(`DELETE FROM billing_credit_usage WHERE sku = 'test-extra'`); }
  });
  it('rejects failed/in-flight replacement data rather than falling back to an old certificate', async () => {
    const { rows } = await getPool().query(`INSERT INTO billing_csv_sync_status
      (enterprise,start_date,end_date,status) VALUES ($1,'2026-11-01','2026-11-30','failed') RETURNING id`, [base.enterprise]);
    try { await expect(readBillingUserPage(base)).rejects.toMatchObject({ reason: 'billing-coverage-missing' }); }
    finally { await getPool().query('DELETE FROM billing_csv_sync_status WHERE id = $1', [rows[0].id]); }
  });
  it('detects an actual usage publication change between pages', async () => {
    const first = await readBillingUserPage(base);
    const next = await beginUsageSnapshot('organization', base.identifier, day, day, 1);
    await stageUsageBatch(next, users.map((user_login, i) => ({
      day, user_login, totals_by_cli: { token_usage: { prompt_tokens_sum: i, output_tokens_sum: 0 } },
    })) as Parameters<typeof stageUsageBatch>[1]);
    await completeUsagePart(next, 0);
    await publishUsageSnapshot(next, now, now);
    await expect(readBillingUserPage({ ...base, page: 2, version: first.version })).rejects.toMatchObject({ reason: 'dataset-changed' });
    expect((await readBillingUserPage(base)).rows[0]?.user).toBe(users[60]);
  });
  it.runIf(process.env.PR430_BROWSER === '1')('exercises native sort/page/retry against the actual PostgreSQL-backed endpoint', async () => {
    const output = `${process.env.PR430_EVIDENCE_DIR ?? 'test-results/billing-user-page'}/`;
    mkdirSync(output, { recursive: true });
    const log = openSync(`${output}dev.log`, 'w');
    server = spawn(process.execPath, ['node_modules/@nuxt/cli/bin/nuxi.mjs', 'dev', '--host', '127.0.0.1', '--port', '3221', '--dotenv', '/dev/null'], {
      env: {
        PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: process.env.DATABASE_URL,
        NUXT_SESSION_PASSWORD: 'synthetic-session-only-430-validation', NUXT_PUBLIC_IS_DATA_MOCKED: 'true',
        NUXT_BILLING_ENTERPRISE: base.enterprise, NUXT_BILLING_USER_ALIASES: JSON.stringify(base.aliases),
      }, stdio: ['ignore', log, log],
    });
    closeSync(log);
    for (let attempt = 0; attempt < 120; attempt++) {
      try { if ((await fetch('http://127.0.0.1:3221/api/health')).ok) break; } catch { /* owned startup */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const health = [];
    for (const endpoint of ['health', 'ready', 'live']) {
      const response = await fetch(`http://127.0.0.1:3221/api/${endpoint}`);
      expect(response.ok).toBe(true);
      health.push({ endpoint, status: response.status, body: await response.json() });
    }
    writeFileSync(`${output}health-checks.json`, JSON.stringify(health, null, 2));
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await context.newPage();
    await page.clock.install({ time: now });
    const calls: unknown[] = [];
    let fail = false;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://127.0.0.1:3221') return route.abort();
      if (url.pathname === '/api/auth/usage-admin') return route.fulfill({ json: { isUsageAdmin: true, billingEnabled: true } });
      if (url.pathname === '/api/billing-credits') {
        const response = await route.fetch();
        return route.fulfill({ response, json: { ...await response.json(), timePeriod: { year: 2026, month: 11 } } });
      }
      if (url.pathname === '/api/billing-user-page') {
        url.searchParams.set('isDataMocked', 'false');
        url.searchParams.set('usageSince', day);
        url.searchParams.set('usageUntil', day);
        url.searchParams.set('year', '2026');
        url.searchParams.set('month', '11');
        url.searchParams.delete('since'); url.searchParams.delete('until');
        calls.push(Object.fromEntries(url.searchParams));
        if (fail) return route.fulfill({ status: 503, json: { statusCode: 503, message: 'Synthetic read failure' } });
        const response = await route.fetch({ url: url.toString() });
        return route.fulfill({ response });
      }
      return route.continue();
    });
    try {
      await page.goto('http://127.0.0.1:3221/orgs/synthetic-org?mock=true');
      await page.getByRole('tab', { name: 'billing', exact: true }).click();
      const table = page.getByTestId('billing-user-page');
      await table.getByText('synthetic-000', { exact: true }).waitFor();
      await table.getByRole('columnheader', { name: 'Net $' }).click();
      await table.getByRole('columnheader', { name: 'Net $' }).click();
      await page.waitForTimeout(500);
      expect(await table.locator('tbody tr').first().innerText()).toContain('synthetic-060');
      expect(await table.locator('tbody tr').first().innerText()).toContain('$1600.00');
      await table.screenshot({ path: `${output}server-net-desc.png` });
      const stable = calls.length;
      await page.waitForTimeout(1000);
      expect(calls.length).toBe(stable);
      await table.getByRole('button', { name: 'Next page' }).click();
      await page.waitForTimeout(500);
      expect(await table.locator('tbody tr').first().innerText()).toContain('synthetic-035');
      await table.screenshot({ path: `${output}server-page-two.png` });
      await table.getByRole('columnheader', { name: 'Tokens (CLI)' }).click();
      await table.getByRole('columnheader', { name: 'Tokens (CLI)' }).click();
      await page.waitForTimeout(500);
      expect(await table.locator('tbody tr').first().innerText()).toContain('synthetic-060');
      await table.screenshot({ path: `${output}server-tokens-desc.png` });
      fail = true;
      await table.getByRole('button', { name: 'Next page' }).click();
      await page.getByTestId('billing-per-user-error').waitFor();
      expect(await table.locator('tbody').innerText()).not.toContain('$0.00');
      await page.getByTestId('billing-per-user-error').screenshot({ path: `${output}server-read-unavailable.png` });
      fail = false;
      await page.getByRole('button', { name: 'Retry per-user billing' }).click();
      await page.waitForTimeout(500);
      expect(await table.locator('tbody tr').first().innerText()).toContain('synthetic-035');
      expect(calls.every(call => !Object.hasOwn(call as object, 'logins'))).toBe(true);
    } finally {
      writeFileSync(`${output}browser-calls.json`, JSON.stringify(calls, null, 2));
      await browser.close();
    }
  }, 120_000);
});
