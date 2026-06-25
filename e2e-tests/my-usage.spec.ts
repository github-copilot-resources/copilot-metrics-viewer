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

    test('my usage tab renders adoption phase chip on Active Days card', tag, async () => {
        // PR feat/my-usage: the mock fixture has ai_adoption_phase populated
        // for octocat, so the chip should be rendered next to "Active days".
        // It carries the phase number ("Phase 1: Onboarded" style label).
        await dashboard.gotoMyUsageTab();
        const chip = dashboard.page.locator('.v-chip').filter({ hasText: /Phase \d/ }).first();
        await expect(chip).toBeVisible();
    });

    test('my usage tab renders GitHub CLI usage card when fixture has CLI totals', tag, async () => {
        // PR feat/my-usage: totals_by_cli is populated for octocat in the
        // 28-day mock. The card surfaces request count + token usage + last
        // known cli version.
        await dashboard.gotoMyUsageTab();
        const cliCard = dashboard.page.locator('.v-card').filter({ hasText: 'GitHub CLI' }).first();
        await expect(cliCard).toBeVisible();
    });

    test('my usage tab renders Your AI credit spend card from mock billing fixture', tag, async () => {
        // The mock my-usage endpoint injects a synthetic MyUsageSpend payload so
        // the spend card is exercisable without a live billing token.
        // See server/api/my-usage.get.ts mock branch.
        await dashboard.gotoMyUsageTab();
        const spendCard = dashboard.page.locator('.v-card').filter({ hasText: 'Your AI credit spend' }).first();
        await expect(spendCard).toBeVisible();
        // Total spend, credits billed, and at least one per-model row should render.
        await expect(spendCard).toContainText('Total spend');
        await expect(spendCard).toContainText('Credits billed');
        await expect(spendCard.locator('tbody tr').first()).toBeVisible();
    });
});
