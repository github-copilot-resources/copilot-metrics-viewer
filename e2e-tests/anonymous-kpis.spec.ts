import { expect, test, type Page } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { UserMetricsTab } from './pages/UserMetricsTab';
import type { UserTotals } from '../server/services/github-copilot-usage-api';

const users: [UserTotals, UserTotals] = [
  { login: 'synthetic-self', user_id: 1, total_active_days: 9, user_initiated_interaction_count: 2,
    code_generation_activity_count: 10, code_acceptance_activity_count: 9,
    loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
  { login: 'synthetic-other', user_id: 2, total_active_days: 2, user_initiated_interaction_count: 1,
    code_generation_activity_count: 90, code_acceptance_activity_count: 9,
    loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
];
const summary = { total_users: 2, active_users: 1, generated: 100, accepted: 18 };
const tile = (page: Page, name: string) => page.locator('.v-card-item')
  .filter({ has: page.getByText(name, { exact: true }) }).locator('.kpi-value');

// These are consumer fixtures, not a bypass used to claim live role authorization.
// The HTTP route/session tests exercise the real server-side privacy boundary.
for (const admin of [false, true]) {
  test(`anonymous totals with ${admin ? 'admin partial-page' : 'non-admin self-only'} synthetic details`, async ({ page }, testInfo) => {
    let header: string | null = JSON.stringify(summary);
    let userRequests = 0;
    const requestedPages: string[] = [];
    await page.route(/\/api\/user-metrics(?:\?|$)/, route => {
      userRequests++;
      return route.fulfill({
        json: admin ? users : [users[0]],
        headers: header === null ? {} : { 'x-copilot-user-summary': header },
      });
    });
    await page.route(/\/api\/seats(?:\?|$)/, route => {
      const current = new URL(route.request().url()).searchParams.get('page') ?? '1';
      requestedPages.push(current);
      return route.fulfill({
        json: {
          seats: (admin ? users : [users[0]]).map(user => ({
            login: user.login, id: user.user_id, team: 'synthetic-team',
            created_at: '2026-01-01', last_activity_at: null, last_activity_editor: '', plan_type: '',
          })),
          total_seats: admin ? 901 : 1, page: Number(current), per_page: 300, total_pages: admin ? 4 : 1,
          summary: { assigned: 901, never_used: admin ? null : 11, inactive_7: admin ? null : 21, inactive_30: admin ? null : 8 },
        },
      });
    });
    await page.goto('/orgs/octo-demo-org?mock=true');
    const dashboard = new DashboardPage(page);
    await dashboard.expectMetricLabelsVisible();
    await expect.poll(() => userRequests).toBeGreaterThan(0);
    await dashboard.seatAnalysisTabLink.click();
    await expect(tile(page, 'Total Assigned')).toHaveText('901');
    await expect(tile(page, 'Never Used')).toHaveText(admin ? 'Unavailable' : '11');
    await expect(page.getByText('Permitted seat details', { exact: true })).toBeVisible();
    if (admin) {
      await page.getByRole('button', { name: 'Go to page 2', exact: true }).click();
      await expect.poll(() => requestedPages.includes('2')).toBe(true);
      await expect(tile(page, 'Total Assigned')).toHaveText('901');
      await expect(page.getByText(/901 permitted seats/)).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Go to page 2', exact: true })).toHaveCount(0);
      await expect(page.getByRole('cell', { name: 'synthetic-other', exact: true })).toHaveCount(0);
    }
    await page.locator('.v-window-item--active').screenshot({
      path: testInfo.outputPath(`seats-${admin ? 'admin-partial' : 'self-only'}.png`), animations: 'disabled',
    });
    await dashboard.userMetricsTabLink.click();
    const metrics = new UserMetricsTab(page);
    const userTableBody = page.locator('.v-window-item--active .v-data-table').first().locator('tbody');
    await expect(metrics.totalUsersValue).toHaveText('2');
    await expect(metrics.activeUsersValue).toHaveText('1');
    await expect(metrics.avgAcceptanceRateValue).toHaveText('18.0%');
    await expect(userTableBody).toContainText('synthetic-self');
    if (!admin) {
      await expect(userTableBody).not.toContainText('synthetic-other');
      await metrics.searchInput.fill('synthetic-other');
      await expect(userTableBody).not.toContainText('synthetic-self');
      await expect(metrics.totalUsersValue).toHaveText('2');
      await metrics.searchInput.clear();
    } else await expect(userTableBody).toContainText('synthetic-other');
    await page.locator('.v-window-item--active').screenshot({
      path: testInfo.outputPath(`users-${admin ? 'admin' : 'self-only'}.png`), animations: 'disabled',
    });
    header = null;
    const beforeReload = userRequests;
    await page.reload();
    await dashboard.expectMetricLabelsVisible();
    await expect.poll(() => userRequests).toBeGreaterThan(beforeReload);
    await dashboard.userMetricsTabLink.click();
    await expect(metrics.totalUsersValue).toHaveText('Unavailable');
    await expect(metrics.avgAcceptanceRateValue).toHaveText('Unavailable');
    await expect(page.getByText(/Scope-wide user summary unavailable/)).toBeVisible();
    await expect(userTableBody).toContainText('synthetic-self');
    header = '{"total_users":999,"login":"must-not-be-rendered"}';
    const beforeInvalid = userRequests;
    await page.reload();
    await dashboard.expectMetricLabelsVisible();
    await expect.poll(() => userRequests).toBeGreaterThan(beforeInvalid);
    await dashboard.userMetricsTabLink.click();
    await expect(metrics.totalUsersValue).toHaveText('Unavailable');
    await expect(page.getByText('must-not-be-rendered')).toHaveCount(0);
  });
}

test('denied synthetic API responses do not render previous scope totals or rows', async ({ page }) => {
  await page.route(/\/api\/(?:seats|user-metrics)(?:\?|$)/, route => route.fulfill({
    status: 403, json: { statusCode: 403, statusMessage: 'Synthetic access denied' },
  }));
  await page.goto('/orgs/octo-demo-org?mock=true');
  await expect(page.getByText(/403 Forbidden from GitHub/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'synthetic-self', exact: true })).toHaveCount(0);
  await expect(page.locator('.kpi-value').filter({ hasText: /^901$/ })).toHaveCount(0);
});

test('date reload hides old totals while pending and denied next scope cannot reuse them', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let held = false;
  let initialRequests = 0;
  await page.route(/\/api\/data-range(?:\?|$)/, route => route.fulfill({
    json: { earliest: '2026-03-29', latest: '2026-04-25', mode: 'mock' },
  }));
  await page.route(/\/api\/seats(?:\?|$)/, route => route.fulfill({
    json: { seats: [], total_seats: 0, page: 1, total_pages: 1, per_page: 300,
      summary: { assigned: 0, never_used: 0, inactive_7: 0, inactive_30: 0 } },
  }));
  await page.route(/\/api\/user-metrics(?:\?|$)/, async route => {
    const query = new URL(route.request().url()).searchParams;
    if (query.get('githubOrg') === 'synthetic-denied-org') {
      return route.fulfill({ status: 403, json: { statusCode: 403 } });
    }
    const changed = query.get('since') === '2026-04-20';
    if (changed) {
      held = true;
      await gate;
    } else initialRequests++;
    return route.fulfill({
      json: [users[0]],
      headers: { 'x-copilot-user-summary': JSON.stringify(changed
        ? { total_users: 1, active_users: 1, generated: 10, accepted: 9 } : summary) },
    });
  });
  await page.goto('/orgs/octo-demo-org?mock=true');
  const dashboard = new DashboardPage(page);
  const metrics = new UserMetricsTab(page);
  await dashboard.expectMetricLabelsVisible();
  await expect.poll(() => initialRequests).toBeGreaterThan(0);
  await dashboard.userMetricsTabLink.click();
  await expect(metrics.totalUsersValue).toHaveText('2');
  await page.getByRole('button', { name: 'Show date range', exact: true }).click();
  await page.getByLabel('From Date', { exact: true }).fill('2026-04-20');
  await page.getByLabel('To Date', { exact: true }).fill('2026-04-25');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect.poll(() => held).toBe(true);
  await expect(metrics.totalUsersValue).toHaveText('Unavailable');
  release();
  await expect(metrics.totalUsersValue).toHaveText('1');
  await expect(metrics.avgAcceptanceRateValue).toHaveText('90.0%');
  await page.goto('/orgs/synthetic-denied-org?mock=true');
  await dashboard.expectMetricLabelsVisible();
  await dashboard.userMetricsTabLink.click();
  await expect(page.getByText(/403 Error — Unable to load user metrics/)).toBeVisible();
  await expect(metrics.totalUsersValue).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'synthetic-self', exact: true })).toHaveCount(0);
});
