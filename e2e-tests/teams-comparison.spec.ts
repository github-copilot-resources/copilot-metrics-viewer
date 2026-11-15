import { expect, test } from '@playwright/test'
import { DashboardPage } from './pages/DashboardPage';

const tag = { tag: ['@teams-comparison'] };

test('named team removal controls preserve the remaining comparison selection', async ({ page }) => {
    await page.goto('/orgs/mocked-org?mock=true');
    const dashboard = new DashboardPage(page);
    await dashboard.expectMetricLabelsVisible();
    await dashboard.gotoTeamsTab();
    const dropdown = page.getByRole('combobox').first();
    await dropdown.click();
    const options = page.getByRole('listbox');
    await options.getByText('The A Team', { exact: true }).click();
    await options.getByText('Development Team', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Comparison', { exact: true })).toBeVisible();
    const remove = page.getByRole('button', { name: 'Remove The A Team', exact: true });
    await remove.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Deep Dive', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Navigate to detailed metrics for Development Team', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove The A Team', exact: true })).toHaveCount(0);
    const deselect = page.getByRole('button', { name: 'Deselect team', exact: true });
    await deselect.focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('No Team Selected', { exact: true })).toBeVisible();
});

test.describe('Teams Comparison tests', () => {
    test.describe.configure({ mode: 'serial' });

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

    test('teams comparison empty state', tag, async () => {
        // Click on teams tab (no teams selected yet)
        await dashboard.gotoTeamsTab();

        // Verify empty state message when no teams are selected
        const emptyStateMessage = dashboard.page.getByText('No Team Selected');
        await expect(emptyStateMessage).toBeVisible();

        // Verify the helper text explaining the two modes
        const deepDiveHint = dashboard.page.getByText('1 team → Deep Dive');
        await expect(deepDiveHint).toBeVisible();

        const comparisonHint = dashboard.page.getByText('2+ teams → Comparison');
        await expect(comparisonHint).toBeVisible();
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

        // Verify comparison mode activated (Comparison chip visible)
        const comparisonChip = dashboard.page.getByText('Comparison', { exact: true });
        await expect(comparisonChip).toBeVisible();

        // Verify per-team summary cards are displayed
        const teamACard = dashboard.page.getByText('The A Team', { exact: true }).first();
        await expect(teamACard).toBeVisible();

        const devTeamCard = dashboard.page.getByText('Development Team', { exact: true }).first();
        await expect(devTeamCard).toBeVisible();

        // Verify the normalized comparison charts and new team-level views.
        await expect(dashboard.page.getByText('Editor Usage (% of interactions) — by Team')).toBeVisible();
        await expect(dashboard.page.getByText('Model Usage (% of interactions) — by Team')).toBeVisible();
        await expect(dashboard.page.getByText('Team leaderboard', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('Adoption heatmap', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('Agent share of Copilot-added LOC', { exact: true }).first()).toBeVisible();
        await expect(dashboard.page.getByText('Agent share of Copilot-added LOC — over time', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('Current-membership view:', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('AI lines of code', { exact: true })).toHaveCount(0);
        await expect(dashboard.page.getByText('AI LOC / person', { exact: true })).toHaveCount(0);
        await expect(dashboard.page.getByText('Merged PRs — team comparison', { exact: true })).toBeVisible();

        const teamPrPanels = dashboard.page.getByTestId('team-pr-weekly');
        await expect(teamPrPanels).toHaveCount(2);
        for (const panel of await teamPrPanels.all()) {
            await panel.getByRole('button', { name: 'Load PR data', exact: true }).click();
            await expect(panel.getByText('Weekly average', { exact: true })).toBeVisible();
            await expect(panel.getByText('Merged per person', { exact: true })).toBeVisible();
            const canvas = panel.locator('canvas');
            await expect(canvas).toBeVisible();
            await dashboard.page.waitForTimeout(500);
            const height = await canvas.evaluate(element => element.getBoundingClientRect().height);
            expect(height).toBeGreaterThan(100);
            expect(height).toBeLessThanOrEqual(260);
        }
        const tiles = dashboard.page.getByTestId('team-pr-merged-card');
        await expect(tiles).toHaveCount(2);
        for (let index = 0; index < 2; index++) {
            const total = await teamPrPanels.nth(index).getByTestId('team-pr-merged-total').innerText();
            await expect(tiles.nth(index).getByTestId('team-pr-merged-value')).toHaveText(total);
        }
        const leaderboard = dashboard.page.getByTestId('team-leaderboard');
        await leaderboard.getByRole('combobox').click();
        await dashboard.page.getByRole('option', { name: 'PRs Merged', exact: true }).click();
        await expect(leaderboard.locator('thead')).toContainText('PRs Merged');
        await expect(leaderboard.locator('tbody')).not.toContainText('Not loaded');
        await dashboard.page.setViewportSize({ width: 420, height: 800 });
        await dashboard.page.waitForTimeout(500);
        for (const canvas of await teamPrPanels.locator('canvas').all()) {
            expect(await canvas.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(260);
        }
        await dashboard.page.setViewportSize({ width: 1280, height: 720 });
    });

    test('PR cards and leaderboard clear on date changes, including returning to a previous range', tag, async () => {
        await dashboard.page.getByRole('button', { name: 'Show date range', exact: true }).click();
        const fromDate = dashboard.page.getByLabel('From Date', { exact: true });
        const originalFrom = await fromDate.inputValue();
        const nextDay = new Date(`${originalFrom}T00:00:00Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        await fromDate.fill(nextDay.toISOString().slice(0, 10));
        await dashboard.page.getByRole('button', { name: 'Apply', exact: true }).click();
        const cards = dashboard.page.getByTestId('team-pr-merged-value');
        await expect(cards).toHaveText(['—', '—']);
        await expect(dashboard.page.getByTestId('team-pr-weekly').locator('canvas')).toHaveCount(0);
        await fromDate.fill(originalFrom);
        await dashboard.page.getByRole('button', { name: 'Apply', exact: true }).click();
        await expect(cards).toHaveText(['—', '—']);
        const leaderboard = dashboard.page.getByTestId('team-leaderboard');
        await expect(leaderboard.locator('tbody')).toContainText('Not loaded');
        await dashboard.page.getByRole('button', { name: 'Hide date range', exact: true }).click();
    });

    test('QA team activity is filtered to its members', tag, async () => {
        await dashboard.page.getByRole('button', { name: /^clear all$/i }).click();
        const dropdown = dashboard.page.locator('[role="combobox"]').first();
        await dropdown.click();
        const responsePromise = dashboard.page.waitForResponse(response =>
            response.url().includes('/api/metrics?') && new URL(response.url()).searchParams.get('githubTeam') === 'qa-team'
        );
        await dashboard.page.locator('[role="listbox"]').getByText('QA Team', { exact: true }).click();
        const response = await responsePromise;
        expect(response.ok()).toBe(true);
        const data = await response.json();
        expect(data.teamMemberCount).toBe(3);
        expect(data.reportData.length).toBeGreaterThan(0);
        expect(data.reportData.some((day: { daily_active_users: number }) => day.daily_active_users > 0)).toBe(true);
        for (const day of data.reportData) {
            expect(day.daily_active_users).toBeLessThanOrEqual(data.teamMemberCount);
        }
    });
});