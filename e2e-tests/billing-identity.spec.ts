import { expect, test } from '@playwright/test';

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
