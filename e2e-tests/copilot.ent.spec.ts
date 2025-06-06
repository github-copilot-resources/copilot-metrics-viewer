import { expect, test } from '@playwright/test'
import { DashboardPage } from './pages/DashboardPage';

const tag = { tag: ['@ent'] }

let dashboard: DashboardPage;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/enterprises/octo-demo-ent?mock=true');

  dashboard = new DashboardPage(page);

  // wait for the data
  await dashboard.expectMetricLabelsVisible();
});

test.afterAll(async () => {
  await dashboard.close();
});

test('has title', tag, async () => {
  await dashboard.expectToHaveTitle(/Copilot Metrics Viewer \| Enterprise : octo-demo-ent/);
});

test('enterprise tab', tag, async () => {
  await dashboard.expectEnterpriseTabVisible();
});
