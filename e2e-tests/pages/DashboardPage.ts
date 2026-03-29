import { expect, type Locator, type Page } from "@playwright/test";
import { LanguagesTab } from "./LanguagesTab";
import { EditorsTab } from "./EditorsTab";
import { SeatAnalysisTab } from "./SeatAnalysisTab";
import { ApiResponseTab } from "./ApiResponseTab";
import { CopilotChatTab } from "./CopilotChatTab";
import { GitHubTab } from "./GitHubTab";
import { UserMetricsTab } from "./UserMetricsTab";

export class DashboardPage {
    readonly page: Page;

    readonly acceptanceRateByCountLabel: Locator;
    readonly acceptanceRateByCountValue: Locator;
    readonly totalCountOfSuggestionsLabel: Locator;
    readonly totalCountOfSuggestionsValue: Locator;
    readonly totalLinesSuggestedLabel: Locator;
    readonly totalLinesSuggestedValue: Locator;
    readonly toolbarTitle: Locator;

    readonly teamTabLink: Locator;
    readonly teamsTabLink: Locator;
    readonly orgTabLink: Locator;
    readonly enterpriseTabLink: Locator;

    readonly languagesTabLink: Locator;
    readonly editorsTabLink: Locator;
    readonly seatAnalysisTabLink: Locator;
    readonly apiResponseTabLink: Locator;
    readonly copilotChatTabLink: Locator;
    readonly githubTabLink: Locator;
    readonly userMetricsTabLink: Locator;

    constructor(page: Page) {
        this.page = page;

        this.acceptanceRateByCountLabel = page.getByText(
            "Acceptance Rate (by count)"
        );
        this.acceptanceRateByCountValue = page
            .locator(".v-card-item")
            .filter({ has: page.getByText("Acceptance Rate (by count)") })
            .locator(".text-h4");
        this.totalCountOfSuggestionsLabel = page.getByText(
            "Total Code Completions", { exact: true }
        );
        this.totalCountOfSuggestionsValue = page
            .locator(".v-card-item")
            .filter({ has: page.getByText("Total Code Completions", { exact: true }) })
            .locator(".text-h4");
        this.totalLinesSuggestedLabel = page.getByRole("heading", {
            name: "Total Lines Suggested | Total",
        });
        this.totalLinesSuggestedValue = page
            .locator(".v-card-item")
            .filter({ has: page.getByText("Total Lines of code Suggested") })
            .locator(".text-h4");
        this.toolbarTitle = page.locator(".toolbar-title");

        this.languagesTabLink = page.getByRole("tab", { name: "languages" });
        this.editorsTabLink = page.getByRole("tab", { name: "editors" });
        this.seatAnalysisTabLink = page.getByRole("tab", { name: "seat analysis" });
        this.apiResponseTabLink = page.getByRole("tab", { name: "api response" });
        this.copilotChatTabLink = page.getByRole("tab", { name: "copilot chat" });
        this.githubTabLink = page.getByRole("tab", { name: "github.com" });
        this.userMetricsTabLink = page.getByRole("tab", { name: "user metrics" });

        this.teamTabLink = page.getByRole("tab", { name: "team" });
        this.teamsTabLink = page.getByRole("tab", { name: "teams" });
        this.orgTabLink = page.getByRole("tab", { name: "organization" });
        this.enterpriseTabLink = page.getByRole("tab", { name: "enterprise" });
    }

    async expectTeamsTabVisible() {
        await expect(this.teamsTabLink).toBeVisible();
    }

    async expectTeamTabVisible() {
        await expect(this.teamTabLink).toBeVisible();
    }

    async expectOrgTabVisible() {
        await expect(this.orgTabLink).toBeVisible();
    }

    async expectEnterpriseTabVisible() {
        await expect(this.enterpriseTabLink).toBeVisible();
    }

    async expectToHaveTitle(title: RegExp) {
        await expect(this.page).toHaveTitle(title);
        await expect(this.toolbarTitle).toHaveText(title);
    }

    async expectMetricLabelsVisible() {
        await expect(this.acceptanceRateByCountLabel).toBeVisible();
        await expect(this.totalCountOfSuggestionsLabel).toBeVisible();
        await expect(this.totalLinesSuggestedLabel).toBeVisible();
    }

    async expectDataReturned() {
        const linesAccepted = await this.totalLinesSuggestedValue.textContent();
        expect(linesAccepted).toBeDefined();
        expect(parseInt(linesAccepted as string)).toBeGreaterThan(0);
    }

    async expectAcceptanceRateReasonable() {
        const rateText = await this.acceptanceRateByCountValue.textContent();
        expect(rateText).toBeDefined();
        const rate = parseFloat((rateText as string).replace('%', ''));
        // Acceptance rate should be between 5% and 80% for realistic data
        // The old bug showed 0.4% — this catches that regression
        expect(rate).toBeGreaterThanOrEqual(5);
        expect(rate).toBeLessThanOrEqual(80);
    }

    async expectSuggestionCountReasonable() {
        const countText = await this.totalCountOfSuggestionsValue.textContent();
        expect(countText).toBeDefined();
        const count = parseInt((countText as string).replace(/,/g, ''));
        // Should have some completions, but not inflated by agent_edit
        expect(count).toBeGreaterThan(0);
    }

    async gotoLanguagesTab() {
        await this.languagesTabLink.click();
        return new LanguagesTab(this.page);
    }

    async gotoEditorsTab() {
        await this.editorsTabLink.click();
        return new EditorsTab(this.page);
    }

    async gotoSeatAnalysisTab() {
        await this.seatAnalysisTabLink.click();
        return new SeatAnalysisTab(this.page);
    }

    async gotoApiResponseTab() {
        await this.apiResponseTabLink.click();
        return new ApiResponseTab(this.page);
    }

    async gotoCopilotChatTab() {
        await this.copilotChatTabLink.click();
        return new CopilotChatTab(this.page);
    }

    async gotoGitHubTab() {
        await this.githubTabLink.click();
        const tab = new GitHubTab(this.page);
        // Wait for the github-stats data to load — look for "Copilot Statistics" title
        // and at least one overview card to have content
        await tab.statisticsTitle.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        // Wait for at least one card with non-zero content or "All Models"
        await this.page.locator('.v-card-title').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        return tab;
    }

    async gotoUserMetricsTab() {
        await this.userMetricsTabLink.click();
        const tab = new UserMetricsTab(this.page);
        await tab.totalUsersLabel.waitFor({ state: 'visible', timeout: 15000 });
        return tab;
    }

    async gotoTeamsTab() {
        await this.teamsTabLink.click();
        // No specific page object for teams tab, just return this for fluent interface
        return this;
    }

    async close() {
        await this.page.close();
    }
}
