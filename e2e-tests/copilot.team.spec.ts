import { expect, test } from '@playwright/test'
import { DashboardPage } from './pages/DashboardPage';

const tag = { tag: ['@org'] }

let dashboard: DashboardPage;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/orgs/octo-demo-org/teams/the-a-team?mock=true');

  dashboard = new DashboardPage(page);

  // wait for the data
  await dashboard.expectMetricLabelsVisible();
});

test.afterAll(async () => {
  await dashboard?.close();
});

test('has title', tag, async () => {
  await dashboard.expectToHaveTitle(/Copilot Metrics Viewer \| Organization : octo-demo-org \| Team : the-a-team/);
});

test('team tab', tag, async () => {
  await dashboard.expectTeamsTabVisible();
});
