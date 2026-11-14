import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { UserMetricsTab } from './pages/UserMetricsTab';

const tag = { tag: ['@org', '@user-metrics'] };

test.describe('Accessible activity controls', () => {
    test('activity bands remain visible without color and support keyboard filtering and trends', async ({ page }, testInfo) => {
        const bands = [
            [0, 'Inactive'], [1, 'Low'], [6, 'Low'], [7, 'Medium'],
            [13, 'Medium'], [14, 'High'], [28, 'High'],
        ] as const;
        // The Docker app is built without historical mode. Model a historical
        // deployment explicitly; mocking its endpoint alone does not enable it.
        await page.route(/\/orgs\/octo-demo-org\?mock=true$/, async route => {
            const response = await route.fetch();
            const document = await response.text();
            expect(document).toMatch(/\benableHistoricalMode:(?:true|false)\b/);
            await route.fulfill({
                response,
                body: document.replace(/\benableHistoricalMode:(?:true|false)\b/, 'enableHistoricalMode:true'),
            });
        });
        await page.route(/\/api\/user-metrics(?:\?|$)/, async route => {
            const response = await route.fetch();
            const [user] = await response.json();
            await route.fulfill({
                response,
                json: bands.map(([days]) => ({
                    ...user, login: `activity-${days}`, user_id: days + 100,
                    total_active_days: days,
                })),
            });
        });
        let historyRequested = false;
        let trendLogin: string | null = null;
        await page.route(/\/api\/user-metrics-history(?:\?|$)/, async route => {
            const login = new URL(route.request().url()).searchParams.get('login');
            if (login) trendLogin = login;
            else historyRequested = true;
            await route.fulfill({ json: login ? [] : [{
                report_start_day: '2026-04-01', report_end_day: '2026-04-28',
                total_users: bands.length, active_users: 4, avg_acceptance_rate: 10,
            }] });
        });
        await page.goto('/orgs/octo-demo-org?mock=true');
        const dashboard = new DashboardPage(page);
        await dashboard.expectMetricLabelsVisible();
        await dashboard.userMetricsTabLink.click();
        for (const [days, band] of bands) {
            const chip = page.getByRole('button', { name: `Activity: ${band} for activity-${days}, ${days} active days. Click to filter charts`, exact: true });
            await expect(chip).toBeVisible();
            await expect(chip).toContainText(`activity-${days} (${band})`);
        }
        await expect.poll(() => historyRequested).toBe(true);
        const grayscale = await page.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' });
        const activityScreenshot = testInfo.outputPath('activity-bands-grayscale.png');
        await page.locator('.v-data-table').filter({ has: page.getByRole('button', { name: /^Activity: Inactive for activity-0,/ }) }).screenshot({ path: activityScreenshot, animations: 'disabled' });
        await testInfo.attach('activity-bands-grayscale', {
            path: activityScreenshot, contentType: 'image/png',
        });
        await grayscale.evaluate(element => element.parentNode?.removeChild(element));
        const chip = page.getByRole('button', { name: /^Activity: High for activity-14,/ });
        await chip.focus();
        await expect(chip).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(chip).toHaveAccessibleName(/Click to clear filter$/);
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByText('activity-14 — User Insights', { exact: true })).toBeVisible();
        await expect(page.getByText('activity-14', { exact: true })).toBeVisible();
        await page.keyboard.press('Space');
        await expect(chip).toHaveAccessibleName(/Click to filter charts$/);
        await expect(chip).toHaveAttribute('aria-pressed', 'false');

        const trend = page.getByRole('button', { name: 'View trend for activity-14', exact: true });
        await trend.focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => trendLogin).toBe('activity-14');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('Activity Trend — activity-14');
        const close = dialog.getByRole('button', { name: 'Close activity trend dialog' });
        await close.focus();
        await page.keyboard.press('Space');
        await expect(dialog).not.toBeVisible();
    });

    test('toolbar action names follow their state and the brand is not a fake home control', async ({ page }, testInfo) => {
        await page.goto('/orgs/octo-demo-org?mock=true');
        await new DashboardPage(page).expectMetricLabelsVisible();
        await expect(page.getByRole('button', { name: 'GitHub Copilot Metrics Viewer home' })).toHaveCount(0);
        await expect(page.locator('.app-toolbar').getByRole('button', { name: '', exact: true })).toHaveCount(0);
        const dateToggle = page.getByRole('button', { name: /^(Show|Hide) date range$/ });
        const initialDateName = await dateToggle.getAttribute('aria-label');
        await dateToggle.focus();
        await page.keyboard.press('Enter');
        await expect(dateToggle).toHaveAccessibleName(initialDateName === 'Show date range' ? 'Hide date range' : 'Show date range');
        await page.keyboard.press('Space');
        await expect(dateToggle).toHaveAccessibleName(initialDateName!);
        const themeToggle = page.getByRole('button', { name: /^Switch to (light|dark) mode$/ });
        const initialThemeName = await themeToggle.getAttribute('aria-label');
        await themeToggle.focus();
        await page.keyboard.press('Enter');
        await expect(themeToggle).toHaveAccessibleName(initialThemeName === 'Switch to light mode' ? 'Switch to dark mode' : 'Switch to light mode');
        await page.keyboard.press('Space');
        await expect(themeToggle).toHaveAccessibleName(initialThemeName!);
        await page.getByRole('button', { name: 'Open authentication information' }).click();
        await expect(page.getByRole('dialog')).toContainText('Authentication Options');
        await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        const organizationScreenshot = testInfo.outputPath('organization-accessible-controls.png');
        await page.screenshot({ path: organizationScreenshot, animations: 'disabled' });
        await testInfo.attach('organization-accessible-controls', {
            path: organizationScreenshot, contentType: 'image/png',
        });
    });

    test('named admin row actions retain their exact date and job targets', async ({ page }) => {
        const actions: Record<string, unknown>[] = [];
        await page.route(/\/api\/admin\/overview(?:\?|$)/, route => route.fulfill({ json: {
            mode: 'mock', version: 'test', uptime: 1, db: { connected: true, latencyMs: 1 },
            scope: 'organization', identifier: 'synthetic-org',
            dataRange: { earliest: null, latest: null },
            syncStats: { totalDays: 1, syncedDays: 0, missingDays: 1, missingDates: ['2026-04-01'] },
            pendingCount: 0, failedCount: 1,
            recentFailures: [{ metricsDate: '2026-04-01', errorMessage: 'Synthetic failure', attemptCount: 1 }],
        } }));
        await page.route(/\/api\/admin\/sync-status(?:\?|$)/, route => route.fulfill({ json: {
            billingCsv: { inFlight: null, recent: actions.some(action => action.action === 'sync-billing-csv-dismiss') ? [] : [{
                id: 427, enterprise: 'synthetic-enterprise', startDate: '2026-04-01',
                endDate: '2026-04-28', status: 'completed', rowsIngested: 1,
                triggeredBy: null, completedAt: null, errorMessage: null,
                chunksFetched: null, gapsSkipped: null,
            }] },
        } }));
        await page.route(/\/api\/admin\/sync$/, async route => {
            const action = route.request().postDataJSON() as Record<string, unknown>;
            actions.push(action);
            await route.fulfill({ json: { action: action.action, result: { success: true }, dismissed: true, jobId: 427 } });
        });
        await page.goto('/orgs/octo-demo-org?mock=true');
        await new DashboardPage(page).expectMetricLabelsVisible();
        await page.getByRole('button', { name: 'Open admin panel', exact: true }).focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog');
        const retry = dialog.getByRole('button', { name: 'Retry this date', exact: true });
        await retry.focus();
        await page.keyboard.press('Space');
        await expect.poll(() => actions).toEqual([expect.objectContaining({ action: 'sync-date', date: '2026-04-01' })]);
        await expect(dialog).toContainText('Re-synced 2026-04-01');
        const dismiss = dialog.getByRole('button', { name: 'Dismiss billing job row', exact: true });
        await dismiss.focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => actions).toHaveLength(2);
        expect(actions[1]).toEqual(expect.objectContaining({ action: 'sync-billing-csv-dismiss', jobId: 427 }));
        await expect(dismiss).toHaveCount(0);
        await dialog.getByRole('button', { name: 'Close admin panel', exact: true }).focus();
        await page.keyboard.press('Space');
        await expect(dialog).not.toBeVisible();
    });
});

/**
 * Mock data users (from public/mock-data/new-api/organization-users-28-day-report.json):
 *   octocat    – 22 active days  (active ≥ 14 → "success" chip)
 *   octokitten – 18 active days  (active ≥ 14 → "success" chip)
 *   monalisa   –  5 active days  (occasional 1–6 → "warning" chip)
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

    test('user metrics table includes a Phase column showing adoption chips', tag, async () => {
        // PR feat/my-usage: new Phase column on the per-user table. The chip
        // renders the phase_number (1-4) with a title attribute like "Phase 2 (v1)".
        const userMetrics = await dashboard.gotoUserMetricsTab();
        await expect(userMetrics.page.getByRole('columnheader', { name: 'Phase' })).toBeVisible();
        // Use the title attribute (stable across phase numbers) rather than the
        // numeric chip text (which would collide with other table values).
        const phaseChip = userMetrics.page.locator('tbody .v-chip[title^="Phase "]').first();
        await expect(phaseChip).toBeVisible();
    });

    test('user metrics renders AI Adoption Phase Mix doughnut', tag, async () => {
        // PR feat/my-usage: doughnut appears next to Engagement Distribution
        // when at least one user in the fixture has an ai_adoption_phase value.
        const userMetrics = await dashboard.gotoUserMetricsTab();
        await expect(
            userMetrics.page.getByText('AI Adoption Phase Mix', { exact: true })
        ).toBeVisible();
    });

    test('user metrics renders Top Users by Active Days chart', tag, async () => {
        // Fills the slot next to AI Adoption Phase Mix so the row isn't half-empty.
        const userMetrics = await dashboard.gotoUserMetricsTab();
        await expect(
            userMetrics.page.getByText('Top Users by Active Days', { exact: true })
        ).toBeVisible();
    });
});
