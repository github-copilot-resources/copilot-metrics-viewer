// npm test -- --run --config tests/billing-token-storage.config.ts
// Requires Docker with postgres:16-alpine; owns its container and random loopback
// port. Never connects to a configured application database.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool, initSchema } from '../server/storage/db';
import { parseBillingCsv } from '../server/services/billing-csv-parser';
import { deleteBillingCreditRowsForRange, upsertBillingCreditRows } from '../server/storage/billing-credit-usage-storage';

let container = '';
const tokenColumns = ['input', 'output', 'cache_read', 'cache_write'] as const;
const csv = readFileSync(resolve(__dirname, 'fixtures', 'billing-token-usage.synthetic.csv'), 'utf8');
const parsed = parseBillingCsv(csv)[0]!;
const row = { enterprise: 'synthetic-enterprise', ...parsed };

beforeAll(async () => {
  container = execFileSync('docker', [
    'run', '--rm', '-d', '-p', '127.0.0.1::5432',
    '-e', 'POSTGRES_USER=synthetic', '-e', 'POSTGRES_PASSWORD=synthetic-test-only',
    '-e', 'POSTGRES_DB=synthetic', 'postgres:16-alpine',
  ], { encoding: 'utf8' }).trim();
  const binding = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' }).trim();
  expect(binding).toMatch(/^127\.0\.0\.1:\d+$/);
  process.env.DATABASE_URL = `postgres://synthetic:synthetic-test-only@${binding}/synthetic`;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      await getPool().query('SELECT 1');
      ready = true;
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  expect(ready).toBe(true);
}, 30_000);

afterAll(async () => {
  await closePool();
  delete process.env.DATABASE_URL;
  if (container) execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
});

describe('raw billing tokens in real isolated PostgreSQL', () => {
  it('creates fresh columns, collapses duplicate keys and replaces re-ingested values', async () => {
    await initSchema();
    const pool = getPool();
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, numeric_scale, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'billing_credit_usage' AND column_name = ANY($1::text[])
      ORDER BY column_name
    `, [tokenColumns]);
    expect(columns).toHaveLength(4);
    expect(columns.every(c => c.data_type === 'numeric' && c.numeric_scale === null && c.is_nullable === 'NO' && c.column_default === '0')).toBe(true);

    // Include a quote to exercise parameterized writes, not SQL interpolation.
    const first = { ...row, model: "synthetic-model'quoted", input: 10, output: 0.25, cache_read: 30, cache_write: 40 };
    const second = { ...first, cost_center_name: 'synthetic-center', input: 1, output: 0.5, cache_read: 3, cache_write: 4 };
    const read = async () => (await pool.query(
      'SELECT input, output, cache_read, cache_write FROM billing_credit_usage WHERE enterprise = $1 AND model = $2',
      [first.enterprise, first.model],
    )).rows;
    expect(await upsertBillingCreditRows([first, second])).toBe(1);
    expect(await read()).toEqual([{ input: '11', output: '0.75', cache_read: '33', cache_write: '44' }]);
    expect(await upsertBillingCreditRows([first, second])).toBe(1);
    expect(await read()).toEqual([{ input: '11', output: '0.75', cache_read: '33', cache_write: '44' }]);
    await upsertBillingCreditRows([{ ...first, input: 7, output: 8, cache_read: 9, cache_write: 10 }]);
    expect(await read()).toEqual([{ input: '7', output: '8', cache_read: '9', cache_write: '10' }]);
    await deleteBillingCreditRowsForRange(row.enterprise, row.date, row.date);
    await upsertBillingCreditRows([row]);
    const { rows } = await pool.query('SELECT input, output, cache_read, cache_write FROM billing_credit_usage');
    expect(rows).toEqual([{ input: '9007199254740991', output: '123.4567891', cache_read: '0', cache_write: '789' }]);
  });

  it('additively upgrades an existing legacy table and defaults historical tokens to zero', async () => {
    const pool = getPool();
    // Model the exact prior schema by removing only the four added columns.
    for (const column of tokenColumns) {
      await pool.query(`ALTER TABLE billing_credit_usage DROP COLUMN ${column}`);
    }
    await initSchema();
    await initSchema();
    const { rows } = await pool.query('SELECT input, output, cache_read, cache_write, quantity, username FROM billing_credit_usage');
    expect(rows).toEqual([{ input: '0', output: '0', cache_read: '0', cache_write: '0', quantity: '2.000000', username: '' }]);
    await upsertBillingCreditRows([row]);
    const { rows: updated } = await pool.query('SELECT input, output FROM billing_credit_usage');
    expect(updated).toEqual([{ input: '9007199254740991', output: '123.4567891' }]);
  });
});
