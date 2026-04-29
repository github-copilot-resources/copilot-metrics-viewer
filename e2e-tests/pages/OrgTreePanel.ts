import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page object for the OrgTreePanel sidebar component.
 *
 * Encapsulates locators and actions for:
 *   - Org Tree toggle button (in the User Metrics info card)
 *   - Search input (autocomplete)
 *   - Autocomplete dropdown items
 *   - Tree nodes
 *   - Selection chip (active filter)
 *   - Clear tree button
 */
export class OrgTreePanel {
    readonly page: Page;

    /** Org Tree toggle button visible when entraEnabled (incl. mock mode) */
    readonly toggleButton: Locator;

    /** Search autocomplete input inside the sidebar */
    readonly searchInput: Locator;

    /** Clear-tree (×) icon button in the tree header */
    readonly clearTreeButton: Locator;

    /** Selection chip shown when a node is selected */
    readonly selectionChip: Locator;

    /** Info/filter alert banner ("Showing N users under …") */
    readonly filterBanner: Locator;

    constructor(page: Page) {
        this.page = page;
        this.toggleButton = page.getByRole('button', { name: /org tree/i });
        // The autocomplete input is identified by its placeholder
        this.searchInput = page.getByPlaceholder('Start typing a name');
        // Clear-tree button: the × icon in the tree root row header
        this.clearTreeButton = page.locator('.org-tree-panel').getByTitle('Clear tree');
        // Selection chip: a primary-coloured closable chip inside the panel
        this.selectionChip = page.locator('.org-tree-panel .v-chip');
        // Filter banner rendered above the user table when a selection is active
        this.filterBanner = page.locator('.v-alert').filter({
            hasText: 'users under',
        });
    }

    /** Open the sidebar by clicking the toggle button. */
    async open() {
        await this.toggleButton.click();
        await this.searchInput.waitFor({ state: 'visible' });
    }

    /** Close the sidebar by clicking the toggle button again. */
    async close() {
        await this.toggleButton.click();
    }

    /**
     * Type a query into the search autocomplete and wait for results to appear.
     * Returns the visible autocomplete option locators.
     */
    async search(query: string): Promise<Locator> {
        await this.searchInput.fill(query);
        // Debounce is 300ms; wait for the option list to appear
        const optionList = this.page.locator('.v-overlay--active .v-list-item');
        await optionList.first().waitFor({ state: 'visible', timeout: 5000 });
        return optionList;
    }

    /** Click the first autocomplete result whose text contains `name`. */
    async selectPerson(name: string) {
        const option = this.page
            .locator('.v-overlay--active .v-list-item')
            .filter({ hasText: name });
        await option.first().click();
    }

    /**
     * Wait for the tree to load and show the root node with the given display name.
     */
    async waitForTreeRoot(displayName: string) {
        await expect(
            this.page.locator('.org-tree-panel').getByText(displayName)
        ).toBeVisible({ timeout: 8000 });
    }

    /** Click a tree node row identified by its display name. */
    async clickNode(displayName: string) {
        const row = this.page
            .locator('.org-node-row')
            .filter({ hasText: displayName });
        await row.first().click();
    }

    /** Close the selection chip (clears the current filter). */
    async closeSelectionChip() {
        await this.selectionChip.locator('.v-chip__close, [aria-label="Close chip"]').click();
    }

    /** Assert the "Showing N users under …" filter banner is visible. */
    async expectFilterBannerVisible() {
        await expect(this.filterBanner).toBeVisible();
    }

    /** Assert the filter banner is NOT visible (no active filter). */
    async expectFilterBannerHidden() {
        await expect(this.filterBanner).not.toBeVisible();
    }

    /** Assert the tree root header text is visible (tree is loaded). */
    async expectTreeVisible() {
        await expect(
            this.page.locator('.org-tree-panel .org-node')
        ).toBeVisible();
    }

    /** Assert the tree is NOT visible (after clear). */
    async expectTreeHidden() {
        await expect(
            this.page.locator('.org-tree-panel .org-node')
        ).not.toBeVisible();
    }

    /** Assert a tree node with `name` is visible in the panel. */
    async expectNodeVisible(name: string) {
        await expect(
            this.page.locator('.org-tree-panel .org-node-row').filter({ hasText: name })
        ).toBeVisible();
    }
}
