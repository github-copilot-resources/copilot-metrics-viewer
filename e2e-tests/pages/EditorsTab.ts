import { expect, type Locator, type Page } from '@playwright/test';

export class EditorsTab {
    readonly page: Page;
    readonly numberOfEditorsLabel: Locator;
    readonly numberOfEditorsValue: Locator;

    constructor(page: Page) {
        this.page = page;
        this.numberOfEditorsLabel = page.getByText('Number of Editors')
        this.numberOfEditorsValue = page.locator('.v-card-item').filter({ has: this.numberOfEditorsLabel }).locator('.text-h4')

    }

    async expectNumberOfEditorsVisible() {
        await expect(this.numberOfEditorsLabel).toBeVisible();
    }

    async expectNumberOfEditorsReturned() {
        const numberOfEditors = await this.numberOfEditorsValue.textContent();
        expect(numberOfEditors).toBeDefined();
        expect(parseInt(numberOfEditors as string)).toBeGreaterThan(0);
    }
}