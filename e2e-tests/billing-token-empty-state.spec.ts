import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Top token users guidance', () => {
    for (const hasTokens of [false, true]) {
        test(`shows ${hasTokens ? 'the CLI token chart' : 'empty guidance'} without visiting User Metrics`, {
            tag: ['@org', '@billing'],
        }, async ({ page }, testInfo) => {
            await page.route('**/api/billing-user-page?*', async route => {
                const response = await route.fetch();
                expect(response.ok()).toBe(true);
                const result = await response.json();
                expect(result.rows.length).toBeGreaterThan(0);
                await route.fulfill({
                    response,
                    json: { ...result, rows: result.rows.map((user: Record<string, unknown>, index: number) => ({
                        ...user,
                        tokens: hasTokens && index === 0 ? 150 : 0,
                    })) },
                });
            });
            await page.goto('/orgs/octo-demo-org?mock=true');
            const dashboard = new DashboardPage(page);
            await expect(dashboard.billingTabLink).toBeVisible({ timeout: 15000 });
            await dashboard.gotoBillingTab();

            const card = page.locator('.v-card').filter({
                has: page.locator('.v-card-title').filter({ hasText: 'Top token users (CLI, current page)' }),
            }).last();
            await expect(card).toBeVisible();
            const guidance = card.getByTestId('billing-top-token-users-empty-state');
            if (hasTokens) {
                await expect(card.locator('canvas')).toBeVisible();
                await expect(guidance).toHaveCount(0);
            } else {
                await expect(guidance).toHaveText('No CLI token usage was reported on this page for the selected usage period.');
                await expect(card.locator('canvas')).toHaveCount(0);
            }
            await expect(page.getByText(/load the User Metrics tab/i)).toHaveCount(0);
            await expect(dashboard.userMetricsTabLink).toHaveAttribute('aria-selected', 'false');
            await card.screenshot({ path: testInfo.outputPath(hasTokens ? 'cli-token-chart.png' : 'cli-token-empty-guidance.png') });
        });
    }
});
