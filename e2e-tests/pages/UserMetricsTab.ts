import { expect, type Locator, type Page } from '@playwright/test';

export class UserMetricsTab {
    readonly page: Page;
    readonly totalUsersLabel: Locator;
    readonly totalUsersValue: Locator;
    readonly activeUsersLabel: Locator;
    readonly activeUsersValue: Locator;
    readonly avgAcceptanceRateLabel: Locator;
    readonly avgAcceptanceRateValue: Locator;
    readonly premiumRequestsLabel: Locator;
    readonly searchInput: Locator;
    readonly dataTable: Locator;
    readonly activityFilterSelect: Locator;
    readonly premiumFilterSelect: Locator;
    readonly tableBody: Locator;

    constructor(page: Page) {
        this.page = page;
        this.totalUsersLabel = page.getByText('Total Users', { exact: true });
        this.totalUsersValue = page
            .locator('.v-card-item')
            .filter({ has: page.getByText('Total Users', { exact: true }) })
            .locator('.text-h4');
        this.activeUsersLabel = page.getByText('Active Users', { exact: true });
        this.activeUsersValue = page
            .locator('.v-card-item')
            .filter({ has: page.getByText('Active Users', { exact: true }) })
            .locator('.text-h4');
        this.avgAcceptanceRateLabel = page.getByText('Avg Acceptance Rate', { exact: true });
        this.avgAcceptanceRateValue = page
            .locator('.v-card-item')
            .filter({ has: page.getByText('Avg Acceptance Rate', { exact: true }) })
            .locator('.text-h4');
        this.premiumRequestsLabel = page.getByText('Premium Requests', { exact: true });
        // Use getByPlaceholder() to target the search input directly by its placeholder
        // attribute. In Vuetify 3, single-line v-text-field suppresses the <label> element
        // entirely (hasLabel = !singleLine && ...), so label-based locators don't work.
        // The placeholder attribute is reliably rendered on the underlying <input> element
        // in all browsers and in both dev and production builds.
        this.searchInput = page.getByPlaceholder('Search users…');
        this.dataTable = page.locator('.v-data-table').first();
        this.tableBody = this.dataTable.locator('tbody');
        // Click the outer .v-select container, not just the inner <input>.
        // Vuetify 3's dropdown is opened by the click handler on the field wrapper;
        // clicking only the readonly <input> works in Chromium but not in Firefox/WebKit
        // because those browsers do not bubble the click to the parent handler.
        this.activityFilterSelect = page.locator('.v-select').filter({
            has: page.locator('label', { hasText: 'Activity filter' })
        });
        this.premiumFilterSelect = page.locator('.v-select').filter({
            has: page.locator('label', { hasText: 'Premium requests' })
        });
    }

    async expectTotalUsersVisible() {
        await expect(this.totalUsersLabel).toBeVisible();
    }

    async expectTotalUsersReturned() {
        const value = await this.totalUsersValue.textContent();
        expect(value).toBeDefined();
        expect(parseInt(value as string)).toBeGreaterThan(0);
    }

    async expectActiveUsersVisible() {
        await expect(this.activeUsersLabel).toBeVisible();
    }

    async expectActiveUsersReturned() {
        const value = await this.activeUsersValue.textContent();
        expect(value).toBeDefined();
        expect(parseInt(value as string)).toBeGreaterThanOrEqual(0);
    }

    async expectAvgAcceptanceRateVisible() {
        await expect(this.avgAcceptanceRateLabel).toBeVisible();
    }

    async expectAvgAcceptanceRateReasonable() {
        const text = await this.avgAcceptanceRateValue.textContent();
        expect(text).toBeDefined();
        const rate = parseFloat((text as string).replace('%', ''));
        expect(rate).toBeGreaterThan(0);
        expect(rate).toBeLessThanOrEqual(100);
    }

    async expectPremiumRequestsVisible() {
        await expect(this.premiumRequestsLabel).toBeVisible();
    }

    async expectDataTableVisible() {
        await expect(this.dataTable).toBeVisible();
    }

    /** Assert that a row containing the given login chip exists in the table. */
    async expectUserInTable(login: string) {
        await expect(
            this.tableBody.locator('.v-chip').filter({ hasText: login })
        ).toBeVisible();
    }

    /** Assert that no row with the given login chip is visible in the table. */
    async expectUserNotInTable(login: string) {
        await expect(
            this.tableBody.locator('.v-chip').filter({ hasText: login })
        ).not.toBeVisible();
    }

    async searchForUser(login: string) {
        await this.searchInput.fill(login);
        // Wait for the Vuetify data-table to apply the search filter
        await this.tableBody.waitFor({ state: 'visible' });
    }

    async clearSearch() {
        await this.searchInput.fill('');
        // Wait for the table to restore all rows
        await this.tableBody.waitFor({ state: 'visible' });
    }

    /**
     * Select an option from the Activity filter dropdown.
     * @param option Display text of the option, e.g. 'Active (≥ 7 days)'
     */
    async filterByActivity(option: string) {
        await this.activityFilterSelect.click();
        await this.page.getByRole('option', { name: option }).click();
        // Wait for the dropdown overlay to close before asserting table state.
        // The overlay may already be gone if the selection resolved instantly — swallowing
        // the timeout error is intentional here.
        await this.page.locator('.v-overlay--active').waitFor({ state: 'hidden' }).catch(() => {});
    }

    /**
     * Select an option from the Premium requests filter dropdown.
     * @param option Display text of the option, e.g. 'Has premium requests'
     */
    async filterByPremium(option: string) {
        await this.premiumFilterSelect.click();
        await this.page.getByRole('option', { name: option }).click();
        // Wait for the dropdown overlay to close before asserting table state.
        // The overlay may already be gone if the selection resolved instantly — swallowing
        // the timeout error is intentional here.
        await this.page.locator('.v-overlay--active').waitFor({ state: 'hidden' }).catch(() => {});
    }

    /** Return the number of data rows currently shown in the table. */
    async visibleRowCount(): Promise<number> {
        return this.tableBody.locator('tr').count();
    }
}
