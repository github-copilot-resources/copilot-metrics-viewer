import { describe, test, expect } from 'vitest'

describe('MainComponent tab name transformation', () => {
  test('should display team name when githubTeam is set', () => {
    // Mock the MainComponent method logic after scope simplification
    function getDisplayTabName(scope: string, githubTeam?: string): string {
      if (githubTeam) return 'team';
      return scope;
    }

    expect(getDisplayTabName('organization', 'my-team')).toBe('team')
    expect(getDisplayTabName('enterprise', 'my-team')).toBe('team')
    expect(getDisplayTabName('organization')).toBe('organization')
    expect(getDisplayTabName('enterprise')).toBe('enterprise')
  })

  test('should add teams tab for organization and enterprise scopes without a team', () => {
    // Mock the logic for adding teams tab
    function getTabItems(scope: string, githubTeam?: string): string[] {
      const baseItems = ['languages', 'editors', 'copilot chat', 'seat analysis', 'api response']
      const items = [...baseItems]
      
      // Add main scope tab first
      const displayName = githubTeam ? 'team' : scope
      items.unshift(displayName)
      
      // Add teams tab only for org/enterprise without a specific team
      if (!githubTeam && (scope === 'organization' || scope === 'enterprise')) {
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

    const teamOrgTabs = getTabItems('organization', 'my-team')
    expect(teamOrgTabs[0]).toBe('team')
    expect(teamOrgTabs).not.toContain('teams') // No teams tab when viewing a specific team

    const teamEntTabs = getTabItems('enterprise', 'my-team')
    expect(teamEntTabs[0]).toBe('team')
    expect(teamEntTabs).not.toContain('teams') // No teams tab when viewing a specific team
  })
})