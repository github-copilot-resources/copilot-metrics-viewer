import { expect, type Locator, type Page } from '@playwright/test';

export class CopilotChatTab {
    readonly page: Page;
    readonly cumulativeNumberOfTurnsLabel: Locator;
    readonly cumulativeNumberOfTurnsValue: Locator;

    constructor(page: Page) {
        this.page = page;
        this.cumulativeNumberOfTurnsLabel = page.getByText('Cumulative Number of Turns')
        this.cumulativeNumberOfTurnsValue = page.locator('.v-card-item').filter({ has: this.cumulativeNumberOfTurnsLabel }).locator('.text-h4')

    }

    async expectCumulativeNumberOfTurnsVisible() {
        await expect(this.cumulativeNumberOfTurnsLabel).toBeVisible();
    }

    async expectCumulativeNumberOfTurnsReturned() {
        const numberOfTurns = await this.cumulativeNumberOfTurnsValue.textContent();
        expect(numberOfTurns).toBeDefined();
        expect(parseInt(numberOfTurns as string)).toBeGreaterThan(0);
    }
}