import { expect, test, type Page } from '@playwright/test'

const tag = { tag: ['@ent', '@org', '@team'] };

[
    { name: 'Teams', url: '/orgs/octodemo-org/team/the-a-team' },
    { name: 'Orgs', url: '/orgs/octodemo-org' },
    { name: 'Enterprises', url: '/enterprises/octo-enterprise' },
].forEach(({ name, url }) => {
    let dashboard: Page;

    test.beforeEach(async ({ page }) => {
        dashboard = page;

        await dashboard.goto(url);
        // wait for the data
        await expect(dashboard.getByText('Acceptance Rate (by count)')).toBeVisible();
    });

    test.describe('tests for ' + name, () => {

        test('metrics visible', tag, async () => {
            await expect(dashboard.getByText('Acceptance Rate (by count)')).toBeVisible();
            await expect(dashboard.getByText('Total count of Suggestions (Prompts)')).toBeVisible();
            await expect(dashboard.getByRole('heading', { name: 'Total Lines Suggested | Total' })).toBeVisible();
        });

        test('data returned', tag, async () => {
            // find card
            const acceptanceCard = dashboard.locator('.v-card-item').filter({ has: dashboard.getByText('Total Lines of code Suggested') });
            const linesAccepted = await acceptanceCard.locator('.text-h4').textContent();
            expect(linesAccepted).toBeDefined();
            expect(parseInt(linesAccepted as string)).toBeGreaterThan(0);

            await expect(dashboard.getByText('Acceptance Rate (by count)')).toBeVisible();
            await expect(dashboard.getByText('Total count of Suggestions (Prompts)')).toBeVisible();
            await expect(dashboard.getByRole('heading', { name: 'Total Lines Suggested | Total' })).toBeVisible();
        });

        test('languages visible', tag, async () => {
            await dashboard.getByRole('tab', { name: 'languages' }).click();
            await expect(dashboard.getByText('Top 5 Languages by accepted suggestions (prompts)')).toBeVisible();
        });

        test('editors visible', tag, async () => {
            await dashboard.getByRole('tab', { name: 'editors' }).click();
            await expect(dashboard.getByText('Number of Editors')).toBeVisible();
        });

        test('seat analysis visible', tag, async () => {
            await dashboard.getByRole('tab', { name: 'seat analysis' }).click();
            await expect(dashboard.getByText('Total Assigned')).toBeVisible();
        });
    })
});