import { test } from '@playwright/test';
import { GitHubTab } from './pages/GitHubTab';
import { DashboardPage } from './pages/DashboardPage';


test.describe('AgentModeViewer Component', () => {

  let dashboard: DashboardPage;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/orgs/octo-demo-org?mock=true');

    dashboard = new DashboardPage(page);

    // wait for the data
    await dashboard.expectMetricLabelsVisible();
  });

  test.afterAll(async () => {
    await dashboard?.close();
  });


  test('should display loading state initially', async () => {
    // Check if the github.com container is present
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.expectContainerVisible();
  });

  test('should display Copilot Statistics title', async () => {
    // Wait for the component to load and display the title
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.expectStatisticsTitleVisible();
  });

  test('should display overview cards', async () => {
    // Check if all four overview cards are present
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.expectOverviewCardsVisible();
  });

  test('should display chart sections', async () => {
    // Check if chart sections are present
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.expectChartSectionsVisible();
  });

  test('should display models section', async () => {
    // Check if models section is present
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.expectModelsSectionVisible();
  });

  test('should handle chart rendering without performance issues', async () => {
    // Measure page performance and check charts
    const githubTab = await dashboard.gotoGitHubTab();
    const renderTime = await githubTab.expectRenderTimeUnderLimit(5000);
    const chartCount = await githubTab.expectChartContainersPresent();

    console.log(`Render time: ${renderTime}ms, Chart containers: ${chartCount}`);
  });

  test('should display tooltips on hover', async () => {
    // Test tooltip functionality
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.expectTooltipInteraction();
  });

  test('should handle expansion panels correctly', async () => {
    // Look for expansion panels and interact with them
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.clickFirstExpansionPanel();
  });

  test('should not show requestAnimationFrame performance warnings', async () => {
    // Monitor console for performance warnings
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.monitorPerformanceWarnings();
  });

  test('should be responsive on different screen sizes', async () => {
    // Test responsive design across different viewports
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.expectResponsiveDesign();
  });

  test('should maintain chart aspect ratio', async () => {
    // Check that chart containers have the correct styling
    const githubTab = await dashboard.gotoGitHubTab();
    await githubTab.validateChartContainerStyles();
  });
});
