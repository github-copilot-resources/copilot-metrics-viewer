import { test } from '@playwright/test';
import { GitHubTab } from './pages/GitHubTab';
import { DashboardPage } from './pages/DashboardPage';


test.describe('AgentModeViewer Component', () => {
  test.describe.configure({ mode: 'serial' });

  let dashboard: DashboardPage;
  let githubTab: GitHubTab;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/orgs/octo-demo-org?mock=true');

    dashboard = new DashboardPage(page);

    // wait for the data
    await dashboard.expectMetricLabelsVisible();

    // Navigate to github.com tab and wait for async API data to fully load
    githubTab = await dashboard.gotoGitHubTab();
    // Ensure the github-stats API response has been rendered
    await page.locator('.github-com-container .v-card-title').first().waitFor({ state: 'visible', timeout: 20000 });
  });

  test.afterAll(async () => {
    await dashboard?.close();
  });


  test('should display loading state initially', async () => {
    // Check if the github.com container is present
    
    await githubTab.expectContainerVisible();
  });

  test('should display Copilot Statistics title', async () => {
    // Wait for the component to load and display the title
    
    await githubTab.expectStatisticsTitleVisible();
  });

  test('should display overview cards', async () => {
    // Check if all four overview cards are present
    
    await githubTab.expectOverviewCardsVisible();
  });

  test('should display chart sections', async () => {
    // Check if chart sections are present
    
    await githubTab.expectChartSectionsVisible();
  });

  test('should display models section', async () => {
    
    // Extra wait for async API data to fully render into the DOM
    await dashboard.page.waitForTimeout(500);
    await githubTab.expectModelsSectionVisible();
  });

  test('should handle chart rendering without performance issues', async () => {
    // Measure page performance and check charts
    
    const renderTime = await githubTab.expectRenderTimeUnderLimit(5000);
    const chartCount = await githubTab.expectChartContainersPresent();

    console.log(`Render time: ${renderTime}ms, Chart containers: ${chartCount}`);
  });

  test('should display tooltips on hover', async () => {
    // Test tooltip functionality
    
    await githubTab.expectTooltipInteraction();
  });

  test('should handle expansion panels correctly', async () => {
    // Look for expansion panels and interact with them
    
    await githubTab.clickFirstExpansionPanel();
  });

  test('should not show requestAnimationFrame performance warnings', async () => {
    // Monitor console for performance warnings
    
    await githubTab.monitorPerformanceWarnings();
  });

  test('should be responsive on different screen sizes', async () => {
    // Test responsive design across different viewports
    
    await githubTab.expectResponsiveDesign();
  });

  test('should maintain chart aspect ratio', async () => {
    // Check that chart containers have the correct styling
    
    await githubTab.validateChartContainerStyles();
  });
});
