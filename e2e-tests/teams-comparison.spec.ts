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

        // Wait for teams dropdown to be visible
        const teamsDropdown = dashboard.page.getByRole('combobox').first();
        await expect(teamsDropdown).toBeVisible();

        // Click on the dropdown to open it
        await teamsDropdown.click();

        // Wait for team options to appear
        const teamOptions = dashboard.page.locator('[role="listbox"] [role="option"]');
        await expect(teamOptions.first()).toBeVisible();

        // Select at least 2 teams as requested in the comment
        // Get the first two team options
        const firstTeam = teamOptions.first();
        const secondTeam = teamOptions.nth(1);

        await firstTeam.click();
        await secondTeam.click();

        // Close dropdown by pressing Escape
        await dashboard.page.keyboard.press('Escape');

        // Verify that teams are selected
        const selectedTeamsSection = dashboard.page.locator('text=Selected Teams').first();
        await expect(selectedTeamsSection).toBeVisible();

        // Verify that team metrics cards are visible
        const teamsSelectedCard = dashboard.page.locator('text=Teams Selected').first();
        await expect(teamsSelectedCard).toBeVisible();

        const totalActiveUsersCard = dashboard.page.locator('text=Total Active Users').first();
        await expect(totalActiveUsersCard).toBeVisible();

        // Verify that charts are displayed
        const acceptanceRateChart = dashboard.page.locator('h2:has-text("Acceptance Rate by Count (%)")');
        await expect(acceptanceRateChart).toBeVisible();

        const languageUsageChart = dashboard.page.locator('text=Language Usage by Team');
        await expect(languageUsageChart).toBeVisible();

        const editorUsageChart = dashboard.page.locator('text=Editor Usage by Team');
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
        const emptyStateMessage = dashboard.page.locator('text=No Teams Selected');
        await expect(emptyStateMessage).toBeVisible();

        const emptyStateDescription = dashboard.page.locator('text=Select one or more teams from the dropdown above to view and compare their metrics.');
        await expect(emptyStateDescription).toBeVisible();
    });
});