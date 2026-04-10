import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Configurable Tabs', () => {
    test.describe.configure({ mode: 'serial' });

    let dashboard: DashboardPage;

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.goto('/orgs/octo-demo-org?mock=true');

        dashboard = new DashboardPage(page);

        // wait for the data
        await dashboard.expectMetricLabelsVisible();
    });

    test.afterAll(async () => {
        await dashboard?.close();
    });

    test('should hide the "agent activity" tab when configured via NUXT_PUBLIC_HIDDEN_TABS', async () => {
        const agentActivityTab = dashboard.page.getByRole('tab', { name: 'agent activity' });
        await expect(agentActivityTab).not.toBeVisible();
    });

    test('should still show other tabs that are not hidden', async () => {
        await expect(dashboard.languagesTabLink).toBeVisible();
        await expect(dashboard.editorsTabLink).toBeVisible();
        await expect(dashboard.copilotChatTabLink).toBeVisible();
        await expect(dashboard.seatAnalysisTabLink).toBeVisible();
        await expect(dashboard.userMetricsTabLink).toBeVisible();
        await expect(dashboard.apiResponseTabLink).toBeVisible();
    });

    test('should still show the organization scope tab', async () => {
        await expect(dashboard.orgTabLink).toBeVisible();
    });
});
