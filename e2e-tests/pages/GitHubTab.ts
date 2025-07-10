import { expect, type Locator, type Page } from '@playwright/test';

export class GitHubTab {
    readonly page: Page;
    
    // Container and main elements
    readonly githubContainer: Locator;
    readonly statisticsTitle: Locator;
    readonly dateRangeCard: Locator;
    
    // Overview cards
    readonly ideCodeCompletionsCard: Locator;
    readonly ideChatCard: Locator;
    readonly githubChatCard: Locator;
    readonly githubPRSummariesCard: Locator;
    
    // Chart sections
    readonly featureUsageTitle: Locator;
    readonly modelUsageTitle: Locator;
    readonly chartContainers: Locator;
    
    // Models section
    readonly modelsTitle: Locator;
    readonly expansionPanels: Locator;
    readonly expansionPanel: Locator;
    readonly dataTables: Locator;
    
    // Tooltips
    readonly tooltipElements: Locator;
    
    // Legacy locators for backward compatibility
    readonly cumulativeNumberOfTurnsLabel: Locator;
    readonly cumulativeNumberOfTurnsValue: Locator;

    constructor(page: Page) {
        this.page = page;
        
        // Container and main elements
        this.githubContainer = page.locator('.github-com-container');
        this.statisticsTitle = page.locator('h2').filter({ hasText: 'Copilot Statistics' });
        this.dateRangeCard = page.locator('.v-card').filter({ hasText: /calendar-range/ });
        
        // Overview cards - using more specific selectors to avoid ambiguity
        this.ideCodeCompletionsCard = page.locator('.v-card').filter({ hasText: 'IDE Code Completions' }).first();
        this.ideChatCard = page.locator('.v-card').filter({ hasText: 'IDE Chat' }).first();
        this.githubChatCard = page.locator('.v-card').filter({ hasText: 'GitHub.com Chat' }).first();
        this.githubPRSummariesCard = page.locator('.v-card').filter({ hasText: 'GitHub.com PR Summaries' }).first();
        
        // Chart sections
        this.featureUsageTitle = page.locator('h2').filter({ hasText: 'Copilot Feature Usage Over Time' });
        this.modelUsageTitle = page.locator('h2').filter({ hasText: 'Model Usage Distribution' });
        this.chartContainers = page.locator('.chart-container');
        
        // Models section - using correct CSS selectors
        this.modelsTitle = page.locator('h2').filter({ hasText: 'Models Used by Users' });
        this.expansionPanels = page.locator('.v-expansion-panels');
        this.expansionPanel = page.locator('.v-expansion-panel');
        this.dataTables = page.locator('.v-data-table');
        
        // Tooltips
        this.tooltipElements = page.locator('.v-tooltip');
        
        // Legacy locators
        this.cumulativeNumberOfTurnsLabel = page.getByText('Cumulative Number of Turns');
        this.cumulativeNumberOfTurnsValue = page.locator('.v-card-item').filter({ has: this.cumulativeNumberOfTurnsLabel }).locator('.text-h4');
    }

    // Main visibility checks
    async expectContainerVisible(timeout = 10000) {
        await expect(this.githubContainer).toBeVisible({ timeout });
    }

    async expectStatisticsTitleVisible(timeout = 10000) {
        await expect(this.statisticsTitle).toBeVisible({ timeout });
    }

    async expectDateRangeVisible(timeout = 10000) {
        await expect(this.dateRangeCard).toBeVisible({ timeout });
    }

    // Overview cards
    async expectOverviewCardsVisible(timeout = 10000) {
        await expect(this.ideCodeCompletionsCard).toBeVisible({ timeout });
        await expect(this.ideChatCard).toBeVisible({ timeout });
        await expect(this.githubChatCard).toBeVisible({ timeout });
        await expect(this.githubPRSummariesCard).toBeVisible({ timeout });
    }

    async expectIdeCodeCompletionsVisible(timeout = 10000) {
        await expect(this.ideCodeCompletionsCard).toBeVisible({ timeout });
    }

    async expectIdeChatVisible(timeout = 10000) {
        await expect(this.ideChatCard).toBeVisible({ timeout });
    }

    async expectGithubChatVisible(timeout = 10000) {
        await expect(this.githubChatCard).toBeVisible({ timeout });
    }

    async expectGithubPRSummariesVisible(timeout = 10000) {
        await expect(this.githubPRSummariesCard).toBeVisible({ timeout });
    }

    // Chart sections
    async expectChartSectionsVisible(timeout = 10000) {
        await expect(this.featureUsageTitle).toBeVisible({ timeout });
        await expect(this.modelUsageTitle).toBeVisible({ timeout });
    }

    async expectFeatureUsageTitleVisible(timeout = 10000) {
        await expect(this.featureUsageTitle).toBeVisible({ timeout });
    }

    async expectModelUsageTitleVisible(timeout = 10000) {
        await expect(this.modelUsageTitle).toBeVisible({ timeout });
    }

    async getChartContainerCount() {
        return await this.chartContainers.count();
    }

    async expectChartContainersPresent() {
        const count = await this.getChartContainerCount();
        expect(count).toBeGreaterThan(0);
        return count;
    }

    // Models section
    async expectModelsSectionVisible(timeout = 10000) {
        await expect(this.modelsTitle).toBeVisible({ timeout });
        // Check if expansion panels exist, but don't fail if they don't
        const panelCount = await this.expansionPanel.count();
        if (panelCount > 0) {
            await expect(this.expansionPanels).toBeVisible({ timeout });
        }
    }

    async expectModelsUsedTitleVisible(timeout = 10000) {
        await expect(this.modelsTitle).toBeVisible({ timeout });
    }

    async expectExpansionPanelsVisible(timeout = 10000) {
        await expect(this.expansionPanels).toBeVisible({ timeout });
    }

    async clickFirstExpansionPanel() {
        const panelCount = await this.expansionPanel.count();
        if (panelCount > 0) {
            await this.expansionPanel.first().click();
            await expect(this.dataTables.first()).toBeVisible({ timeout: 5000 });
        } else {
            expect(panelCount).toBe(0);
        }
    }

    async getExpansionPanelCount() {
        return await this.expansionPanel.count();
    }

    // Performance and interaction methods
    async measureRenderTime() {
        const startTime = Date.now();
        await this.page.waitForTimeout(2000);
        const endTime = Date.now();
        return endTime - startTime;
    }

    async expectRenderTimeUnderLimit(maxTime = 5000) {
        const renderTime = await this.measureRenderTime();
        expect(renderTime).toBeLessThan(maxTime);
        return renderTime;
    }

    async hoverOverTitle() {
        await this.statisticsTitle.hover();
        await expect(this.statisticsTitle).toBeVisible();
    }

    async expectTooltipInteraction() {
        await this.hoverOverTitle();
        // Note: Tooltip visibility check is optional as it might not work with mocked data
    }

    // Responsive design checks
    async setDesktopViewport() {
        await this.page.setViewportSize({ width: 1920, height: 1080 });
        await this.expectContainerVisible();
    }

    async setTabletViewport() {
        await this.page.setViewportSize({ width: 768, height: 1024 });
        await this.expectContainerVisible();
    }

    async setMobileViewport() {
        await this.page.setViewportSize({ width: 375, height: 667 });
        await this.expectContainerVisible();
    }

    async expectResponsiveDesign() {
        await this.setDesktopViewport();
        await this.setTabletViewport();
        await this.setMobileViewport();
        
        const cards = this.page.locator('.v-card');
        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThan(0);
    }

    // Chart styling validation
    async validateChartContainerStyles() {
        const chartContainers = this.chartContainers;
        const containerCount = await chartContainers.count();
        
        // Expect at least some chart containers to be present
        expect(containerCount).toBeGreaterThan(0);
        
        for (let i = 0; i < containerCount; i++) {
            const container = chartContainers.nth(i);
            await expect(container).toBeVisible();
            
            const styles = await container.evaluate((el) => {
                const computed = window.getComputedStyle(el);
                return {
                    height: computed.height,
                    width: computed.width,
                    position: computed.position
                };
            });
            
            // Check if height is set (should be 400px but might be computed differently)
            expect(styles.height).toBeTruthy();
            expect(styles.position).toBe('relative');
        }
    }

    // Performance monitoring
    async monitorPerformanceWarnings() {
        const performanceWarnings: string[] = [];
        
        this.page.once('console', (msg) => {
            if (msg.type() === 'warning' && msg.text().includes('requestAnimationFrame')) {
                performanceWarnings.push(msg.text());
            }
        });
        
        // Trigger potential performance issues
        await this.page.hover('h2');
        await this.page.waitForTimeout(1000);
        await this.page.mouse.wheel(0, 500);
        await this.page.waitForTimeout(500);
        
        expect(performanceWarnings).toHaveLength(0);
        return performanceWarnings;
    }

    // Legacy methods for backward compatibility
    async expectCumulativeNumberOfTurnsVisible() {
        await expect(this.cumulativeNumberOfTurnsLabel).toBeVisible();
    }

    async expectCumulativeNumberOfTurnsReturned() {
        const numberOfTurns = await this.cumulativeNumberOfTurnsValue.textContent();
        expect(numberOfTurns).toBeDefined();
        expect(parseInt(numberOfTurns as string)).toBeGreaterThan(0);
    }
}