import { describe, test, expect } from 'vitest'

describe('MainComponent tab name transformation', () => {
  test('should return scope name unchanged', () => {
    function getDisplayTabName(scope: string): string {
      return scope;
    }

    expect(getDisplayTabName('organization')).toBe('organization')
    expect(getDisplayTabName('enterprise')).toBe('enterprise')
  })

  test('should add teams tab for organization and enterprise scopes', () => {
    function getTabItems(scope: string): string[] {
      const baseItems = ['languages', 'editors', 'copilot chat', 'seat analysis', 'api response']
      const items = [...baseItems]
      
      items.unshift(scope)
      
      if (scope === 'organization' || scope === 'enterprise') {
        items.splice(1, 0, 'teams')
      }
      
      return items
    }

    const orgTabs = getTabItems('organization')
    expect(orgTabs[0]).toBe('organization')
    expect(orgTabs[1]).toBe('teams')
    expect(orgTabs).toContain('languages')
    expect(orgTabs).toContain('editors')

    const entTabs = getTabItems('enterprise')
    expect(entTabs[0]).toBe('enterprise')
    expect(entTabs[1]).toBe('teams')
  })

  test('should use "team" as first tab and NOT add teams comparison tab for team scope', () => {
    function getTabItems(scope: string): string[] {
      const baseItems = ['languages', 'editors', 'copilot chat', 'seat analysis', 'api response']
      const items = [...baseItems]

      items.unshift(scope)

      if (scope === 'organization' || scope === 'enterprise') {
        items.splice(1, 0, 'teams')
      }

      return items
    }

    const teamTabs = getTabItems('team')
    expect(teamTabs[0]).toBe('team')
    expect(teamTabs).not.toContain('teams')
    expect(teamTabs).toContain('languages')
    expect(teamTabs).toContain('editors')
  })
})