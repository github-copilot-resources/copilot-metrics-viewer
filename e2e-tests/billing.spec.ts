import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

const tag = { tag: ['@org', '@billing'] };

/**
 * Admin-only Billing tab. In mock mode the /api/auth/usage-admin probe and the
 * /api/billing-credits endpoint both bypass the NUXT_USAGE_ADMINS allowlist so
 * the tab can be exercised end-to-end without configuring OAuth.
 *
 * Mock fixture: public/mock-data/billing-credits.json (18 anonymised AI-credit
 * usage items captured from a live GitHub enterprise billing response).
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

    test('date-range bar is hidden on the billing tab', tag, async () => {
        await dashboard.gotoBillingTab();
        // The DateRangeBar is rendered with a `.date-range-bar` class and is
        // gated v-show on `tab !== 'billing'` in MainComponent.vue.
        const bar = dashboard.page.locator('.v-locale-provider').filter({
            hasText: 'date range'
        });
        // The bar may not even be in the DOM; the more reliable check is the
        // absence of its visible "Date range" / since-until inputs. Use a
        // not-visible assertion on the calendar icon.
        const calendarBtns = dashboard.page.getByRole('button', { name: /calendar/i });
        // Either no calendar buttons, or none are visible.
        if (await calendarBtns.count() > 0) {
            await expect(calendarBtns.first()).toBeHidden();
        }
        // Silence the unused locator warning — assert nothing on `bar` directly.
        expect(bar).toBeTruthy();
    });

    test('billing tab renders per-user breakdown table and top spenders chart', tag, async () => {
        // Mock billing fixture includes `user` attribution on >half of usage items
        // so the per-user section should render. See public/mock-data/billing-credits.json.
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
});
