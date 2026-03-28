import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { UserMetricsTab } from './pages/UserMetricsTab';

const tag = { tag: ['@org', '@user-metrics'] };

/**
 * Mock data users (from public/mock-data/new-api/organization-users-28-day-report.json):
 *   octocat    – 22 active days, 45 premium requests  (active ≥ 14 → "success" chip)
 *   octokitten – 18 active days, 28 premium requests  (active ≥ 14 → "success" chip)
 *   monalisa   –  5 active days,  0 premium requests  (occasional 1–6 → "warning" chip)
 */

test.describe('User Metrics tab', () => {
    // Run tests serially so that beforeAll context is re-created on retry and a
    // single failing test does not cascade to "browser has been closed" for the rest.
    test.describe.configure({ mode: 'serial' });

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

    // ── Tab visibility ────────────────────────────────────────────────────────────

    test('user metrics tab is visible', tag, async () => {
        await expect(dashboard.userMetricsTabLink).toBeVisible();
    });

    // ── Summary tiles ─────────────────────────────────────────────────────────────

    test('user metrics tab shows total users tile', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.expectTotalUsersVisible();
        await userMetrics.expectTotalUsersReturned();
    });

    test('user metrics tab shows active users tile', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.expectActiveUsersVisible();
        await userMetrics.expectActiveUsersReturned();
    });

    test('user metrics tab shows premium requests tile', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.expectPremiumRequestsVisible();
    });

    test('user metrics tab shows avg acceptance rate tile', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.expectAvgAcceptanceRateVisible();
        await userMetrics.expectAvgAcceptanceRateReasonable();
    });

    // ── Data table structure ──────────────────────────────────────────────────────

    test('user metrics tab shows data table', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.expectDataTableVisible();
    });

    test('user metrics table contains expected columns', tag, async () => {
        await dashboard.gotoUserMetricsTab();

        await expect(dashboard.page.getByText('Active Days', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('Interactions', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('Accept Rate', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('Premium Req.', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('Top IDE', { exact: true })).toBeVisible();
        await expect(dashboard.page.getByText('Top Language', { exact: true })).toBeVisible();
    });

    // ── Table row contents ────────────────────────────────────────────────────────

    test('user metrics table lists all mock users', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.expectUserInTable('octocat');
        await userMetrics.expectUserInTable('octokitten');
        await userMetrics.expectUserInTable('monalisa');
    });

    test('user metrics table shows octocat with acceptance rate', tag, async () => {
        await dashboard.gotoUserMetricsTab();

        // The Accept Rate column must contain a % value
        await expect(
            dashboard.page.locator('tbody tr').first().getByText(/%/)
        ).toBeVisible();
    });

    // ── Search ────────────────────────────────────────────────────────────────────

    test('search filters table to matching users', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.searchForUser('octocat');

        // octocat must be visible, monalisa must disappear
        await userMetrics.expectUserInTable('octocat');
        await userMetrics.expectUserNotInTable('monalisa');

        await userMetrics.clearSearch();
    });

    test('search with partial name returns matching users', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        // 'octo' matches both octocat and octokitten
        await userMetrics.searchForUser('octo');

        await userMetrics.expectUserInTable('octocat');
        await userMetrics.expectUserInTable('octokitten');
        await userMetrics.expectUserNotInTable('monalisa');

        await userMetrics.clearSearch();
    });

    // ── Activity filter ───────────────────────────────────────────────────────────

    test('activity filter "Active (≥ 7 days)" hides inactive/occasional users', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.filterByActivity('Active (≥ 7 days)');

        // octocat (22 days) and octokitten (18 days) are active ≥ 7
        await userMetrics.expectUserInTable('octocat');
        await userMetrics.expectUserInTable('octokitten');
        // monalisa (5 days) is occasional, not active ≥ 7
        await userMetrics.expectUserNotInTable('monalisa');

        // Reset
        await userMetrics.filterByActivity('All users');
    });

    test('activity filter "Occasional (1–6 days)" shows only occasional users', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.filterByActivity('Occasional (1–6 days)');

        // monalisa has 5 active days → occasional
        await userMetrics.expectUserInTable('monalisa');
        // octocat and octokitten are active ≥ 7, not occasional
        await userMetrics.expectUserNotInTable('octocat');
        await userMetrics.expectUserNotInTable('octokitten');

        // Reset
        await userMetrics.filterByActivity('All users');
    });

    // ── Premium filter ────────────────────────────────────────────────────────────

    test('premium filter "Has premium requests" hides users without premium usage', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.filterByPremium('Has premium requests');

        // octocat (45) and octokitten (28) have premium requests
        await userMetrics.expectUserInTable('octocat');
        await userMetrics.expectUserInTable('octokitten');
        // monalisa has 0 premium requests
        await userMetrics.expectUserNotInTable('monalisa');

        // Reset
        await userMetrics.filterByPremium('All users');
    });

    test('premium filter "No premium requests" shows only users with no premium usage', tag, async () => {
        const userMetrics = await dashboard.gotoUserMetricsTab();

        await userMetrics.filterByPremium('No premium requests');

        // monalisa has 0 premium requests
        await userMetrics.expectUserInTable('monalisa');
        await userMetrics.expectUserNotInTable('octocat');
        await userMetrics.expectUserNotInTable('octokitten');

        // Reset
        await userMetrics.filterByPremium('All users');
    });
});

