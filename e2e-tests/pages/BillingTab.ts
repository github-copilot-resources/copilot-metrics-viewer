import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page object for the admin "billing" tab — exposes the AI-credit spend
 * summary tiles and the per-model usage table.
 */
export class BillingTab {
    readonly page: Page;

    readonly totalCreditsLabel: Locator;
    readonly grossCostLabel: Locator;
    readonly netCostLabel: Locator;
    readonly dataTable: Locator;
    readonly heading: Locator;

    constructor(page: Page) {
        this.page = page;
        this.totalCreditsLabel = page.getByText("Total credits", { exact: true });
        this.grossCostLabel = page.getByText("Gross cost (USD)", { exact: true });
        this.netCostLabel = page.getByText("Net cost (USD)", { exact: true });
        this.dataTable = page.locator(".v-data-table").first();
        this.heading = page.getByText("AI Credit Billing");
    }

    async expectVisible() {
        await expect(this.heading).toBeVisible();
        await expect(this.totalCreditsLabel).toBeVisible();
        await expect(this.grossCostLabel).toBeVisible();
        await expect(this.netCostLabel).toBeVisible();
    }

    async expectDataTableHasRows() {
        await expect(this.dataTable).toBeVisible();
        // v-data-table renders rows as <tr> within tbody.
        const rowCount = await this.dataTable.locator("tbody tr").count();
        expect(rowCount).toBeGreaterThan(0);
    }
}
