import { describe, it, expect } from 'vitest'
import { Options } from '@/model/Options'

describe('Enterprise Type Support', () => {
  describe('Options class enterprise type handling', () => {
    it('should handle copilot-only enterprise type', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-enterprise',
        enterpriseType: 'copilot-only'
      })

      expect(options.enterpriseType).toBe('copilot-only')
      expect(options.getTeamsApiUrl()).toBe('https://api.github.com/enterprises/test-enterprise/teams')
    })

    it('should handle full enterprise type', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-enterprise',
        enterpriseType: 'full'
      })

      expect(options.enterpriseType).toBe('full')
      expect(options.getTeamsApiUrl()).toBe('https://api.github.com/graphql')
    })

    it('should default to copilot-only behavior when enterprise type not specified', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-enterprise'
      })

      expect(options.getTeamsApiUrl()).toBe('https://api.github.com/enterprises/test-enterprise/teams')
    })

    it('should handle team-enterprise scope with copilot-only type', () => {
      const options = new Options({
        scope: 'team-enterprise',
        githubEnt: 'test-enterprise',
        githubTeam: 'test-team',
        enterpriseType: 'copilot-only'
      })

      expect(options.getApiUrl()).toBe('https://api.github.com/enterprises/test-enterprise/team/test-team/copilot/metrics')
    })

    it('should handle team-enterprise scope with full type', () => {
      const options = new Options({
        scope: 'team-enterprise',
        githubEnt: 'test-enterprise',
        githubTeam: 'org-name - team-name',
        enterpriseType: 'full'
      })

      expect(options.getApiUrl()).toBe('https://api.github.com/orgs/org-name/team/team-name/copilot/metrics')
    })

    it('should throw error for invalid team slug format in full enterprise', () => {
      const options = new Options({
        scope: 'team-enterprise',
        githubEnt: 'test-enterprise',
        githubTeam: 'invalid-team-slug',
        enterpriseType: 'full'
      })

      expect(() => options.getApiUrl()).toThrow('Team slug must be in format "org-name - team-name" for full enterprise scope')
    })

    it('should include enterprise type in serialization methods', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-enterprise',
        enterpriseType: 'full'
      })

      const params = options.toParams()
      expect(params.enterpriseType).toBe('full')

      const urlParams = options.toURLSearchParams()
      expect(urlParams.get('enterpriseType')).toBe('full')

      const obj = options.toObject()
      expect(obj.enterpriseType).toBe('full')
    })

    it('should handle enterprise type in fromQuery method', () => {
      const options = Options.fromQuery({
        scope: 'enterprise',
        githubEnt: 'test-enterprise',
        enterpriseType: 'full'
      })

      expect(options.enterpriseType).toBe('full')
    })

    it('should handle enterprise type in fromURLSearchParams method', () => {
      const params = new URLSearchParams()
      params.set('scope', 'enterprise')
      params.set('githubEnt', 'test-enterprise')
      params.set('enterpriseType', 'full')

      const options = Options.fromURLSearchParams(params)
      expect(options.enterpriseType).toBe('full')
    })

    it('should handle enterprise type in merge method', () => {
      const options1 = new Options({
        scope: 'enterprise',
        githubEnt: 'test-enterprise',
        enterpriseType: 'copilot-only'
      })

      const options2 = new Options({
        enterpriseType: 'full'
      })

      const merged = options1.merge(options2)
      expect(merged.enterpriseType).toBe('full')
    })
  })
})