import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

const tag = { tag: ['@org', '@my-usage'] };

/**
 * Mock-mode bypass: when NUXT_PUBLIC_IS_DATA_MOCKED=true the /api/my-usage
 * endpoint falls back to the fixture user "octocat" so the tab is exercisable
 * without OAuth. See server/api/my-usage.get.ts.
 */
test.describe('My Usage tab', () => {
    test.describe.configure({ mode: 'serial' });

    let dashboard: DashboardPage;

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.goto('/orgs/octo-demo-org?mock=true');

        dashboard = new DashboardPage(page);
        await dashboard.expectMetricLabelsVisible();
    });

    test.afterAll(async () => {
        await dashboard?.close();
    });

    test('my usage tab is visible', tag, async () => {
        await expect(dashboard.myUsageTabLink).toBeVisible();
    });

    test('my usage tab shows personal tiles', tag, async () => {
        const myUsage = await dashboard.gotoMyUsageTab();
        await myUsage.expectVisible();
    });

    test('my usage tab shows the signed-in user', tag, async () => {
        const myUsage = await dashboard.gotoMyUsageTab();
        // octocat is the deterministic fixture user (see server/api/my-usage.get.ts)
        await myUsage.expectShowsLogin('octocat');
    });

    test('my usage tab renders non-zero metrics from the fixture', tag, async () => {
        const myUsage = await dashboard.gotoMyUsageTab();

        const activeDays = await myUsage.readTile('Active days');
        expect(parseInt(activeDays, 10)).toBeGreaterThan(0);

        const interactions = await myUsage.readTile('Interactions');
        // toLocaleString may produce commas; strip them before parsing.
        expect(parseInt(interactions.replace(/,/g, ''), 10)).toBeGreaterThan(0);

        const accepted = await myUsage.readTile('Accepted lines');
        expect(parseInt(accepted.replace(/,/g, ''), 10)).toBeGreaterThan(0);
    });

    test('my usage tab displays the AI credits used tile', tag, async () => {
        const myUsage = await dashboard.gotoMyUsageTab();
        // The tile is always rendered; value may be a number, "—" when the
        // field is undefined on the fixture, or "0" when zero.
        await expect(myUsage.aiCreditsLabel).toBeVisible();
        const credits = await myUsage.readTile('AI credits used');
        expect(credits.trim().length).toBeGreaterThan(0);
    });
});
