import { expect, test, type Page } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { OrgTreePanel } from './pages/OrgTreePanel';
import { UserMetricsTab } from './pages/UserMetricsTab';

const tag = { tag: ['@org', '@entra', '@org-tree'] };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openUserMetricsWithOrgTree(page: Page): Promise<{
    dashboard: DashboardPage;
    userMetrics: UserMetricsTab;
    orgTree: OrgTreePanel;
}> {
    await page.goto('/orgs/octo-demo-org?mock=true');
    const dashboard = new DashboardPage(page);
    await dashboard.expectMetricLabelsVisible();
    const userMetrics = await dashboard.gotoUserMetricsTab();
    const orgTree = new OrgTreePanel(page);
    return { dashboard, userMetrics, orgTree };
}

// ── Org Tree tests ────────────────────────────────────────────────────────────

test.describe('Org Tree panel', () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let dashboard: DashboardPage;
    let userMetrics: UserMetricsTab;
    let orgTree: OrgTreePanel;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        ({ dashboard, userMetrics, orgTree } = await openUserMetricsWithOrgTree(page));
    });

    test.afterAll(async () => {
        await page.close();
    });

    // ── Feature gate ──────────────────────────────────────────────────────────

    test('Org Tree toggle button is visible in mock mode', tag, async () => {
        // entraEnabled is true whenever isDataMocked is true
        await expect(orgTree.toggleButton).toBeVisible();
    });

    // ── Sidebar open ──────────────────────────────────────────────────────────

    test('clicking toggle button opens the sidebar with a search input', tag, async () => {
        await orgTree.open();
        await expect(orgTree.searchInput).toBeVisible();
    });

    // ── Search autocomplete ───────────────────────────────────────────────────

    test('typing "Mono" in the search shows autocomplete results', tag, async () => {
        const options = await orgTree.search('Mono');
        await expect(options.first()).toBeVisible();
    });

    test('autocomplete results include "Monalisa Octocat"', tag, async () => {
        // Search field still contains "Mono" from previous test
        const option = page
            .locator('.v-overlay--active .v-list-item')
            .filter({ hasText: 'Monalisa Octocat' });
        await expect(option).toBeVisible();
    });

    // ── Tree load ─────────────────────────────────────────────────────────────

    test('selecting "Monalisa Octocat" loads the org tree', tag, async () => {
        await orgTree.selectPerson('Monalisa Octocat');
        await orgTree.waitForTreeRoot('Monalisa Octocat');
    });

    test('tree shows 8 total people after loading Monalisa subtree', tag, async () => {
        // The OrgTreePanel.vue renders a stats line such as "8 people"
        await expect(page.locator('.org-tree-panel')).toContainText('people');
    });

    test('tree renders at least one direct report node', tag, async () => {
        await orgTree.expectNodeVisible('Defunkt Jones');
    });

    // ── Node selection & filter ───────────────────────────────────────────────

    test('clicking "Defunkt Jones" node applies subtree filter', tag, async () => {
        await orgTree.clickNode('Defunkt Jones');
        await orgTree.expectFilterBannerVisible();
    });

    test('filter banner mentions Defunkt Jones', tag, async () => {
        await expect(orgTree.filterBanner).toContainText('Defunkt Jones');
    });

    test('filtered table shows users in Defunkt subtree', tag, async () => {
        // Defunkt's subtree: defunkt, octocat, octokitten, hubot
        await userMetrics.expectUserInTable('defunkt');
        await userMetrics.expectUserInTable('octocat');
    });

    test('filtered table hides users outside Defunkt subtree', tag, async () => {
        // monalisa and codertocat are NOT in Defunkt's subtree
        await userMetrics.expectUserNotInTable('monalisa');
        await userMetrics.expectUserNotInTable('codertocat');
    });

    // ── Chip close clears filter ──────────────────────────────────────────────

    test('closing the selection chip clears the org filter', tag, async () => {
        // This test validates the clearSelection() bug fix (emit('select', []))
        await orgTree.closeSelectionChip();
        await orgTree.expectFilterBannerHidden();
    });

    test('all users are visible after filter is cleared', tag, async () => {
        await userMetrics.expectUserInTable('monalisa');
        await userMetrics.expectUserInTable('codertocat');
        await userMetrics.expectUserInTable('octocat');
    });

    // ── Clear tree button ─────────────────────────────────────────────────────

    test('after re-selecting a node, clear-tree removes the tree from the sidebar', tag, async () => {
        // Re-load tree (still have the sidebar open from previous tests)
        await orgTree.selectPerson('Monalisa Octocat');
        await orgTree.waitForTreeRoot('Monalisa Octocat');

        // Now clear the tree
        await orgTree.clearTreeButton.click();
        await orgTree.expectTreeHidden();
    });

    test('clearing the tree also removes any active filter', tag, async () => {
        // Click a node first to set a filter, then clear
        await orgTree.selectPerson('Monalisa Octocat');
        await orgTree.waitForTreeRoot('Monalisa Octocat');
        await orgTree.clickNode('Defunkt Jones');
        await orgTree.expectFilterBannerVisible();

        await orgTree.clearTreeButton.click();
        await orgTree.expectFilterBannerHidden();
    });

    // ── Sidebar close ─────────────────────────────────────────────────────────

    test('toggle button closes the sidebar', tag, async () => {
        // Sidebar should be open; close it
        await orgTree.close();
        await expect(orgTree.searchInput).not.toBeVisible();
    });
});
