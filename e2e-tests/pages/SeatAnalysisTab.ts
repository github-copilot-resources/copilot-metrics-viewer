import { expect, type Locator, type Page } from '@playwright/test';

export class SeatAnalysisTab {
    readonly page: Page;
    readonly totalAssignedLabel: Locator;
    readonly totalAssignedValue: Locator;

    constructor(page: Page) {
        this.page = page;
        this.totalAssignedLabel = page.getByText('Total Assigned')
        this.totalAssignedValue = page.locator('.v-card-item').filter({ has: this.totalAssignedLabel }).locator('.text-h4')

    }

    async expectTotalAssignedVisible() {
        await expect(this.totalAssignedLabel).toBeVisible();
    }

    async expectTotalAssignedReturned() {
        const totalAssigned = await this.totalAssignedValue.textContent();
        expect(totalAssigned).toBeDefined();
        expect(parseInt(totalAssigned as string)).toBeGreaterThan(0);
    }
}