import { expect, test } from '@playwright/test';

for (const [column, key] of [['Credits', 'netQuantity'], ['Gross $', 'grossAmount'], ['Net $', 'netAmount']] as const) {
  test(`disables ${column} sorting without storage and keeps live loading page-bounded`, async ({ page }) => {
    const users = Array.from({ length: 60 }, (_, i) => `fake-user-${String(i).padStart(3, '0')}`);
    const batches: string[][] = [];
    await page.route('https://api.github.com/**', route => route.abort());
    await page.route(/\/api\/billing-credits\?/, route => route.fulfill({
      json: { timePeriod: {}, usageItems: [{ grossAmount: 100, netAmount: 100, netQuantity: 1000 }] },
    }));
    await page.route('**/api/user-metrics?**', route => route.fulfill({
      json: [...users].reverse().map(login => ({ login })),
    }));
    await page.route('**/api/billing-credits-top-users?**', route => route.fulfill({
      json: { metric: 'grossAmount', timePeriod: {}, users: [] },
    }));
    await page.route('**/api/billing-credits-by-user?**', route => {
      const logins = new URL(route.request().url()).searchParams.get('logins')?.split(',') ?? [];
      batches.push(logins);
      return route.fulfill({
        json: { timePeriod: {}, identityReconciliation: 'unknown', usageItems: logins.map(user => ({
          user, netQuantity: 100, grossAmount: 10, netAmount: 10, [key]: 100 - users.indexOf(user),
        })) },
      });
    });
    await page.goto('/orgs/fake-org?mock=true', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'billing', exact: true }).click();
    const table = page.locator('.v-card').filter({
      has: page.locator('.v-card-title').filter({ hasText: 'Per-user breakdown' }),
    }).last();
    await expect(table).toContainText('25 of 60 loaded');
    const header = table.getByRole('columnheader', { name: column, exact: true });
    await expect(header).not.toHaveClass(/v-data-table__th--sortable/);
    await header.click();
    await expect(table.locator('tbody tr').first()).toContainText(users[0]!);
    await expect(table.locator('.v-data-table-footer__info')).toHaveText('1-25 of 60');
    expect(batches.map(batch => batch.length)).toEqual([25]);
    await expect(page.getByTestId('billing-page-sort-note')).toBeVisible();
    await expect(page.getByTestId('billing-page-sort-note')).toContainText('Import billing');
    await table.getByRole('button', { name: 'Admin Panel', exact: true }).click();
    const adminPanel = page.getByRole('dialog');
    await expect(adminPanel).toContainText('Admin Panel');
    await adminPanel.getByRole('button', { name: 'Close admin panel', exact: true }).click();
    await header.click();
    await expect(table.locator('tbody tr').first()).toContainText(users[0]!);
    expect(batches.map(batch => batch.length)).toEqual([25]);
    await table.getByRole('button', { name: 'Next page' }).click();
    await expect(table).toContainText('50 of 60 loaded');
    await expect(table.locator('tbody tr').first()).toContainText(users[25]!);
    await expect(table.locator('.v-data-table-footer__info')).toHaveText('26-50 of 60');
    expect(batches.map(batch => batch.length)).toEqual([25, 25]);
    if (process.env.PR439_SCREENSHOTS) {
      await table.scrollIntoViewIfNeeded();
      await table.screenshot({ path: `${process.env.PR439_SCREENSHOTS}/bounded-table-${key}.png` });
      await page.screenshot({ path: `${process.env.PR439_SCREENSHOTS}/bounded-${key}.png`, fullPage: true, animations: 'disabled' });
    }
    console.log(JSON.stringify({ column, actions: ['ascending', 'descending', 'next page'], batchSizes: batches.map(batch => batch.length) }));
  });

}

test('renders globally sorted stored pages without table roster downloads, fanout, or a covering aggregate import', async ({ page }) => {
    let rosterRequests = 0;
    let fanoutRequests = 0;
    const users = Array.from({ length: 60 }, (_, i) => ({
      user: `synthetic-${String(i).padStart(3, '0')}`,
      credits: i, grossAmount: i, netAmount: i, models: 1, tokens: i,
    }));
    await page.route('https://api.github.com/**', route => route.abort());
    await page.route('**/api/user-metrics?**', route => {
      rosterRequests++;
      return route.fulfill({ json: [] });
    });
    await page.route('**/api/billing-credits-by-user?**', route => {
      fanoutRequests++;
      return route.fulfill({ json: { usageItems: [] } });
    });
    await page.route(/\/api\/billing-credits\?/, route => route.fulfill({
      status: 409, json: { statusMessage: 'No covering aggregate import' },
    }));
    await page.route('**/api/billing-credits-top-users?**', route => route.fulfill({ json: { users: [] } }));
    await page.route('**/api/billing-user-page?**', route => {
      const query = new URL(route.request().url()).searchParams;
      const rows = [...users];
      if (query.get('sort') === 'netAmount') rows.sort((a, b) => query.get('order') === 'desc' ? b.netAmount - a.netAmount : a.netAmount - b.netAmount);
      const start = (Number(query.get('page')) - 1) * Number(query.get('limit'));
      return route.fulfill({ json: {
        available: true, rows: rows.slice(start, start + Number(query.get('limit'))), total: users.length,
        topTokenUsers: [], lastImportAt: '2026-07-01T10:00:00Z',
        window: { startDate: '2026-06-01', endDate: '2026-06-30' },
      } });
    });
    await page.goto('/orgs/fake-org?mock=true', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => rosterRequests).toBeGreaterThan(0);
    await page.waitForLoadState('networkidle');
    rosterRequests = 0;
    await page.getByRole('tab', { name: 'billing', exact: true }).click();
    const table = page.locator('.v-card').filter({
      has: page.locator('.v-card-title').filter({ hasText: 'Per-user breakdown' }),
    }).last();
    await expect(table).toContainText('Last imported:');
    await expect(table).toContainText('Imported data may be incomplete or out of date.');
    const net = table.getByRole('columnheader', { name: 'Net $', exact: true });
    await net.click();
    await net.click();
    await expect(table.locator('tbody tr').first()).toContainText('synthetic-059');
    await table.getByRole('button', { name: 'Next page' }).click();
    await expect(table.locator('tbody tr').first()).toContainText('synthetic-034');
    await expect(table.locator('.v-data-table-footer__info')).toHaveText('26-50 of 60');
    expect(rosterRequests).toBe(0);
    expect(fanoutRequests).toBe(0);
});

test('keeps checked zeros scoped to the batch and an off-page spender reachable', async ({ page }) => {
  const users = Array.from({ length: 60 }, (_, i) => `fake-user-${String(i).padStart(3, '0')}`);
  const batches: string[][] = [];
  await page.route('https://api.github.com/**', route => route.abort());
  await page.route(/\/api\/billing-credits\?/, route => route.fulfill({
    json: { timePeriod: {}, usageItems: [{ grossAmount: 10, netAmount: 10, netQuantity: 100 }] },
  }));
  await page.route('**/api/user-metrics?**', route => route.fulfill({
    json: [...users].reverse().map(login => ({ login, totals_by_cli: { token_usage: { prompt_tokens_sum: 5, output_tokens_sum: 5 } } })),
  }));
  await page.route('**/api/billing-credits-top-users?**', route => route.fulfill({
    json: { metric: 'grossAmount', timePeriod: {}, users: [{ user: users[59], grossAmount: 10, netAmount: 10 }] },
  }));
  await page.route('**/api/billing-credits-by-user?**', route => {
    const logins = new URL(route.request().url()).searchParams.get('logins')?.split(',') ?? [];
    batches.push(logins);
    return route.fulfill({
      json: { timePeriod: {}, identityReconciliation: 'unknown', usageItems: logins.filter(login => login === users[59]).map(user => ({
        user, netQuantity: 100, grossAmount: 10, netAmount: 10,
      })) },
    });
  });
  await page.goto('/orgs/fake-org?mock=true', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'billing', exact: true }).click();
  const table = page.locator('.v-card').filter({
    has: page.locator('.v-card-title').filter({ hasText: 'Per-user breakdown' }),
  }).last();
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr').first()).toContainText('$0.00');
  await expect(page.getByTestId('billing-checked-users-empty')).toContainText('successfully checked users');
  await expect(page.getByText('No per-user attribution available for this enterprise')).toHaveCount(0);
  await expect(page.getByText('Top token users (CLI)', { exact: false })).toBeVisible();
  await expect(page.getByTestId('user-insights-section')).toBeVisible();
  expect(batches.map(batch => batch.length)).toEqual([25]);
  if (process.env.PR439_SCREENSHOTS) {
    await page.getByTestId('billing-checked-users-empty').screenshot({ path: `${process.env.PR439_SCREENSHOTS}/checked-zero-note.png` });
    await table.screenshot({ path: `${process.env.PR439_SCREENSHOTS}/checked-zero-table.png` });
    await page.screenshot({ path: `${process.env.PR439_SCREENSHOTS}/checked-zero-first-page.png`, fullPage: true, animations: 'disabled' });
  }
  await table.getByRole('button', { name: 'Next page' }).click();
  await expect(table).toContainText('50 of 60 loaded');
  await table.getByRole('button', { name: 'Next page' }).click();
  const spender = table.locator('tbody tr').filter({ hasText: users[59] });
  await expect(spender).toContainText('$10.00');
  await expect(spender.locator('td').nth(1)).toHaveText('100');
  await expect(table.locator('.v-data-table-footer__info')).toHaveText('51-60 of 60');
  await expect(page.getByTestId('billing-checked-users-empty')).toHaveCount(0);
  expect(batches.map(batch => batch.length)).toEqual([25, 25, 10]);
  if (process.env.PR439_SCREENSHOTS) {
    await table.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.PR439_SCREENSHOTS}/offpage-spender.png`, fullPage: true });
  }
  console.log(JSON.stringify({ scenario: 'offpage-spender', batchSizes: batches.map(batch => batch.length) }));
});

test('keeps paged identity checks unknown, uses actual sorted rows, and distinguishes errors from zero', async ({ page }) => {
  const users = Array.from({ length: 60 }, (_, i) => `fake-user-${String(i).padStart(3, '0')}`);
  const batches: string[][] = [];
  let fail = false;
  await page.route('https://api.github.com/**', route => route.abort());
  await page.route(/\/api\/billing-credits\?/, route => route.fulfill({
    json: { timePeriod: { year: 2026, month: 6 }, usageItems: [{ grossAmount: 10, netAmount: 10, netQuantity: 100 }] },
  }));
  await page.route('**/api/user-metrics?**', route => route.fulfill({
    json: [...users].reverse().map(login => ({ login, totals_by_cli: { token_usage: { prompt_tokens_sum: 5, output_tokens_sum: 5 } } })),
  }));
  await page.route('**/api/billing-credits-top-users?**', route => route.fulfill({
    json: { metric: 'grossAmount', timePeriod: {}, users: [] },
  }));
  await page.route('**/api/billing-credits-by-user?**', route => {
    const logins = new URL(route.request().url()).searchParams.get('logins')?.split(',') ?? [];
    batches.push(logins);
    if (fail) return route.fulfill({
      status: 503,
      json: { statusCode: 503, statusMessage: 'Invalid NUXT_BILLING_USER_ALIASES configuration.' },
    });
    return route.fulfill({
      json: {
        timePeriod: {}, identityReconciliation: 'unknown',
        usageItems: logins.filter(login => login !== users[1]).map(user => ({
          user, netQuantity: 17, grossAmount: 1.7, netAmount: 1.7, discountQuantity: 0, model: 'fake-model',
        })),
      },
    });
  });
  await page.goto('/orgs/fake-org?mock=true', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'billing', exact: true }).click();
  const note = page.getByTestId('billing-identity-note');
  await expect(note).toContainText('not reconciled');
  await expect(note).toContainText('not evidence of an identity mismatch');
  const table = page.locator('.v-card').filter({
    has: page.locator('.v-card-title').filter({ hasText: 'Per-user breakdown' }),
  }).last();
  await expect(table).toBeVisible();
  const row = (login: string) => table.locator('tbody tr').filter({ hasText: login });
  await expect(row(users[0]!)).toContainText('$1.70');
  await expect(row(users[1]!)).toContainText('$0.00');
  expect(new Set(batches.flat())).toEqual(new Set(users.slice(0, 25)));
  await table.getByRole('button', { name: 'Next page' }).click();
  await expect(row(users[25]!)).toContainText('$1.70');
  expect(new Set(batches.flat())).toEqual(new Set(users.slice(0, 50)));
  await table.getByRole('button', { name: 'Next page' }).click();
  await expect(row(users[59]!)).toContainText('$1.70');
  expect(new Set(batches.flat())).toEqual(new Set(users));
  await expect(page.getByText('Show unmatched billing usernames')).toHaveCount(0);
  if (process.env.PR439_SCREENSHOTS) {
    await note.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.PR439_SCREENSHOTS}/identity-unknown.png`, fullPage: true });
  }
  fail = true;
  await page.getByRole('button', { name: 'Previous month' }).click();
  const error = page.getByTestId('billing-per-user-error');
  await expect(error).toContainText('unavailable');
  await expect(row(users[0]!)).toContainText('Unavailable');
  await expect(row(users[0]!)).not.toContainText('$0.00');
  if (process.env.PR439_SCREENSHOTS) {
    await error.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.PR439_SCREENSHOTS}/identity-error.png`, fullPage: true });
  }
  fail = false;
  await page.getByRole('button', { name: 'Retry per-user billing' }).click();
  await expect(error).toHaveCount(0);
  await expect(row(users[0]!)).toContainText('$1.70');
});
