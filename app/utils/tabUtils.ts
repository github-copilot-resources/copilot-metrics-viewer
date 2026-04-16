/**
 * Filters tab items based on the NUXT_PUBLIC_HIDDEN_TABS configuration.
 * The config value is a comma-separated list of tab names (case-insensitive).
 */
export function applyHiddenTabs(tabItems: string[], hiddenTabsConfig: string): string[] {
    if (!hiddenTabsConfig) return tabItems
    const hiddenTabs = hiddenTabsConfig.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
    if (hiddenTabs.length === 0) return tabItems
    return tabItems.filter((tab: string) => !hiddenTabs.includes(tab.toLowerCase()))
}

/**
 * Auto-hides the "teams" tab when historical mode is disabled.
 * Team metrics require the user_day_metrics DB table; without it the teams
 * tab falls back to org-wide data and shows identical (incorrect) data for every team.
 */
export function applyHistoricalModeFilter(tabItems: string[], enableHistoricalMode: boolean | string): string[] {
    const historicalMode = enableHistoricalMode === true || enableHistoricalMode === 'true'
    if (!historicalMode && tabItems.includes('teams')) {
        return tabItems.filter((t: string) => t !== 'teams')
    }
    return tabItems
}
