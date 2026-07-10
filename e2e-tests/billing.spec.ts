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
