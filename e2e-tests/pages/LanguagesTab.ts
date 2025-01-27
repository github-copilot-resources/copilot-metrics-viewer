import { expect, type Locator, type Page } from '@playwright/test';

export class LanguagesTab {
    readonly page: Page;
    readonly top5Languages: Locator;
    readonly numberOfLanguagesValue: Locator;

    constructor(page: Page) {
        this.page = page;
        this.top5Languages = page.getByText('Top 5 Languages by accepted suggestions (prompts)')
        this.numberOfLanguagesValue = page.locator('.v-card-item').filter({ has: page.getByText('Number of Languages') }).locator('.text-h4')

    }

    async expectTop5LanguagesVisible() {
        await expect(this.top5Languages).toBeVisible();
    }

    async expectNumberOfLanguagesReturned() {
        const numberOfLanguages = await this.numberOfLanguagesValue.textContent();
        expect(numberOfLanguages).toBeDefined();
        expect(parseInt(numberOfLanguages as string)).toBeGreaterThan(0);
    }
}