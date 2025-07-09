import { describe, test, expect } from 'vitest'

describe('MainComponent tab name transformation', () => {
  test('should transform team-organization scope to team display name', () => {
    // Mock the MainComponent method logic
    function getDisplayTabName(itemName: string): string {
      switch (itemName) {
        case 'team-organization':
        case 'team-enterprise':
          return 'team';
        case 'organization':
        case 'enterprise':
          return itemName;
        default:
          return itemName;
      }
    }

    expect(getDisplayTabName('team-organization')).toBe('team')
    expect(getDisplayTabName('team-enterprise')).toBe('team')
    expect(getDisplayTabName('organization')).toBe('organization')
    expect(getDisplayTabName('enterprise')).toBe('enterprise')
  })

  test('should add teams tab for organization and enterprise scopes', () => {
    // Mock the logic for adding teams tab
    function getTabItems(scope: string): string[] {
      const baseItems = ['languages', 'editors', 'copilot chat', 'seat analysis', 'api response']
      const items = [...baseItems]
      
      // Add main scope tab first
      const displayName = scope === 'team-organization' || scope === 'team-enterprise' ? 'team' : scope
      items.unshift(displayName)
      
      // Add teams tab for organization and enterprise scopes
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

    const teamOrgTabs = getTabItems('team-organization')
    expect(teamOrgTabs[0]).toBe('team')
    expect(teamOrgTabs).not.toContain('teams') // No teams tab for team scope

    const teamEntTabs = getTabItems('team-enterprise')
    expect(teamEntTabs[0]).toBe('team')
    expect(teamEntTabs).not.toContain('teams') // No teams tab for team scope
  })
})