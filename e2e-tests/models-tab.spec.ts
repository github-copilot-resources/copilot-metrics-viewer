import { test } from '@playwright/test';
import { ModelsTab } from './pages/ModelsTab';
import { DashboardPage } from './pages/DashboardPage';


test.describe('AgentModeViewer Component', () => {
  test.describe.configure({ mode: 'serial' });

  let dashboard: DashboardPage;
  let modelsTab: ModelsTab;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/orgs/octo-demo-org?mock=true');

    dashboard = new DashboardPage(page);

    // wait for the data
    await dashboard.expectMetricLabelsVisible();

    // Navigate to models tab and wait for async API data to fully load
    modelsTab = await dashboard.gotoModelsTab();
    // Best-effort: wait for chart data to render (non-fatal so slow CI doesn't break beforeAll)
    await page.locator('.models-container .v-card-title').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await dashboard?.close();
  });


  test('should display loading state initially', async () => {
    // Check if the models container is present
    
    await modelsTab.expectContainerVisible();
  });

  test('should display Copilot Statistics title', async () => {
    // Wait for the component to load and display the title
    
    await modelsTab.expectStatisticsTitleVisible();
  });

  test('should display overview cards', async () => {
    // Check if all four overview cards are present
    
    await modelsTab.expectOverviewCardsVisible();
  });

  test('should display chart sections', async () => {
    // Check if chart sections are present
    
    await modelsTab.expectChartSectionsVisible();
  });

  test('should display models section', async () => {
    
    // Extra wait for async API data to fully render into the DOM
    await dashboard.page.waitForTimeout(500);
    await modelsTab.expectModelsSectionVisible();
  });

  test('should handle chart rendering without performance issues', async () => {
    // Measure page performance and check charts
    
    const renderTime = await modelsTab.expectRenderTimeUnderLimit(5000);
    const chartCount = await modelsTab.expectChartContainersPresent();

    console.log(`Render time: ${renderTime}ms, Chart containers: ${chartCount}`);
  });

  test('should display tooltips on hover', async () => {
    // Test tooltip functionality
    
    await modelsTab.expectTooltipInteraction();
  });

  test('should handle expansion panels correctly', async () => {
    // Look for expansion panels and interact with them
    
    await modelsTab.clickFirstExpansionPanel();
  });

  test('should not show requestAnimationFrame performance warnings', async () => {
    // Monitor console for performance warnings
    
    await modelsTab.monitorPerformanceWarnings();
  });

  test('should be responsive on different screen sizes', async () => {
    // Test responsive design across different viewports
    
    await modelsTab.expectResponsiveDesign();
  });

  test('should maintain chart aspect ratio', async () => {
    // Check that chart containers have the correct styling
    
    await modelsTab.validateChartContainerStyles();
  });
});
