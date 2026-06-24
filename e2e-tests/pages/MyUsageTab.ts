import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page object for the "my usage" tab — exposes the personal Copilot
 * activity tiles for the signed-in user (or the fixture user in mock mode).
 */
export class MyUsageTab {
    readonly page: Page;

    readonly activeDaysLabel: Locator;
    readonly interactionsLabel: Locator;
    readonly acceptedLinesLabel: Locator;
    readonly aiCreditsLabel: Locator;
    readonly userLoginHeading: Locator;

    constructor(page: Page) {
        this.page = page;
        this.activeDaysLabel = page.getByText("Active days", { exact: true });
        this.interactionsLabel = page.getByText("Interactions", { exact: true });
        this.acceptedLinesLabel = page.getByText("Accepted lines", { exact: true });
        this.aiCreditsLabel = page.getByText("AI credits used", { exact: true });
        // The signed-in user heading — text-h6 inside MyUsageViewer.vue
        this.userLoginHeading = page.locator(".v-main .text-h6").first();
    }

    async expectVisible() {
        await expect(this.activeDaysLabel).toBeVisible();
        await expect(this.interactionsLabel).toBeVisible();
        await expect(this.acceptedLinesLabel).toBeVisible();
        await expect(this.aiCreditsLabel).toBeVisible();
    }

    async expectShowsLogin(login: string) {
        // The login text is rendered as a heading next to an avatar inside
        // MyUsageViewer; an exact-match getByText is the most stable locator
        // (the page also has unrelated `.text-h6` elements like "Date Range Filter").
        await expect(this.page.getByText(login, { exact: true }).first()).toBeVisible();
    }

    /** Read the numeric value rendered under a given tile caption. */
    async readTile(caption: string): Promise<string> {
        const tile = this.page.locator(".v-card")
            .filter({ has: this.page.getByText(caption, { exact: true }) })
            .first();
        // The value sits in a `.text-h4` div within the tile.
        return (await tile.locator(".text-h4").first().textContent()) ?? "";
    }
}
