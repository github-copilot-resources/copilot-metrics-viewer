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

        // Wait for the team selection dropdown to be visible
        const teamsDropdown = dashboard.page.locator('input[role="combobox"]').first();
        await expect(teamsDropdown).toBeVisible();

        // Click on the dropdown to open it
        await teamsDropdown.click();

        // Wait for team options to appear and select first two teams
        // Use specific team names from mock data
        const theATeamOption = dashboard.page.getByText('The A Team');
        const devTeamOption = dashboard.page.getByText('Development Team');

        await expect(theATeamOption).toBeVisible();
        await theATeamOption.click();

        await expect(devTeamOption).toBeVisible(); 
        await devTeamOption.click();

        // Click outside to close dropdown
        await dashboard.page.locator('body').click();

        // Verify that teams are selected
        const selectedTeamsSection = dashboard.page.getByText('Selected Teams');
        await expect(selectedTeamsSection).toBeVisible();

        // Verify that team metrics cards are visible
        const teamsSelectedCard = dashboard.page.getByText('Teams Selected');
        await expect(teamsSelectedCard).toBeVisible();

        const totalActiveUsersCard = dashboard.page.getByText('Total Active Users');
        await expect(totalActiveUsersCard).toBeVisible();

        // Verify that charts are displayed
        const languageUsageChart = dashboard.page.getByText('Language Usage by Team');
        await expect(languageUsageChart).toBeVisible();

        const editorUsageChart = dashboard.page.getByText('Editor Usage by Team');
        await expect(editorUsageChart).toBeVisible();

        // Take a screenshot for documentation purposes
        await dashboard.page.screenshot({ 
            path: 'images/teams-comparison-test.png', 
            fullPage: true 
        });
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