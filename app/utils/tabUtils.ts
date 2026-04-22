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
 * Historical mode filter — previously hid the "teams" tab when historical
 * mode was disabled (team metrics required the user_day_metrics DB table).
 *
 * Team metrics now work in direct API mode (by fetching enterprise/org
 * user-level records and filtering by team membership), so the teams tab
 * is always visible regardless of historical mode.
 *
 * Kept for backward compatibility; callers don't need to change.
 */
export function applyHistoricalModeFilter(tabItems: string[], _enableHistoricalMode: boolean | string): string[] {
    return tabItems;
}
