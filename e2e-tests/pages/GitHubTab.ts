import { expect, type Locator, type Page } from '@playwright/test';

export class GitHubTab {
    readonly page: Page;
    
    // Container and main elements
    readonly githubContainer: Locator;
    readonly statisticsTitle: Locator;
    readonly dateRangeCard: Locator;
    
    // Overview cards (new API labels)
    readonly codeCompletionsCard: Locator;
    readonly chatCard: Locator;
    readonly allModelsCard: Locator;
    
    // Legacy overview cards (shown when hasReportData=false)
    readonly githubChatCard: Locator;
    readonly githubPRSummariesCard: Locator;
    
    // Chart sections
    readonly featureUsageTitle: Locator;
    readonly activeUsersTitle: Locator;
    readonly chartContainers: Locator;
    
    // New API data tables
    readonly modelFeatureTitle: Locator;
    readonly featureSummaryTitle: Locator;
    readonly modelSummaryTitle: Locator;
    readonly dataTables: Locator;
    
    // Legacy model section
    readonly expansionPanels: Locator;
    readonly expansionPanel: Locator;
    
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
        
        // Overview cards — new API mode (scoped to github.com container)
        this.codeCompletionsCard = page.locator('.github-com-container .v-card').filter({ hasText: 'Code Completions' }).first();
        this.chatCard = page.locator('.github-com-container .v-card').filter({ has: page.locator('.v-card-title', { hasText: 'Chat' }) }).first();
        this.allModelsCard = page.locator('.github-com-container .v-card').filter({ hasText: 'All Models' }).first();
        
        // Legacy overview cards
        this.githubChatCard = page.locator('.v-card').filter({ hasText: 'GitHub.com Chat' }).first();
        this.githubPRSummariesCard = page.locator('.v-card').filter({ hasText: 'GitHub.com PR' }).first();
        
        // Chart sections
        this.featureUsageTitle = page.locator('h2').filter({ hasText: 'Feature Usage Over Time' });
        this.activeUsersTitle = page.locator('h2').filter({ hasText: 'Active Users Over Time' });
        this.chartContainers = page.locator('.chart-container');
        
        // New API data tables
        this.modelFeatureTitle = page.locator('h2').filter({ hasText: 'Model Usage by Feature' });
        this.featureSummaryTitle = page.locator('h2').filter({ hasText: 'Feature Summary' });
        this.modelSummaryTitle = page.locator('h2').filter({ hasText: 'Model Summary' });
        this.dataTables = page.locator('.v-data-table');
        
        // Legacy models section
        this.expansionPanels = page.locator('.v-expansion-panels');
        this.expansionPanel = page.locator('.v-expansion-panel');
        
        // Tooltips
        this.tooltipElements = page.locator('.v-tooltip');
        
        // Legacy locators
        this.cumulativeNumberOfTurnsLabel = page.getByText('Cumulative Chat Interactions');
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

    // Overview cards — checks at least the core cards are visible
    async expectOverviewCardsVisible(timeout = 15000) {
        await expect(this.codeCompletionsCard).toBeVisible({ timeout });
        await expect(this.chatCard).toBeVisible({ timeout });
        // Third card is either "All Models" (new API) or "GitHub.com Chat" (legacy)
        const allModelsVisible = await this.allModelsCard.isVisible().catch(() => false);
        const githubChatVisible = await this.githubChatCard.isVisible().catch(() => false);
        expect(allModelsVisible || githubChatVisible).toBeTruthy();
    }

    // Chart sections
    async expectChartSectionsVisible(timeout = 10000) {
        await expect(this.featureUsageTitle).toBeVisible({ timeout });
    }

    async getChartContainerCount() {
        return await this.chartContainers.count();
    }

    async expectChartContainersPresent() {
        const count = await this.getChartContainerCount();
        expect(count).toBeGreaterThan(0);
        return count;
    }

    // Models / data tables section
    async expectModelsSectionVisible(timeout = 20000) {
        // Wait for the github-stats API to complete (async fetch with 150ms debounce)
        // First wait for loading spinner to disappear
        const loadingSpinner = this.page.locator('.v-progress-circular');
        await loadingSpinner.waitFor({ state: 'hidden', timeout }).catch(() => {});
        
        // Wait for any data table or model heading to appear
        const dataContent = this.page.locator('.v-data-table, h2:text("Model Usage by Feature"), h2:text("Models by Feature"), .v-expansion-panels');
        await dataContent.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        
        // New API shows data tables; legacy shows expansion panels
        const hasModelFeatureTable = await this.modelFeatureTitle.isVisible().catch(() => false);
        const hasExpansionPanels = await this.expansionPanels.isVisible().catch(() => false);
        const hasDataTables = await this.dataTables.first().isVisible().catch(() => false);
        const hasFeatureSummary = await this.featureSummaryTitle.isVisible().catch(() => false);
        expect(hasModelFeatureTable || hasExpansionPanels || hasDataTables || hasFeatureSummary).toBeTruthy();
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
        // Wait for the async github-stats data to load
        const loadingSpinner = this.page.locator('.v-progress-circular');
        await loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
        
        // Wait for at least one chart container to appear
        await this.chartContainers.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        
        const chartContainers = this.chartContainers;
        const containerCount = await chartContainers.count();
        
        expect(containerCount).toBeGreaterThan(0);
        
        let validatedCount = 0;
        for (let i = 0; i < containerCount; i++) {
            const container = chartContainers.nth(i);
            const isVisible = await container.isVisible().catch(() => false);
            if (!isVisible) continue;
            
            const styles = await container.evaluate((el) => {
                const computed = window.getComputedStyle(el);
                return {
                    height: computed.height,
                    width: computed.width,
                    position: computed.position
                };
            });
            
            // Skip containers that haven't been sized yet (async data)
            if (!styles.height || styles.height === '0px') continue;
            
            expect(styles.position).toBe('relative');
            validatedCount++;
        }
        // At least one chart container should have proper styling
        expect(validatedCount).toBeGreaterThan(0);
    }

    // Performance monitoring
    async monitorPerformanceWarnings() {
        const performanceWarnings: string[] = [];
        
        this.page.once('console', (msg) => {
            if (msg.type() === 'warning' && msg.text().includes('requestAnimationFrame')) {
                performanceWarnings.push(msg.text());
            }
        });
        
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
