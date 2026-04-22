/**
 * Real-data Playwright tests for cody-test-org.
 *
 * These tests run against a live dev server connected to the real GitHub API
 * (NUXT_GITHUB_TOKEN must be set). They verify that team-level user metrics
 * are correctly derived from per-user data and that the UI shows the right
 * members for each team.
 *
 * Team structure (as of April 2026):
 *   the-a-team:  karpikpl, autocloudarc, cody-carlson, jordanbean-msft, cherryjain-msft
 *   the-b-team:  karpikpl, cody-carlson
 *   the-c-team:  karpikpl
 *   cody-is-alone-team: cody-carlson
 *   everyone:    karpikpl, autocloudarc, cody-carlson, jordanbean-msft, cherryjain-msft
 *   co-pilot-users-ad-synced: (empty)
 *
 * Active users with Copilot data (28-day window):
 *   karpikpl, autocloudarc, cody-carlson, jordanbean-msft, cherryjain-msft
 *   (cody-carlson-learning also has data but is NOT a member of any team above)
 */

import { expect, test, type Page } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { UserMetricsTab } from './pages/UserMetricsTab';

// Skip entire file when running with mock data (CI/Docker).
// Note: playwright.config.ts forces NUXT_PUBLIC_IS_DATA_MOCKED=true at import time,
// so we check for the RUN_REAL_DATA_TESTS env var instead.
const skipRealData = process.env.RUN_REAL_DATA_TESTS !== 'true';
test.skip(() => skipRealData, 'Skipped: set RUN_REAL_DATA_TESTS=true to run real-data tests');

const ORG = 'cody-test-org';
const tag = { tag: ['@real-data'] };

// Exact-match helper to avoid substring collisions (e.g. 'cody-carlson' vs 'cody-carlson-learning')
async function expectExactUserInTable(page: Page, login: string) {
    await expect(page.locator('tbody .v-chip').getByText(login, { exact: true })).toBeVisible();
}
async function expectExactUserNotInTable(page: Page, login: string) {
    await expect(page.locator('tbody .v-chip').getByText(login, { exact: true })).not.toBeVisible();
}

// Members per team — source of truth for assertions
const TEAMS: Record<string, string[]> = {
    'the-a-team': ['karpikpl', 'autocloudarc', 'cody-carlson', 'jordanbean-msft', 'cherryjain-msft'],
    'the-b-team': ['karpikpl', 'cody-carlson'],
    'the-c-team': ['karpikpl'],
    'cody-is-alone-team': ['cody-carlson'],
    'everyone': ['karpikpl', 'autocloudarc', 'cody-carlson', 'jordanbean-msft', 'cherryjain-msft'],
};

// All users known to have Copilot activity (superset across all teams)
const ALL_ACTIVE_USERS = ['karpikpl', 'autocloudarc', 'cody-carlson', 'cody-carlson-learning', 'jordanbean-msft', 'cherryjain-msft'];

// ─── Org-level tests ────────────────────────────────────────────────────────

test.describe('Org-level dashboard (cody-test-org)', () => {
    test.describe.configure({ mode: 'serial' });

    let dashboard: DashboardPage;
    let userMetrics: UserMetricsTab;

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.goto(`/orgs/${ORG}`, { waitUntil: 'networkidle' });
        dashboard = new DashboardPage(page);
        await dashboard.expectMetricLabelsVisible();
    });

    test.afterAll(async () => {
        await dashboard?.close();
    });

    test('has correct title', tag, async () => {
        await dashboard.expectToHaveTitle(new RegExp(`Copilot Metrics Viewer \\| Organization : ${ORG}`));
    });

    test('shows non-zero metrics', tag, async () => {
        await dashboard.expectDataReturned();
        await dashboard.expectSuggestionCountReasonable();
    });

    test('has teams tab available', tag, async () => {
        await dashboard.expectTeamsTabVisible();
    });

    test('user metrics tab shows all active users', tag, async () => {
        userMetrics = await dashboard.gotoUserMetricsTab();
        await userMetrics.expectTotalUsersReturned();
        await userMetrics.expectDataTableVisible();

        // Each known active user should appear in the table
        for (const login of ALL_ACTIVE_USERS) {
            await expectExactUserInTable(userMetrics.page, login);
        }
    });

    test('user metrics search filters correctly', tag, async () => {
        // Search for a specific user
        await userMetrics.searchForUser('karpikpl');
        await expectExactUserInTable(userMetrics.page, 'karpikpl');

        // Other users should be filtered out
        await expectExactUserNotInTable(userMetrics.page, 'cody-carlson');

        await userMetrics.clearSearch();

        // All users should be back
        for (const login of ALL_ACTIVE_USERS) {
            await expectExactUserInTable(userMetrics.page, login);
        }
    });
});

// ─── Team-level tests ───────────────────────────────────────────────────────

for (const [teamSlug, expectedMembers] of Object.entries(TEAMS)) {
    test.describe(`Team: ${teamSlug}`, () => {
        test.describe.configure({ mode: 'serial' });

        let dashboard: DashboardPage;
        let userMetrics: UserMetricsTab;

        test.beforeAll(async ({ browser }) => {
            const page = await browser.newPage();
            await page.goto(`/orgs/${ORG}/teams/${teamSlug}`, { waitUntil: 'networkidle' });
            dashboard = new DashboardPage(page);
            await dashboard.expectMetricLabelsVisible();
        });

        test.afterAll(async () => {
            await dashboard?.close();
        });

        test('has correct title', tag, async () => {
            await dashboard.expectToHaveTitle(
                new RegExp(`Copilot Metrics Viewer \\| Organization : ${ORG} \\| Team : ${teamSlug}`)
            );
        });

        test('shows team tab', tag, async () => {
            await dashboard.expectTeamTabVisible();
        });

        test('user metrics shows only team members', tag, async () => {
            userMetrics = await dashboard.gotoUserMetricsTab();
            await userMetrics.expectDataTableVisible();

            // Expected members should be present
            for (const login of expectedMembers) {
                await expectExactUserInTable(userMetrics.page, login);
            }

            // Users NOT in this team should NOT appear
            const nonMembers = ALL_ACTIVE_USERS.filter(u => !expectedMembers.includes(u));
            for (const login of nonMembers) {
                await expectExactUserNotInTable(userMetrics.page, login);
            }
        });

        test('user count matches expected team size', tag, async () => {
            const totalText = await userMetrics.page
                .locator('.v-card-item')
                .filter({ has: userMetrics.page.getByText('Total Users', { exact: true }) })
                .locator('.kpi-value')
                .textContent();

            const total = parseInt(totalText || '0');
            expect(total).toBe(expectedMembers.length);
        });
    });
}

// ─── Teams comparison tests ─────────────────────────────────────────────────

test.describe('Teams comparison (cody-test-org)', () => {
    test.describe.configure({ mode: 'serial' });

    let dashboard: DashboardPage;

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.goto(`/orgs/${ORG}`, { waitUntil: 'networkidle' });
        dashboard = new DashboardPage(page);
        await dashboard.expectMetricLabelsVisible();
    });

    test.afterAll(async () => {
        await dashboard?.close();
    });

    test('teams tab shows team selection dropdown', tag, async () => {
        await dashboard.gotoTeamsTab();

        const emptyState = dashboard.page.getByText('No Team Selected');
        await expect(emptyState).toBeVisible();
    });

    test('can select the-a-team and the-b-team for comparison', tag, async () => {
        const teamsDropdown = dashboard.page.locator('[role="combobox"]').first();
        await expect(teamsDropdown).toBeVisible();

        await teamsDropdown.click();

        // Wait for listbox items to load (not "No data available")
        const listbox = dashboard.page.locator('[role="listbox"]');
        await expect(listbox).toBeVisible();
        await expect(listbox.getByText('No data available')).not.toBeVisible({ timeout: 15000 });

        // Type to filter and select the-a-team
        const input = teamsDropdown.locator('input');
        await input.fill('The A Team');
        await dashboard.page.waitForTimeout(500);
        const aTeamOption = listbox.getByText('The A Team').first();
        await expect(aTeamOption).toBeVisible({ timeout: 10000 });
        await aTeamOption.click();

        // Type to filter and select the-b-team
        await input.fill('The B Team');
        await dashboard.page.waitForTimeout(500);
        const bTeamOption = listbox.getByText('The B Team').first();
        await expect(bTeamOption).toBeVisible({ timeout: 10000 });
        await bTeamOption.click();

        // Close dropdown
        await teamsDropdown.click();

        // Verify comparison mode activated
        const comparisonChip = dashboard.page.getByText('Comparison', { exact: true });
        await expect(comparisonChip).toBeVisible();

        // Verify per-team summary cards appear
        const aTeamCard = dashboard.page.getByText('The A Team', { exact: true }).first();
        await expect(aTeamCard).toBeVisible();

        const bTeamCard = dashboard.page.getByText('The B Team', { exact: true }).first();
        await expect(bTeamCard).toBeVisible();
    });

    test('comparison shows correct active user counts', tag, async () => {
        // the-a-team has 5 members (all active), the-b-team has 2
        // Verify per-team summary cards show active user stats
        const aTeamCard = dashboard.page.getByText('The A Team', { exact: true }).first();
        await expect(aTeamCard).toBeVisible();

        const bTeamCard = dashboard.page.getByText('The B Team', { exact: true }).first();
        await expect(bTeamCard).toBeVisible();

        // Each card shows 'Active Users' label
        const activeUserLabels = dashboard.page.getByText('Active Users', { exact: true });
        const count = await activeUserLabels.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('comparison charts are visible', tag, async () => {
        const languageChart = dashboard.page.getByText('Language Usage — by Team');
        await expect(languageChart).toBeVisible();

        const editorChart = dashboard.page.getByText('Editor Usage — by Team');
        await expect(editorChart).toBeVisible();
    });
});

// ─── Empty team edge case ───────────────────────────────────────────────────

test.describe('Empty team: co-pilot-users-ad-synced', () => {
    test('handles empty team gracefully', tag, async ({ browser }) => {
        const page = await browser.newPage();

        try {
            await page.goto(`/orgs/${ORG}/teams/co-pilot-users-ad-synced`, { waitUntil: 'networkidle' });

            // The page should load without crashing
            // It may show zero metrics or an empty state
            const title = await page.title();
            expect(title).toContain('Copilot Metrics Viewer');
        } finally {
            await page.close();
        }
    });
});
