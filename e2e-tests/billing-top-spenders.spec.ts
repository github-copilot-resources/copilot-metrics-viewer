import { expect, test } from '@playwright/test';
import type { TopBillingUsersResponse } from '../server/services/billing-credit-reader';

type ChartText = { text: string; x: number; y: number };
type ChartTestWindow = Window & {
  __billingChartText: WeakMap<HTMLCanvasElement, ChartText[]>;
};

test.describe('Global billing spend metric', { tag: ['@org', '@billing'] }, () => {
  for (const metric of ['netAmount', 'grossAmount'] as const) {
    test(`renders ${metric} outlier and metric-aware tooltip without changing the user count`, async ({ page }) => {
      await page.addInitScript(() => {
        const state = window as unknown as ChartTestWindow;
        state.__billingChartText = new WeakMap();
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (...args) {
          const transform = this.getTransform();
          const [, x, y] = args;
          const entries = state.__billingChartText.get(this.canvas) ?? [];
          entries.push({
            text: String(args[0]),
            x: transform.a * x + transform.c * y + transform.e,
            y: transform.b * x + transform.d * y + transform.f,
          });
          state.__billingChartText.set(this.canvas, entries);
          return fillText.apply(this, args);
        };
      });
      const users = Array.from({ length: 600 }, (_, i) => ({
        user: `user-${String(i).padStart(4, '0')}`,
        grossAmount: i === 599 ? 999999 : i,
        netAmount: metric === 'netAmount' ? (i === 598 ? 10000 : i === 599 ? 0 : i) : 0,
        credits: 10, models: 1,
      }));
      const topUsers: TopBillingUsersResponse = {
        timePeriod: { year: 2026, month: 6 }, enterprise: 'synthetic-ent', metric,
        users: [...users].sort((a, b) => b[metric] - a[metric] || a.user.localeCompare(b.user)).slice(0, 10),
      };
      await page.route(/\/api\/billing-credits\?/, route => route.fulfill({
        json: {
          timePeriod: topUsers.timePeriod, enterprise: 'synthetic-ent',
          usageItems: [{
            product: 'Copilot', sku: 'synthetic-sku', model: 'synthetic-model',
            grossQuantity: 6000, netQuantity: 6000, discountQuantity: 0,
            grossAmount: users.reduce((sum, user) => sum + user.grossAmount, 0),
            netAmount: users.reduce((sum, user) => sum + user.netAmount, 0),
          }],
        },
      }));
      await page.route('**/api/user-metrics?**', route => route.fulfill({
        json: users.map(user => ({ login: user.user, totals_by_cli: { token_usage: { prompt_tokens_sum: 5, output_tokens_sum: 5 } } })),
      }));
      await page.route('**/api/billing-credits-by-user?**', route => {
        const logins = new URL(route.request().url()).searchParams.get('logins')?.split(',') ?? [];
        return route.fulfill({
          json: {
            timePeriod: topUsers.timePeriod, enterprise: 'synthetic-ent',
            usageItems: users.filter(user => logins.includes(user.user)).map(user => ({
              user: user.user, model: 'synthetic-model', grossAmount: user.grossAmount,
              netAmount: user.netAmount, netQuantity: 10, discountQuantity: 0,
            })),
          },
        });
      });
      await page.route('**/api/billing-credits-top-users?**', route => {
        expect(new URL(route.request().url()).searchParams.get('metric')).toBe('auto');
        return route.fulfill({ json: topUsers });
      });

      await page.goto('/orgs/octo-demo-org?mock=true', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: 'billing', exact: true }).click();
      const metricLabel = metric === 'grossAmount' ? 'gross' : 'net';
      const card = page.locator('.v-card').filter({
        has: page.locator('.v-card-title').filter({ hasText: `Top spenders by ${metricLabel} cost` }),
      }).last();
      await expect(card).toBeVisible();
      await expect(card).toContainText('top 10 globally');
      const canvas = card.locator('canvas');
      await expect(canvas).toBeVisible();
      await canvas.scrollIntoViewIfNeeded();
      await expect(page.getByText('(25 of 600 loaded)', { exact: true })).toBeVisible();
      await expect(page.getByText('Total credits', { exact: true }).locator('..')).toContainText('6,000');

      await expect.poll(() => canvas.evaluate(element => {
        const entries = (window as unknown as ChartTestWindow).__billingChartText.get(element as HTMLCanvasElement) ?? [];
        return [...new Set(entries.filter(entry => entry.text.startsWith('user-')).map(entry => entry.text))];
      })).toEqual(topUsers.users.map(user => user.user));
      const hover = await canvas.evaluate(element => {
        const entries = (window as unknown as ChartTestWindow).__billingChartText.get(element as HTMLCanvasElement) ?? [];
        const first = entries.find(entry => entry.text.startsWith('user-'));
        if (!first) throw new Error('Chart has not drawn its ranked users');
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width * 0.6,
          y: rect.top + first.y * rect.height / (element as HTMLCanvasElement).height,
        };
      });
      await page.mouse.move(hover.x, hover.y);
      const datasetLabel = `${metricLabel === 'gross' ? 'Gross' : 'Net'} spend (USD)`;
      const amount = topUsers.users[0]![metric].toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      await expect.poll(() => canvas.evaluate(element =>
        ((window as unknown as ChartTestWindow).__billingChartText.get(element as HTMLCanvasElement) ?? [])
          .map(entry => entry.text),
      )).toContain(`${datasetLabel}: ${amount}`);
      if (process.env.PR429_SCREENSHOTS) {
        await card.screenshot({ path: `${process.env.PR429_SCREENSHOTS}/${metricLabel}-outlier-chart.png` });
        await page.screenshot({ path: `${process.env.PR429_SCREENSHOTS}/${metricLabel}-outlier-dashboard.png`, fullPage: true });
      }
    });
  }

  test('keeps global billing visible when the separate metrics roster is empty', async ({ page }) => {
    await page.route('**/api/user-metrics?**', route => route.fulfill({ json: [] }));
    await page.route('**/api/billing-credits-top-users?**', route => route.fulfill({
      json: {
        metric: 'grossAmount', timePeriod: {}, enterprise: 'synthetic-ent',
        users: [{ user: 'billing-only-outlier', grossAmount: 999999, netAmount: 0, credits: 10, models: 1 }],
      },
    }));
    await page.goto('/orgs/octo-demo-org?mock=true', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'billing', exact: true }).click();
    await expect(page.getByText('Top spenders by gross cost', { exact: false })).toBeVisible();
    await expect(page.locator('.v-card').filter({
      has: page.locator('.v-card-title').filter({ hasText: 'Top spenders by gross cost' }),
    }).last().locator('canvas')).toBeVisible();
  });

  for (const empty of [true, false]) {
    test(`shows a neutral state for ${empty ? 'empty' : 'zero-gross'} billing`, async ({ page }) => {
      await page.route('**/api/user-metrics?**', route => route.fulfill({ json: [] }));
      await page.route('**/api/billing-credits-top-users?**', route => route.fulfill({
        json: {
          metric: 'grossAmount', timePeriod: {}, enterprise: 'synthetic-ent',
          users: empty ? [] : [{ user: 'zero-user', grossAmount: 0, netAmount: 0, credits: 0, models: 0 }],
        },
      }));
      await page.goto('/orgs/octo-demo-org?mock=true', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: 'billing', exact: true }).click();
      await expect(page.getByText('No positive spend for this period.', { exact: true })).toBeVisible();
      const card = page.locator('.v-card').filter({
        has: page.locator('.v-card-title').filter({ hasText: 'Top spenders by gross cost' }),
      }).last();
      await expect(card.locator('canvas')).toHaveCount(0);
    });
  }
});
