import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import type { BillingUsageItem } from '../server/api/billing-credits.get';

const tag = { tag: ['@org', '@billing'] };

test.describe('Billing credit semantics with synthetic inputs', () => {
    const scenarios = [
        { name: 'partial discounts', quantities: [[8, 2], [0, 5], [0, 0]], credits: ['10', '5', '0'], total: '15', gross: '$4.00', net: '$2.00' },
        { name: 'fully discounted', quantities: [[0, 10], [0, 5], [0, 0]], credits: ['10', '5', '0'], total: '15', gross: '$4.00', net: '$0.00' },
        { name: 'zero consumption', quantities: [[0, 0], [0, 0], [0, 0]], credits: ['0', '0', '0'], total: '0', gross: '$0.00', net: '$0.00' },
    ];
    const logins = ['synthetic-a', 'synthetic-b', 'synthetic-zero'];
    const explanations = [
        ['Total credits', /net billed quantity plus discounted quantity/],
        ['Gross cost (USD)', /list-price USD amount before discounts/],
        ['Net cost (USD)', /USD amount after discounts are applied/],
    ] as const;

    for (const scenario of scenarios) {
        test(`${scenario.name}: tiles, lazy user rows, source and hover tooltips reconcile`, tag, async ({ page }) => {
            const items: BillingUsageItem[] = scenario.quantities.map(([net = 0, discount = 0], i) => ({
                product: i === 1 ? 'coding_agent' : 'copilot',
                sku: i === 1 ? 'coding_agent_ai_credit' : 'copilot_ai_credit',
                model: `synthetic-model-${i}`, unitType: 'credits', pricePerUnit: 0.1,
                grossQuantity: net + discount + (net + discount !== 0 ? 1 : 0),
                grossAmount: net + discount === 0 ? 0 : i === 0 ? 3 : 1,
                discountQuantity: discount,
                discountAmount: net === 0 ? (net + discount === 0 ? 0 : i === 0 ? 3 : 1) : 1,
                netQuantity: net, netAmount: net === 0 ? 0 : 2, user: logins[i],
            }));
            await page.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.origin !== new URL(test.info().project.use.baseURL as string).origin) return route.abort();
                const fulfill = (body: unknown, headers = {}) => route.fulfill({
                    status: 200, contentType: 'application/json', headers, body: JSON.stringify(body),
                });
                if (url.pathname === '/api/user-metrics') {
                    return fulfill(logins.map(login => ({ login, totals_by_cli: { token_usage: { prompt_tokens_sum: 1000, output_tokens_sum: 500 } } })));
                }
                if (url.pathname === '/api/billing-user-page') {
                    return fulfill({
                        rows: items.map(item => ({
                            user: item.user, tokens: 1500, credits: item.netQuantity + item.discountQuantity,
                            grossAmount: item.grossAmount, netAmount: item.netAmount, models: 1, billingState: 'loaded',
                        })),
                        total: items.length, page: 1, itemsPerPage: 25, version: 'synthetic', billingSortAvailable: true,
                    });
                }
                if (url.pathname === '/api/billing-credits' || url.pathname === '/api/billing-credits-by-user') {
                    const timePeriod = { year: Number(url.searchParams.get('year')), month: Number(url.searchParams.get('month')) };
                    const usageItems = url.pathname.endsWith('-by-user')
                        ? items.filter(item => (url.searchParams.get('logins') || '').split(',').includes(item.user!))
                        : items.map(item => ({ ...item, user: undefined }));
                    return fulfill({ timePeriod, usageItems }, {
                        'x-data-source': scenario.name === 'partial discounts' ? 'live' : 'db',
                    });
                }
                return route.continue();
            });
            await page.goto('/orgs/synthetic-org?mock=true');
            await page.getByRole('tab', { name: 'billing', exact: true }).click();
            const tile = (name: string) => page.locator('.v-card').filter({
                has: page.getByText(name, { exact: true }),
            }).filter({ has: page.locator('.text-h5') }).last();
            await expect(tile('Total credits').locator('.text-h5')).toHaveText(scenario.total);
            await expect(tile('Gross cost (USD)').locator('.text-h5')).toHaveText(scenario.gross);
            await expect(tile('Net cost (USD)').locator('.text-h5')).toHaveText(scenario.net);
            const perUser = page.locator('.v-card').filter({
                has: page.locator('.v-card-title').filter({ hasText: 'Per-user breakdown' }),
            }).last();
            for (let i = 0; i < logins.length; i++) {
                const row = perUser.getByRole('row').filter({ hasText: logins[i] });
                await expect(row.locator('td').nth(1)).toHaveText(scenario.credits[i]!);
                await expect(row.locator('td').nth(2)).toHaveText('1,500');
            }
            for (const [label, meaning] of explanations) {
                await tile(label).locator('.v-icon').hover();
                const content = page.getByRole('tooltip').filter({ hasText: meaning }).locator('.v-overlay__content');
                await expect(content).toBeVisible();
                await expect(content).toContainText(scenario.name === 'partial discounts' ? 'GitHub Billing API' : 'Billing CSV ingest');
                const period = await tile(label).locator('.text-medium-emphasis').textContent();
                await expect(content).toContainText(period!.split(' · ')[1]!);
                await page.screenshot({
                    animations: 'disabled',
                    path: `${process.env.PR425_SCREENSHOT_DIR || test.info().outputDir}/${test.info().project.name}-${scenario.name.replaceAll(' ', '-')}-${label.split(' ')[0]!.toLowerCase()}-tooltip.png`,
                });
                await tile(label).locator('.text-h5').hover();
                await expect(content).toBeHidden();
            }
            await expect(page.getByText('Loading billing data…', { exact: true })).toBeHidden();
            await expect(page.getByText(/Failed to load billing/i)).toBeHidden();
        });
    }

    test('aggregate tooltips can be reached, dismissed and read again using only the keyboard', tag, async ({ page }) => {
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== new URL(test.info().project.use.baseURL as string).origin) return route.abort();
            if (url.pathname.startsWith('/api/billing-credits')) {
                return route.fulfill({
                    contentType: 'application/json', headers: { 'x-data-source': 'db' },
                    body: JSON.stringify({ timePeriod: { year: 2026, month: 11 }, usageItems: [{
                        product: 'copilot', sku: 'copilot_ai_credit', model: 'synthetic-model',
                        unitType: 'credits', pricePerUnit: 0.1, grossQuantity: 11, grossAmount: 1.1,
                        netQuantity: 8, discountQuantity: 2, discountAmount: 0.2, netAmount: 0.9,
                    }] }),
                });
            }
            if (url.pathname === '/api/user-metrics') {
                return route.fulfill({ contentType: 'application/json', body: '[]' });
            }
            return route.continue();
        });
        await page.goto('/orgs/synthetic-org?mock=true');
        await page.getByRole('tab', { name: 'billing', exact: true }).click();
        for (const [label, meaning] of explanations) {
            const tile = page.locator('.v-card').filter({ has: page.getByText(label, { exact: true }) })
                .filter({ has: page.locator('.text-h5') }).last();
            const activator = tile.locator('[aria-describedby]');
            await expect(activator).toBeVisible();
            let reached = false;
            for (let i = 0; i < 60; i++) {
                await page.keyboard.press('Tab');
                if (await activator.evaluate(element => element === document.activeElement)) {
                    reached = true;
                    break;
                }
            }
            expect(reached, `${label} tooltip must be in the native keyboard focus order`).toBe(true);
            await expect(activator).toHaveRole('button');
            await expect(activator).toHaveAccessibleName(`About ${label.toLowerCase()}`);
            const content = page.getByRole('tooltip').filter({ hasText: meaning }).locator('.v-overlay__content');
            await expect(content).toBeVisible();
            await expect(content).toContainText('Billing CSV ingest');
            const period = await tile.locator('.text-medium-emphasis').textContent();
            await expect(content).toContainText(period!.split(' · ')[1]!);
            await page.screenshot({
                animations: 'disabled',
                path: `${process.env.PR425_SCREENSHOT_DIR || test.info().outputDir}/${test.info().project.name}-${label.split(' ')[0]!.toLowerCase()}-keyboard-tooltip.png`,
            });
            await page.keyboard.press('Tab');
            await expect(content).toBeHidden();
            await page.keyboard.press('Shift+Tab');
            await expect(activator).toBeFocused();
            await expect(content).toBeVisible();
            await page.keyboard.press('Tab');
            await expect(content).toBeHidden();
            await page.keyboard.press('Shift+Tab');
        }
    });
});

/**
 * Admin-only Billing tab. In mock mode the /api/auth/usage-admin probe and the
 * /api/billing-credits endpoint both bypass the NUXT_USAGE_ADMINS allowlist so
 * the tab can be exercised end-to-end without configuring OAuth.
 *
 * Aggregate mock: public/mock-data/billing-credits.json (synthetic AI-credit
 * arithmetic and an unattributed live-shaped envelope). Per-user views use
 * billing-credits-synthetic-attribution-demo.json, not verified live records.
 */
test.describe('Billing tab', () => {
    test.describe.configure({ mode: 'serial' });

    let dashboard: DashboardPage;

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.goto('/orgs/octo-demo-org?mock=true');

        dashboard = new DashboardPage(page);
        await dashboard.expectMetricLabelsVisible();
    });

    test.afterAll(async () => {
        await dashboard?.close();
    });

    test('billing tab is visible after admin probe succeeds', tag, async () => {
        // The tab is inserted async by MainComponent.mounted() once the probe
        // returns {isUsageAdmin:true}. Wait up to 15s for it to appear.
        await expect(dashboard.billingTabLink).toBeVisible({ timeout: 15000 });
    });

    test('billing tab shows summary tiles and table', tag, async () => {
        const billing = await dashboard.gotoBillingTab();
        await billing.expectVisible();
        await billing.expectDataTableHasRows();
    });

    test('billing tiles show non-zero totals from the fixture', tag, async () => {
        const billing = await dashboard.gotoBillingTab();

        const totalCredits = await billing.totalCreditsLabel
            .locator('xpath=ancestor::*[contains(@class,"v-card")][1]')
            .locator('.text-h5').first().textContent();
        expect(totalCredits).toBeTruthy();
        const credits = parseFloat((totalCredits as string).replace(/,/g, ''));
        expect(credits).toBeGreaterThan(0);

        const grossCost = await billing.grossCostLabel
            .locator('xpath=ancestor::*[contains(@class,"v-card")][1]')
            .locator('.text-h5').first().textContent();
        expect(grossCost).toBeTruthy();
        // Format: "$12.34"
        const gross = parseFloat((grossCost as string).replace(/[$,]/g, ''));
        expect(gross).toBeGreaterThan(0);
    });

    test('billing table renders model and product columns', tag, async () => {
        await dashboard.gotoBillingTab();
        // The mock fixture uses the GitHub Billing API field names — v-data-table
        // generates column headers by titleising the field keys.
        // Use exact:true to avoid matching "Models" (per-user breakdown column).
        await expect(dashboard.page.getByRole('columnheader', { name: 'Model', exact: true })).toBeVisible();
        await expect(dashboard.page.getByRole('columnheader', { name: 'Product' })).toBeVisible();
    });

    test('Month view toggle is checked by default and shows the month picker', tag, async () => {
        const billing = await dashboard.gotoBillingTab();
        await expect(billing.monthViewToggle).toBeVisible();
        await expect(billing.monthViewToggle).toBeChecked();
        // Month picker + prev/next buttons are only rendered when Month view is on.
        await expect(billing.monthPicker).toBeVisible();
        await expect(billing.rangeCaption).toBeHidden();
    });

    test('unchecking Month view hides the month picker and shows the dashboard-range caption', tag, async () => {
        const billing = await dashboard.gotoBillingTab();
        // Start from the default (checked); uncheck to switch to range mode.
        await billing.monthViewToggle.uncheck();
        await expect(billing.monthViewToggle).not.toBeChecked();
        await expect(billing.monthPicker).toBeHidden();
        await expect(billing.rangeCaption).toBeVisible();
        // Re-checking restores the month picker.
        await billing.monthViewToggle.check();
        await expect(billing.monthPicker).toBeVisible();
        await expect(billing.rangeCaption).toBeHidden();
    });

    test('global date-range selector is visible on the Billing tab (so range mode is usable)', tag, async () => {
        await dashboard.gotoBillingTab();
        // Prior behavior hid the DateRangeSelector on this tab; with the Month
        // view toggle, the tab now uses it when Month view is unchecked, so
        // the selector must be present in the DOM and visible.
        const rangeSelector = dashboard.page.locator('.date-range-selector, [data-testid="date-range-selector"]').first();
        // Fallback: the selector renders a "Date range" label somewhere.
        const hasSelector = (await rangeSelector.count()) > 0
            || (await dashboard.page.getByText(/date range/i).first().count()) > 0;
        expect(hasSelector).toBe(true);
    });

    test('billing tab renders per-user breakdown table and top spenders chart', tag, async () => {
        // Per-user attribution comes from the separate, unverified synthetic demo.
        await dashboard.gotoBillingTab();
        const perUserTitle = dashboard.page.locator('.v-card-title').filter({ hasText: 'Per-user breakdown' }).first();
        await expect(perUserTitle).toBeVisible();
        const perUserCard = perUserTitle.locator('xpath=ancestor::*[contains(@class,"v-card")][1]');
        await expect(perUserCard.locator('tbody tr').first()).toBeVisible();

        const topTitle = dashboard.page.locator('.v-card-title').filter({ hasText: 'Top spenders by net cost' }).first();
        await expect(topTitle).toBeVisible();
        const topCard = topTitle.locator('xpath=ancestor::*[contains(@class,"v-card")][1]');
        await expect(topCard.locator('canvas')).toBeVisible();
    });

    test('clicking a user in the per-user breakdown reveals the inline User insights section', tag, async () => {
        // Admin drill-down: each username in the Per-user breakdown table is a
        // clickable chip. Clicking swaps the "User insights" section from an
        // info banner to <MyUsageViewer> for the selected user. Server enforces
        // requireUsageAdmin — the Billing tab itself is already admin-gated so
        // no extra frontend guard is needed.
        await dashboard.gotoBillingTab();

        const perUserTitle = dashboard.page.locator('.v-card-title').filter({ hasText: 'Per-user breakdown' }).first();
        await expect(perUserTitle).toBeVisible();
        const perUserCard = perUserTitle.locator('xpath=ancestor::*[contains(@class,"v-card")][1]');

        // User insights section starts collapsed to an info banner.
        const insights = dashboard.page.locator('[data-testid="user-insights-section"]');
        await expect(insights).toBeVisible();
        await expect(insights.getByText(/Select a user from the table above/i)).toBeVisible();

        // Grab the first row's user chip and its displayed login text.
        const firstUserChip = perUserCard.locator('tbody tr').first().locator('td').first().locator('.v-chip');
        await expect(firstUserChip).toBeVisible();
        const clickedLogin = (await firstUserChip.textContent())?.trim() || '';
        expect(clickedLogin.length).toBeGreaterThan(0);

        await firstUserChip.click();

        // Info banner is replaced by MyUsageViewer for the clicked user.
        await expect(insights.getByText(/Select a user from the table above/i)).toBeHidden();
        await expect(insights.getByText(clickedLogin, { exact: false }).first()).toBeVisible({ timeout: 5000 });

        // Personal metrics render inline — Active days tile is a stable
        // landmark from MyUsageViewer.
        await expect(insights.getByText('Active days').first()).toBeVisible({ timeout: 8000 });

        // Clear selection and confirm the info banner is back.
        await insights.locator('[data-testid="user-detail-close"]').click();
        await expect(insights.getByText(/Select a user from the table above/i)).toBeVisible({ timeout: 3000 });
    });
});
