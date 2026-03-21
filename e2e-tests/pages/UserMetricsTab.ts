import { expect, type Locator, type Page } from '@playwright/test';

export class UserMetricsTab {
    readonly page: Page;
    readonly totalUsersLabel: Locator;
    readonly totalUsersValue: Locator;
    readonly premiumRequestsLabel: Locator;
    readonly searchInput: Locator;
    readonly dataTable: Locator;
    readonly activityFilterSelect: Locator;

    constructor(page: Page) {
        this.page = page;
        this.totalUsersLabel = page.getByText('Total Users');
        this.totalUsersValue = page
            .locator('.v-card-item')
            .filter({ has: this.totalUsersLabel })
            .locator('.text-h4');
        this.premiumRequestsLabel = page.getByText('Premium Requests', { exact: true });
        this.searchInput = page.getByLabel('Search users…');
        this.dataTable = page.locator('.v-data-table');
        this.activityFilterSelect = page.getByLabel('Activity filter');
    }

    async expectTotalUsersVisible() {
        await expect(this.totalUsersLabel).toBeVisible();
    }

    async expectTotalUsersReturned() {
        const value = await this.totalUsersValue.textContent();
        expect(value).toBeDefined();
        expect(parseInt(value as string)).toBeGreaterThan(0);
    }

    async expectPremiumRequestsVisible() {
        await expect(this.premiumRequestsLabel).toBeVisible();
    }

    async expectDataTableVisible() {
        await expect(this.dataTable).toBeVisible();
    }

    async searchForUser(login: string) {
        await this.searchInput.fill(login);
    }
}
