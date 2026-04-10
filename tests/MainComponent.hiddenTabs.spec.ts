import { describe, test, expect } from 'vitest'

describe('MainComponent hidden tabs filtering', () => {
  const ALL_BASE_TABS = ['languages', 'editors', 'copilot chat', 'agent activity', 'pull requests', 'github.com', 'seat analysis', 'user metrics', 'api response']

  function applyHiddenTabs(tabItems: string[], hiddenTabsConfig: string): string[] {
    if (!hiddenTabsConfig) return tabItems
    const hiddenTabs = hiddenTabsConfig.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
    if (hiddenTabs.length === 0) return tabItems
    return tabItems.filter((tab: string) => !hiddenTabs.includes(tab.toLowerCase()))
  }

  test('should keep all tabs when hiddenTabs is empty', () => {
    const tabs = ['organization', 'teams', ...ALL_BASE_TABS]
    const result = applyHiddenTabs(tabs, '')
    expect(result).toEqual(tabs)
  })

  test('should hide a single tab when configured', () => {
    const tabs = ['organization', 'teams', ...ALL_BASE_TABS]
    const result = applyHiddenTabs(tabs, 'api response')
    expect(result).not.toContain('api response')
    expect(result).toContain('languages')
    expect(result).toContain('editors')
    expect(result).toContain('seat analysis')
  })

  test('should hide multiple tabs when configured with comma-separated list', () => {
    const tabs = ['organization', 'teams', ...ALL_BASE_TABS]
    const result = applyHiddenTabs(tabs, 'api response, agent activity, pull requests')
    expect(result).not.toContain('api response')
    expect(result).not.toContain('agent activity')
    expect(result).not.toContain('pull requests')
    expect(result).toContain('languages')
    expect(result).toContain('copilot chat')
    expect(result).toContain('seat analysis')
    expect(result).toContain('user metrics')
  })

  test('should be case-insensitive when matching tab names', () => {
    const tabs = ['organization', ...ALL_BASE_TABS]
    const result = applyHiddenTabs(tabs, 'API Response, Seat Analysis')
    expect(result).not.toContain('api response')
    expect(result).not.toContain('seat analysis')
    expect(result).toContain('languages')
  })

  test('should not hide scope tabs (organization, enterprise, team)', () => {
    const tabs = ['organization', 'teams', ...ALL_BASE_TABS]
    // When hidden tabs config only targets content tabs, scope tabs remain
    const result = applyHiddenTabs(tabs, 'api response')
    expect(result).toContain('organization')
    expect(result).toContain('teams')
  })

  test('should handle whitespace in the hidden tabs config', () => {
    const tabs = ['organization', ...ALL_BASE_TABS]
    const result = applyHiddenTabs(tabs, '  api response  ,  agent activity  ')
    expect(result).not.toContain('api response')
    expect(result).not.toContain('agent activity')
    expect(result).toContain('languages')
  })

  test('should return empty array if all tabs are hidden', () => {
    const tabs = ['languages', 'editors']
    const result = applyHiddenTabs(tabs, 'languages, editors')
    expect(result).toHaveLength(0)
  })

  test('should ignore unknown tab names in hiddenTabs config', () => {
    const tabs = ['organization', ...ALL_BASE_TABS]
    const result = applyHiddenTabs(tabs, 'nonexistent-tab, api response')
    expect(result).not.toContain('api response')
    expect(result).toContain('languages')
    // Length should be original - 1 (only api response removed)
    expect(result).toHaveLength(tabs.length - 1)
  })
})
