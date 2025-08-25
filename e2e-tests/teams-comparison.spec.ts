import { expect, test } from '@playwright/test'
import { DashboardPage } from './pages/DashboardPage';

const tag = { tag: ['@teams-comparison'] };

test.describe('Teams Comparison tests', () => {

    let dashboard: DashboardPage;

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.goto('/orgs/mocked-org?mock=true');

        dashboard = new DashboardPage(page);

        // wait for the data
        await dashboard.expectMetricLabelsVisible();
    });

    test.afterAll(async () => {
        await dashboard?.close();
    });

    test('has teams tab available', tag, async () => {
        // Verify that teams tab is visible for org scope
        await dashboard.expectTeamsTabVisible();
    });

    test('teams comparison functionality with team selection', tag, async () => {
        // Click on teams tab
        await dashboard.gotoTeamsTab();

        // Wait for the team selection combobox to be visible
        const teamsDropdown = dashboard.page.locator('[role="combobox"]').first();
        await expect(teamsDropdown).toBeVisible();

        // Click on the dropdown to open it
        await teamsDropdown.click();

        // Wait for the dropdown to expand and team options to appear
        await expect(dashboard.page.locator('[role="listbox"]')).toBeVisible();

        // Select teams using more specific selectors within the listbox
        const theATeamOption = dashboard.page.locator('[role="listbox"]').getByText('The A Team').first();

        await expect(theATeamOption).toBeVisible();
        await theATeamOption.click();

        await expect(teamsDropdown).toBeVisible();

        const devTeamOption = dashboard.page.locator('[role="listbox"]').getByText('Development Team').first();

        await expect(devTeamOption).toBeVisible();
        await devTeamOption.click();

        // Click outside the dropdown to close it
        await teamsDropdown.click();

        // Verify that teams are selected
        const selectedTeamsSection = dashboard.page.getByText('Selected Teams', { exact: true })
        await expect(selectedTeamsSection).toBeVisible();

        // Verify that team metrics cards are visible
        const teamsSelectedCard = dashboard.page.getByText('Teams Selected', { exact: true })
        await expect(teamsSelectedCard).toBeVisible();

        const totalActiveUsersCard = dashboard.page.locator('div.text-h6.mb-1', { hasText: 'Total Active Users' })
        await expect(totalActiveUsersCard).toBeVisible();

        // Verify that charts are displayed
        const languageUsageChart = dashboard.page.getByText('Language Usage by Team');
        await expect(languageUsageChart).toBeVisible();

        const editorUsageChart = dashboard.page.getByText('Editor Usage by Team');
        await expect(editorUsageChart).toBeVisible();

        // Take a screenshot for documentation purposes
        // await dashboard.page.screenshot({
        //     path: 'images/teams-comparison-test.png',
        //     fullPage: true
        // });
    });

    test('teams comparison empty state', tag, async () => {
        // Click on teams tab
        await dashboard.gotoTeamsTab();

        // Verify empty state message when no teams are selected
        const emptyStateMessage = dashboard.page.getByText('No Teams Selected');
        await expect(emptyStateMessage).toBeVisible();

        const emptyStateDescription = dashboard.page.getByText('Select one or more teams from the dropdown above to view and compare their metrics.');
        await expect(emptyStateDescription).toBeVisible();
    });
});