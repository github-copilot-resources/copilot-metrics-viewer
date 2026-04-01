/**
 * E2E test for the full storage pipeline.
 *
 * Two-phase test (run in separate containers sharing a volume):
 *   Phase 1 (@seed): Run with IS_DATA_MOCKED=true → admin sync writes mock data to DB
 *   Phase 2 (@storage): Run with IS_DATA_MOCKED=false, ENABLE_HISTORICAL_MODE=true
 *            → dashboard reads from DB, no mock, no GitHub token needed
 *
 * Usage:
 *   docker compose run --rm sync-seed         # Phase 1: seed DB
 *   docker compose run --rm playwright-storage # Phase 2: verify dashboard reads from DB
 */

import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

const ORG = 'storage-test-org';

// --- Phase 1: Seed DB with mock data ---
// Runs in a container with IS_DATA_MOCKED=true
test.describe('Seed storage @seed', () => {

  test('bulk sync writes mock data to DB', async ({ request }) => {
    const syncResponse = await request.post('/api/admin/sync', {
      data: {
        action: 'sync-bulk',
        scope: 'organization',
        githubOrg: ORG,
        isDataMocked: true,
      },
    });

    expect(syncResponse.ok()).toBeTruthy();
    const syncResult = await syncResponse.json();
    expect(syncResult.action).toBe('sync-bulk');
    expect(syncResult.success).toBe(true);
    expect(syncResult.totalDays).toBeGreaterThan(0);

    console.log(`Seed complete: ${syncResult.savedDays} saved, ${syncResult.skippedDays} skipped`);
  });

  test('sync-status confirms data in DB', async ({ request }) => {
    const statusResponse = await request.get('/api/admin/sync-status', {
      params: { scope: 'organization', githubOrg: ORG },
    });

    expect(statusResponse.ok()).toBeTruthy();
    const status = await statusResponse.json();
    expect(status.stats.syncedDays).toBeGreaterThan(0);
    console.log(`DB has ${status.stats.syncedDays} days synced`);
  });
});

// --- Phase 2: Dashboard reads from DB ---
// Runs in a container with IS_DATA_MOCKED=false, ENABLE_HISTORICAL_MODE=true
test.describe('Storage Pipeline @storage', () => {

  test('dashboard loads metrics from DB', async ({ browser }) => {
    const page = await browser.newPage();

    let metricsResponseBody: any = null;
    page.on('response', async (response) => {
      if (response.url().includes('/api/metrics') && response.status() === 200) {
        try {
          const body = await response.json();
          // The metrics API returns { metrics: [...], usage: [...] }
          metricsResponseBody = body.usage || body;
        } catch { /* ignore */ }
      }
    });

    // Navigate without mock=true — forces DB path
    await page.goto(`/orgs/${ORG}`);

    const dashboard = new DashboardPage(page);
    await dashboard.expectMetricLabelsVisible();
    await dashboard.expectDataReturned();

    // Verify response shape
    expect(metricsResponseBody).not.toBeNull();
    expect(Array.isArray(metricsResponseBody)).toBeTruthy();
    expect(metricsResponseBody.length).toBeGreaterThan(0);

    const firstMetric = metricsResponseBody[0];
    expect(firstMetric).toHaveProperty('date');
    expect(firstMetric).toHaveProperty('copilot_ide_code_completions');

    console.log(`Dashboard loaded ${metricsResponseBody.length} days from DB`);

    // Verify all tabs work with DB data
    const languagesTab = await dashboard.gotoLanguagesTab();
    await languagesTab.expectTop5LanguagesVisible();

    const editorsTab = await dashboard.gotoEditorsTab();
    await editorsTab.expectNumberOfEditorsVisible();

    const chatTab = await dashboard.gotoCopilotChatTab();
    await chatTab.expectCumulativeNumberOfTurnsVisible();

    await page.close();
  });

  test('health endpoints work', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();

    const ready = await request.get('/api/ready');
    expect(ready.ok()).toBeTruthy();

    const live = await request.get('/api/live');
    expect(live.ok()).toBeTruthy();
  });
});
