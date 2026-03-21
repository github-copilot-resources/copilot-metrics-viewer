import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

const tag = { tag: ['@org', '@user-metrics'] };

let dashboard: DashboardPage;

test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/orgs/octo-demo-org?mock=true');

    dashboard = new DashboardPage(page);

    // wait for the main metrics data first
    await dashboard.expectMetricLabelsVisible();
});

test.afterAll(async () => {
    await dashboard?.close();
});

test('user metrics tab is visible', tag, async () => {
    await expect(dashboard.userMetricsTabLink).toBeVisible();
});

test('user metrics tab shows total users tile', tag, async () => {
    const userMetrics = await dashboard.gotoUserMetricsTab();

    await userMetrics.expectTotalUsersVisible();
    await userMetrics.expectTotalUsersReturned();
});

test('user metrics tab shows premium requests tile', tag, async () => {
    const userMetrics = await dashboard.gotoUserMetricsTab();

    await userMetrics.expectPremiumRequestsVisible();
});

test('user metrics tab shows data table', tag, async () => {
    const userMetrics = await dashboard.gotoUserMetricsTab();

    await userMetrics.expectDataTableVisible();
});

test('user metrics table contains expected columns', tag, async () => {
    const userMetrics = await dashboard.gotoUserMetricsTab();

    await expect(dashboard.page.getByText('Active Days')).toBeVisible();
    await expect(dashboard.page.getByText('Interactions')).toBeVisible();
    await expect(dashboard.page.getByText('Accept Rate')).toBeVisible();
    await expect(dashboard.page.getByText('Premium Req.')).toBeVisible();
    await expect(dashboard.page.getByText('Top IDE')).toBeVisible();
    await expect(dashboard.page.getByText('Top Language')).toBeVisible();
});
