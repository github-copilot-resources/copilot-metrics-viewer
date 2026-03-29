import { expect, test, type Page } from '@playwright/test'
import { DashboardPage } from './pages/DashboardPage';

const tag = { tag: ['@ent', '@org', '@team'] };

[
    { name: 'Teams', url: '/orgs/octodemo-org/teams/the-a-team?mock=true' },
    { name: 'Orgs', url: '/orgs/octodemo-org?mock=true' },
    { name: 'Enterprises', url: '/enterprises/octo-enterprise?mock=true' },
].forEach(({ name, url }) => {

    test.describe('tests for ' + name, () => {

        let dashboard: DashboardPage;

        test.beforeAll(async ({ browser }) => {
            const page = await browser.newPage();
            await page.goto(url);

            dashboard = new DashboardPage(page);

            // wait for the data
            await dashboard.expectMetricLabelsVisible();
        });

        test.afterAll(async () => {
            await dashboard.close();
        });

        test('metrics labels visible', tag, async () => {
            await dashboard.expectMetricLabelsVisible();
        });

        test('data returned', tag, async () => {
            await dashboard.expectDataReturned();
        });

        test('acceptance rate is reasonable', tag, async () => {
            await dashboard.expectAcceptanceRateReasonable();
        });

        test('suggestion count is reasonable', tag, async () => {
            await dashboard.expectSuggestionCountReasonable();
        });

        test('languages visible', tag, async () => {
            const languages = await dashboard.gotoLanguagesTab();

            await languages.expectTop5LanguagesVisible();
            await languages.expectNumberOfLanguagesReturned();
        });

        test('editors visible', tag, async () => {
            const editors = await dashboard.gotoEditorsTab();

            await editors.expectNumberOfEditorsVisible();
            await editors.expectNumberOfEditorsReturned();
        });

        test('seat analysis visible', tag, async () => {
            const seatAnalysis = await dashboard.gotoSeatAnalysisTab();

            await seatAnalysis.expectTotalAssignedVisible();
            await seatAnalysis.expectTotalAssignedReturned();
        });

        test('user metrics visible', tag, async () => {
            const userMetrics = await dashboard.gotoUserMetricsTab();

            await userMetrics.expectTotalUsersVisible();
            await userMetrics.expectTotalUsersReturned();
            await userMetrics.expectPremiumRequestsVisible();
        });

        test('copilot chat visible', tag, async () => {
          const copilotChat = await dashboard.gotoCopilotChatTab();
        
          await copilotChat.expectCumulativeNumberOfTurnsVisible();
          await copilotChat.expectCumulativeNumberOfTurnsReturned();
        });
        
        test('api response visible', tag, async () => {
          const apiResponse = await dashboard.gotoApiResponseTab();
        });
    })
});