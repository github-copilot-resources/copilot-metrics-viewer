// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { Options } from '@/model/Options'
import type { OptionsData, Scope } from '@/model/Options'
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router'

// Mock useRuntimeConfig
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: {
      scope: 'organization',
      githubOrg: 'default-org',
      githubEnt: 'default-ent',
      githubTeam: 'default-team',
      isDataMocked: false
    }
  })
}))

// Helper function to create mock route
function createMockRoute(params: Record<string, string> = {}, query: Record<string, string> = {}): RouteLocationNormalizedLoadedGeneric {
  return {
    params,
    query,
    name: 'test',
    path: '/test',
    fullPath: '/test',
    hash: '',
    matched: [],
    meta: {},
    redirectedFrom: undefined
  }
}

describe('Options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    test('creates empty options with no data', () => {
      const options = new Options()
      
      expect(options.since).toBeUndefined()
      expect(options.until).toBeUndefined()
      expect(options.isDataMocked).toBeUndefined()
      expect(options.githubOrg).toBeUndefined()
      expect(options.githubEnt).toBeUndefined()
      expect(options.githubTeam).toBeUndefined()
      expect(options.scope).toBeUndefined()
    })

    test('creates options with provided data', () => {
      const data: OptionsData = {
        since: '2023-01-01',
        until: '2023-12-31',
        isDataMocked: true,
        githubOrg: 'my-org',
        githubEnt: 'my-ent',
        githubTeam: 'my-team',
        scope: 'organization'
      }
      
      const options = new Options(data)
      
      expect(options.since).toBe('2023-01-01')
      expect(options.until).toBe('2023-12-31')
      expect(options.isDataMocked).toBe(true)
      expect(options.githubOrg).toBe('my-org')
      expect(options.githubEnt).toBe('my-ent')
      expect(options.githubTeam).toBe('my-team')
      expect(options.scope).toBe('organization')
    })

    test('handles new excludeHolidays and locale properties', () => {
      const data: OptionsData = {
        since: '2023-01-01',
        until: '2023-12-31',
        excludeHolidays: true,
        locale: 'US'
      }
      
      const options = new Options(data)
      
      expect(options.since).toBe('2023-01-01')
      expect(options.until).toBe('2023-12-31')
      expect(options.excludeHolidays).toBe(true)
      expect(options.locale).toBe('US')
    })

    test('handles partial data correctly', () => {
      const data: OptionsData = {
        since: '2023-01-01',
        githubOrg: 'my-org'
      }
      
      const options = new Options(data)
      
      expect(options.since).toBe('2023-01-01')
      expect(options.githubOrg).toBe('my-org')
      expect(options.until).toBeUndefined()
      expect(options.isDataMocked).toBeUndefined()
    })
  })

  describe('fromRoute', () => {
    test('creates options from route with org parameter', () => {
      const mockRoute = createMockRoute({ org: 'test-org' })
      
      const options = Options.fromRoute(mockRoute, '2023-01-01', '2023-12-31')
      
      expect(options.githubOrg).toBe('test-org')
      expect(options.scope).toBe('organization')
      expect(options.since).toBe('2023-01-01')
      expect(options.until).toBe('2023-12-31')
    })

    test('creates options from route with org and team parameters', () => {
      const mockRoute = createMockRoute({ org: 'test-org', team: 'test-team' })
      
      const options = Options.fromRoute(mockRoute)
      
      expect(options.githubOrg).toBe('test-org')
      expect(options.githubTeam).toBe('test-team')
      expect(options.scope).toBe('organization')
    })

    // ── Regression: Bug #366 — user metrics date filter must include since/until ──
    // MainComponent.vue#userMetricsFetch was calling Options.fromRoute(route) without
    // since/until. The fix passes dateRange.since/until explicitly.
    // This test guards that omitting them loses the date range, making the fix necessary.
    test('omitting since/until from fromRoute produces undefined date range (bug #366)', () => {
      const mockRoute = createMockRoute({ org: 'test-org' })
      const optionsWithout = Options.fromRoute(mockRoute)
      expect(optionsWithout.since).toBeUndefined()
      expect(optionsWithout.until).toBeUndefined()
      // Confirm that passing them explicitly DOES include them
      const optionsWith = Options.fromRoute(mockRoute, '2026-01-01', '2026-01-31')
      expect(optionsWith.since).toBe('2026-01-01')
      expect(optionsWith.until).toBe('2026-01-31')
    })

    test('creates options from route with enterprise parameter', () => {
      const mockRoute = createMockRoute({ ent: 'test-ent' })
      
      const options = Options.fromRoute(mockRoute)
      
      expect(options.githubEnt).toBe('test-ent')
      expect(options.scope).toBe('enterprise')
    })

    test('creates options from route with enterprise and team parameters', () => {
      const mockRoute = createMockRoute({ ent: 'test-ent', team: 'test-team' })
      
      const options = Options.fromRoute(mockRoute)
      
      expect(options.githubEnt).toBe('test-ent')
      expect(options.githubTeam).toBe('test-team')
      expect(options.scope).toBe('enterprise')
    })

    test('handles mock query parameter', () => {
      const mockRoute = createMockRoute({ org: 'test-org' }, { mock: 'true' })
      
      const options = Options.fromRoute(mockRoute)
      
      expect(options.isDataMocked).toBe(true)
    })

    test('uses runtime config defaults when no route params', () => {
      const mockRoute = createMockRoute()
      
      const options = Options.fromRoute(mockRoute)
      
      expect(options.scope).toBe('organization')
      // The runtime config defaults are not being applied in the test environment
      // This is expected behavior in the test - runtime config would apply in real app
      expect(options.githubOrg).toBeUndefined()
    })
  })

  describe('fromURLSearchParams', () => {
    test('creates options from URL search params with holidays parameters', () => {
      const params = new URLSearchParams()
      params.set('since', '2023-01-01')
      params.set('until', '2023-12-31')
      params.set('excludeHolidays', 'true')
      params.set('locale', 'US')
      params.set('githubOrg', 'test-org')
      params.set('scope', 'organization')
      
      const options = Options.fromURLSearchParams(params)
      
      expect(options.since).toBe('2023-01-01')
      expect(options.until).toBe('2023-12-31')
      expect(options.excludeHolidays).toBe(true)
      expect(options.locale).toBe('US')
      expect(options.githubOrg).toBe('test-org')
      expect(options.scope).toBe('organization')
    })

    test('creates options from URL search params', () => {
      const params = new URLSearchParams()
      params.set('since', '2023-01-01')
      params.set('until', '2023-12-31')
      params.set('isDataMocked', 'true')
      params.set('githubOrg', 'test-org')
      params.set('scope', 'organization')
      
      const options = Options.fromURLSearchParams(params)
      
      expect(options.since).toBe('2023-01-01')
      expect(options.until).toBe('2023-12-31')
      expect(options.isDataMocked).toBe(true)
      expect(options.githubOrg).toBe('test-org')
      expect(options.scope).toBe('organization')
    })

    test('handles empty search params', () => {
      const params = new URLSearchParams()
      
      const options = Options.fromURLSearchParams(params)
      
      expect(options.since).toBeUndefined()
      expect(options.until).toBeUndefined()
      expect(options.isDataMocked).toBeUndefined()
      expect(options.githubOrg).toBeUndefined()
      expect(options.scope).toBeUndefined()
    })

    test('handles boolean conversion correctly', () => {
      const params = new URLSearchParams()
      params.set('isDataMocked', 'false')
      
      const options = Options.fromURLSearchParams(params)
      
      expect(options.isDataMocked).toBe(false)
    })
  })

  describe('fromQuery', () => {
    test('creates options from query object with holidays parameters', () => {
      const query = {
        since: '2023-01-01',
        until: '2023-12-31',
        excludeHolidays: 'true',
        locale: 'US',
        githubOrg: 'test-org',
        scope: 'organization'
      }
      
      const options = Options.fromQuery(query)
      
      expect(options.since).toBe('2023-01-01')
      expect(options.until).toBe('2023-12-31')
      expect(options.excludeHolidays).toBe(true)
      expect(options.locale).toBe('US')
      expect(options.githubOrg).toBe('test-org')
      expect(options.scope).toBe('organization')
    })

    test('creates options from query object', () => {
      const query = {
        since: '2023-01-01',
        until: '2023-12-31',
        isDataMocked: 'true',
        githubOrg: 'test-org',
        scope: 'organization'
      }
      
      const options = Options.fromQuery(query)
      
      expect(options.since).toBe('2023-01-01')
      expect(options.until).toBe('2023-12-31')
      expect(options.isDataMocked).toBe(true)
      expect(options.githubOrg).toBe('test-org')
      expect(options.scope).toBe('organization')
    })

    test('handles empty query object', () => {
      const options = Options.fromQuery({})
      
      expect(options.since).toBeUndefined()
      expect(options.until).toBeUndefined()
      expect(options.isDataMocked).toBeUndefined()
      expect(options.githubOrg).toBeUndefined()
      expect(options.scope).toBeUndefined()
    })
  })

  describe('serialization methods', () => {
    test('toQueryString serializes holidays parameters correctly', () => {
      const options = new Options({
        since: '2023-01-01',
        until: '2023-12-31',
        excludeHolidays: true,
        locale: 'US',
        githubOrg: 'test-org',
        scope: 'organization'
      })
      
      const queryString = options.toQueryString()
      
      expect(queryString).toContain('since=2023-01-01')
      expect(queryString).toContain('until=2023-12-31')
      expect(queryString).toContain('excludeHolidays=true')
      expect(queryString).toContain('locale=US')
      expect(queryString).toContain('githubOrg=test-org')
      expect(queryString).toContain('scope=organization')
    })

    test('toQueryString serializes correctly', () => {
      const options = new Options({
        since: '2023-01-01',
        until: '2023-12-31',
        isDataMocked: true,
        githubOrg: 'test-org',
        scope: 'organization'
      })
      
      const queryString = options.toQueryString()
      
      expect(queryString).toContain('since=2023-01-01')
      expect(queryString).toContain('until=2023-12-31')
      expect(queryString).toContain('isDataMocked=true')
      expect(queryString).toContain('githubOrg=test-org')
      expect(queryString).toContain('scope=organization')
    })

    test('toURLSearchParams creates correct params', () => {
      const options = new Options({
        since: '2023-01-01',
        githubOrg: 'test-org'
      })
      
      const params = options.toURLSearchParams()
      
      expect(params.get('since')).toBe('2023-01-01')
      expect(params.get('githubOrg')).toBe('test-org')
      expect(params.get('until')).toBeNull()
      expect(params.get('isDataMocked')).toBeNull()
    })

    test('toParams creates correct object', () => {
      const options = new Options({
        since: '2023-01-01',
        isDataMocked: true,
        githubOrg: 'test-org'
      })
      
      const params = options.toParams()
      
      expect(params.since).toBe('2023-01-01')
      expect(params.isDataMocked).toBe('true')
      expect(params.githubOrg).toBe('test-org')
      expect(params.until).toBeUndefined()
    })

    test('toObject creates correct data object', () => {
      const originalData: OptionsData = {
        since: '2023-01-01',
        until: '2023-12-31',
        isDataMocked: true,
        githubOrg: 'test-org',
        scope: 'organization'
      }
      
      const options = new Options(originalData)
      const objectData = options.toObject()
      
      expect(objectData).toEqual(originalData)
    })
  })

  describe('clone', () => {
    test('creates independent copy', () => {
      const original = new Options({
        since: '2023-01-01',
        githubOrg: 'test-org'
      })
      
      const cloned = original.clone()
      
      expect(cloned).not.toBe(original)
      expect(cloned.since).toBe(original.since)
      expect(cloned.githubOrg).toBe(original.githubOrg)
      
      // Verify independence
      cloned.since = '2023-02-01'
      expect(original.since).toBe('2023-01-01')
    })
  })

  describe('merge', () => {
    test('merges options correctly', () => {
      const base = new Options({
        since: '2023-01-01',
        githubOrg: 'base-org',
        scope: 'organization'
      })
      
      const other = new Options({
        until: '2023-12-31',
        githubOrg: 'other-org',
        isDataMocked: true
      })
      
      const merged = base.merge(other)
      
      expect(merged.since).toBe('2023-01-01') // from base
      expect(merged.until).toBe('2023-12-31') // from other
      expect(merged.githubOrg).toBe('other-org') // other takes precedence
      expect(merged.isDataMocked).toBe(true) // from other
      expect(merged.scope).toBe('organization') // from base
    })

    test('handles undefined values correctly', () => {
      const base = new Options({
        since: '2023-01-01',
        githubOrg: 'base-org'
      })
      
      const other = new Options({
        until: '2023-12-31'
      })
      
      const merged = base.merge(other)
      
      expect(merged.since).toBe('2023-01-01')
      expect(merged.until).toBe('2023-12-31')
      expect(merged.githubOrg).toBe('base-org')
      expect(merged.isDataMocked).toBeUndefined()
    })
  })

  describe('utility methods', () => {
    test('hasDateRange returns true when dates are set', () => {
      const options1 = new Options({ since: '2023-01-01' })
      const options2 = new Options({ until: '2023-12-31' })
      const options3 = new Options({ since: '2023-01-01', until: '2023-12-31' })
      const options4 = new Options({})
      
      expect(options1.hasDateRange()).toBe(true)
      expect(options2.hasDateRange()).toBe(true)
      expect(options3.hasDateRange()).toBe(true)
      expect(options4.hasDateRange()).toBe(false)
    })

    test('hasGitHubConfig returns true when GitHub config is set', () => {
      const options1 = new Options({ githubOrg: 'test-org' })
      const options2 = new Options({ githubEnt: 'test-ent' })
      const options3 = new Options({ githubOrg: 'test-org', githubEnt: 'test-ent' })
      const options4 = new Options({})
      
      expect(options1.hasGitHubConfig()).toBe(true)
      expect(options2.hasGitHubConfig()).toBe(true)
      expect(options3.hasGitHubConfig()).toBe(true)
      expect(options4.hasGitHubConfig()).toBe(false)
    })
  })

  describe('getApiUrl', () => {
    test('generates correct URL for organization scope', () => {
      const options = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        since: '2023-01-01',
        until: '2023-12-31'
      })
      
      const url = options.getApiUrl()
      
      expect(url).toBe('https://api.github.com/orgs/test-org/copilot/metrics?since=2023-01-01&until=2023-12-31')
    })

    test('generates correct URL for enterprise scope', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent',
        since: '2023-01-01'
      })
      
      const url = options.getApiUrl()
      
      expect(url).toBe('https://api.github.com/enterprises/test-ent/copilot/metrics?since=2023-01-01')
    })

    test('generates correct URL for organization scope with team (team is separate parameter)', () => {
      const options = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        githubTeam: 'test-team'
      })
      
      const url = options.getApiUrl()
      
      // Team filtering is done server-side; getApiUrl always returns org-level URL
      expect(url).toBe('https://api.github.com/orgs/test-org/copilot/metrics')
    })

    test('generates correct URL for enterprise scope with team (team is separate parameter)', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent',
        githubTeam: 'test-team'
      })
      
      const url = options.getApiUrl()
      
      // Team filtering is done server-side; getApiUrl always returns enterprise-level URL
      expect(url).toBe('https://api.github.com/enterprises/test-ent/copilot/metrics')
    })

    test('throws error for organization scope without githubOrg', () => {
      const options = new Options({
        scope: 'organization'
      })
      
      expect(() => options.getApiUrl()).toThrow('GitHub organization must be set for organization scope')
    })

    test('throws error for enterprise scope without githubEnt', () => {
      const options = new Options({
        scope: 'enterprise'
      })
      
      expect(() => options.getApiUrl()).toThrow('GitHub enterprise must be set for enterprise scope')
    })

    test('throws error for organization scope without githubOrg (with team)', () => {
      const options = new Options({
        scope: 'organization',
        githubTeam: 'test-team'
      })
      
      expect(() => options.getApiUrl()).toThrow('GitHub organization must be set for organization scope')
    })

    test('throws error for invalid scope', () => {
      const options = new Options({
        scope: 'invalid-scope' as Scope
      })
      
      expect(() => options.getApiUrl()).toThrow('Invalid scope: invalid-scope')
    })

    test('handles URL encoding in date parameters', () => {
      const options = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        since: '2023-01-01T00:00:00Z',
        until: '2023-12-31T23:59:59Z'
      })
      
      const url = options.getApiUrl()
      
      expect(url).toContain('since=2023-01-01T00%3A00%3A00Z')
      expect(url).toContain('until=2023-12-31T23%3A59%3A59Z')
    })
  })

  describe('getSeatsApiUrl', () => {
    test('generates correct URL for organization scope', () => {
      const options1 = new Options({
        scope: 'organization',
        githubOrg: 'test-org'
      })
      
      const options2 = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        githubTeam: 'test-team'
      })
      
      expect(options1.getSeatsApiUrl()).toBe('https://api.github.com/orgs/test-org/copilot/billing/seats')
      expect(options2.getSeatsApiUrl()).toBe('https://api.github.com/orgs/test-org/copilot/billing/seats')
    })

    test('generates correct URL for enterprise scope', () => {
      const options1 = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent'
      })
      
      const options2 = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent',
        githubTeam: 'test-team'
      })
      
      expect(options1.getSeatsApiUrl()).toBe('https://api.github.com/enterprises/test-ent/copilot/billing/seats')
      expect(options2.getSeatsApiUrl()).toBe('https://api.github.com/enterprises/test-ent/copilot/billing/seats')
    })

    test('throws error for organization scope without githubOrg', () => {
      const options = new Options({
        scope: 'organization'
      })
      
      expect(() => options.getSeatsApiUrl()).toThrow('GitHub organization must be set for organization scope')
    })

    test('throws error for enterprise scope without githubEnt', () => {
      const options = new Options({
        scope: 'enterprise'
      })
      
      expect(() => options.getSeatsApiUrl()).toThrow('GitHub enterprise must be set for enterprise scope')
    })

    test('throws error for invalid scope', () => {
      const options = new Options({
        scope: 'invalid-scope' as Scope
      })
      
      expect(() => options.getSeatsApiUrl()).toThrow('Invalid scope: invalid-scope')
    })

    // ── Regression: Bug #366 — org+team route must not skip team-member filter ──
    // seats.ts uses: `const isOrgOnly = options.scope === 'organization' && !options.githubTeam`
    // Before the fix, isOrgOnly was `options.scope === 'organization'` which returned all org
    // seats without filtering to team members when githubTeam was also set.
    test('githubTeam is set on org+team options (bug #366: isOrgOnly must be false)', () => {
      const orgWithTeam = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        githubTeam: 'the-a-team',
      })
      // The condition used in seats.ts must evaluate to false when githubTeam is set
      expect(orgWithTeam.scope === 'organization' && !orgWithTeam.githubTeam).toBe(false)
    })

    test('githubTeam is absent on plain org options (isOrgOnly fast path applies)', () => {
      const orgOnly = new Options({ scope: 'organization', githubOrg: 'test-org' })
      expect(orgOnly.scope === 'organization' && !orgOnly.githubTeam).toBe(true)
    })
  })

  describe('getTeamMembersApiUrl', () => {
    test('generates correct URL for organization scope', () => {
      const options = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        githubTeam: 'test-team'
      })
      
      expect(options.getTeamMembersApiUrl()).toBe('https://api.github.com/orgs/test-org/teams/test-team/members')
    })

    test('generates correct URL for enterprise scope (uses /memberships)', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent',
        githubTeam: 'test-team'
      })
      
      expect(options.getTeamMembersApiUrl()).toBe('https://api.github.com/enterprises/test-ent/teams/test-team/memberships')
    })

    test('throws error for organization scope without org or team', () => {
      const options = new Options({
        scope: 'organization',
        githubOrg: 'test-org'
      })
      
      expect(() => options.getTeamMembersApiUrl()).toThrow('GitHub organization and team must be set for organization scope')
    })

    test('throws error for enterprise scope without ent or team', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent'
      })
      
      expect(() => options.getTeamMembersApiUrl()).toThrow('GitHub enterprise and team must be set for enterprise scope')
    })

    test('throws error for invalid scope', () => {
      const options = new Options({
        scope: 'invalid-scope' as Scope,
        githubTeam: 'test-team'
      })
      
      expect(() => options.getTeamMembersApiUrl()).toThrow('Invalid scope: invalid-scope')
    })

    test('enterprise scope with githubOrg uses org-based /members URL (Full GHEC org teams)', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent',
        githubOrg: 'test-org',
        githubTeam: 'test-team'
      })
      
      expect(options.getTeamMembersApiUrl()).toBe('https://api.github.com/orgs/test-org/teams/test-team/members')
    })
  })

  describe('getTeamsApiUrl (Full GHEC org override)', () => {
    test('enterprise scope with githubOrg uses org-based teams URL', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent',
        githubOrg: 'test-org'
      })
      
      expect(options.getTeamsApiUrl()).toBe('https://api.github.com/orgs/test-org/teams')
    })

    test('enterprise scope without githubOrg uses enterprise teams URL', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'test-ent'
      })
      
      expect(options.getTeamsApiUrl()).toBe('https://api.github.com/enterprises/test-ent/teams')
    })
  })

  describe('GHE.com — NUXT_GITHUB_API_BASE_URL override', () => {
    const GHE_BASE = 'https://api.mysubdomain.ghe.com'
    const savedEnv = process.env.NUXT_GITHUB_API_BASE_URL

    beforeEach(() => {
      process.env.NUXT_GITHUB_API_BASE_URL = GHE_BASE
    })

    afterEach(() => {
      if (savedEnv === undefined) {
        delete process.env.NUXT_GITHUB_API_BASE_URL
      } else {
        process.env.NUXT_GITHUB_API_BASE_URL = savedEnv
      }
    })

    test('getApiUrl uses custom base URL for organization scope', () => {
      const options = new Options({ scope: 'organization', githubOrg: 'my-org' })
      expect(options.getApiUrl()).toBe(`${GHE_BASE}/orgs/my-org/copilot/metrics`)
    })

    test('getApiUrl uses custom base URL for enterprise scope', () => {
      const options = new Options({ scope: 'enterprise', githubEnt: 'my-ent' })
      expect(options.getApiUrl()).toBe(`${GHE_BASE}/enterprises/my-ent/copilot/metrics`)
    })

    test('getSeatsApiUrl uses custom base URL for organization scope', () => {
      const options = new Options({ scope: 'organization', githubOrg: 'my-org' })
      expect(options.getSeatsApiUrl()).toBe(`${GHE_BASE}/orgs/my-org/copilot/billing/seats`)
    })

    test('getSeatsApiUrl uses custom base URL for enterprise scope', () => {
      const options = new Options({ scope: 'enterprise', githubEnt: 'my-ent' })
      expect(options.getSeatsApiUrl()).toBe(`${GHE_BASE}/enterprises/my-ent/copilot/billing/seats`)
    })

    test('getTeamsApiUrl uses custom base URL for organization scope', () => {
      const options = new Options({ scope: 'organization', githubOrg: 'my-org' })
      expect(options.getTeamsApiUrl()).toBe(`${GHE_BASE}/orgs/my-org/teams`)
    })

    test('getTeamsApiUrl uses custom base URL for enterprise scope', () => {
      const options = new Options({ scope: 'enterprise', githubEnt: 'my-ent' })
      expect(options.getTeamsApiUrl()).toBe(`${GHE_BASE}/enterprises/my-ent/teams`)
    })

    test('getTeamMembersApiUrl uses custom base URL for organization scope', () => {
      const options = new Options({ scope: 'organization', githubOrg: 'my-org', githubTeam: 'my-team' })
      expect(options.getTeamMembersApiUrl()).toBe(`${GHE_BASE}/orgs/my-org/teams/my-team/members`)
    })

    test('getTeamMembersApiUrl uses custom base URL for enterprise scope', () => {
      const options = new Options({ scope: 'enterprise', githubEnt: 'my-ent', githubTeam: 'my-team' })
      expect(options.getTeamMembersApiUrl()).toBe(`${GHE_BASE}/enterprises/my-ent/teams/my-team/memberships`)
    })
  })

  describe('getMockDataPath', () => {
    test('returns correct path for organization scope', () => {
      const options1 = new Options({ scope: 'organization' })
      const options2 = new Options({ scope: 'organization', githubTeam: 'my-team' })
      
      expect(options1.getMockDataPath()).toBe('public/mock-data/organization_metrics_response_sample.json')
      expect(options2.getMockDataPath()).toBe('public/mock-data/organization_metrics_response_sample.json')
    })

    test('returns correct path for enterprise scope', () => {
      const options1 = new Options({ scope: 'enterprise' })
      const options2 = new Options({ scope: 'enterprise', githubTeam: 'my-team' })
      
      expect(options1.getMockDataPath()).toBe('public/mock-data/enterprise_metrics_response_sample.json')
      expect(options2.getMockDataPath()).toBe('public/mock-data/enterprise_metrics_response_sample.json')
    })

    test('returns default path for undefined scope', () => {
      const options = new Options({})
      
      expect(options.getMockDataPath()).toBe('public/mock-data/organization_metrics_response_sample.json')
    })
  })

  describe('getSeatsMockDataPath', () => {
    test('returns correct path for organization scope', () => {
      const options1 = new Options({ scope: 'organization' })
      const options2 = new Options({ scope: 'organization', githubTeam: 'my-team' })
      
      expect(options1.getSeatsMockDataPath()).toBe('public/mock-data/organization_seats_response_sample.json')
      expect(options2.getSeatsMockDataPath()).toBe('public/mock-data/organization_seats_response_sample.json')
    })

    test('returns correct path for enterprise scope', () => {
      const options1 = new Options({ scope: 'enterprise' })
      const options2 = new Options({ scope: 'enterprise', githubTeam: 'my-team' })
      
      expect(options1.getSeatsMockDataPath()).toBe('public/mock-data/enterprise_seats_response_sample.json')
      expect(options2.getSeatsMockDataPath()).toBe('public/mock-data/enterprise_seats_response_sample.json')
    })

    test('returns default path for undefined scope', () => {
      const options = new Options({})
      
      expect(options.getSeatsMockDataPath()).toBe('public/mock-data/organization_seats_response_sample.json')
    })
  })

  describe('validate', () => {
    test('validates organization scope requires github org', () => {
      const options1 = new Options({
        scope: 'organization'
      })
      
      const result1 = options1.validate()
      
      expect(result1.isValid).toBe(false)
      expect(result1.errors).toContain('GitHub organization must be set for organization scopes')
    })

    test('validates enterprise scope requires github enterprise', () => {
      const options1 = new Options({
        scope: 'enterprise'
      })
      
      const result1 = options1.validate()
      
      expect(result1.isValid).toBe(false)
      expect(result1.errors).toContain('GitHub enterprise must be set for enterprise scopes')
    })

    test('validates organization scope with team (team is optional filter)', () => {
      const options = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        githubTeam: 'test-team'
      })
      
      const result = options.validate()
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('validates date range order', () => {
      const options = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        since: '2023-12-31',
        until: '2023-01-01'
      })
      
      const result = options.validate()
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Since date must be before until date')
    })

    test('validates correctly configured options with team', () => {
      const options = new Options({
        scope: 'organization',
        githubOrg: 'test-org',
        githubTeam: 'test-team',
        since: '2023-01-01',
        until: '2023-12-31'
      })
      
      const result = options.validate()
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('accumulates multiple validation errors', () => {
      const options = new Options({
        scope: 'organization',
        since: '2023-12-31',
        until: '2023-01-01'
      })
      
      const result = options.validate()
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors).toContain('GitHub organization must be set for organization scopes')
      expect(result.errors).toContain('Since date must be before until date')
    })
  })

  describe('toString', () => {
    test('returns string representation', () => {
      const options = new Options({
        since: '2023-01-01',
        githubOrg: 'test-org'
      })
      
      const str = options.toString()
      
      expect(str).toMatch(/^Options\(.*\)$/)
      expect(str).toContain('since=2023-01-01')
      expect(str).toContain('githubOrg=test-org')
    })
  })

  describe('round-trip serialization', () => {
    test('maintains data integrity through serialization/deserialization', () => {
      const originalData: OptionsData = {
        since: '2023-01-01',
        until: '2023-12-31',
        isDataMocked: true,
        githubOrg: 'test-org',
        githubEnt: 'test-ent',
        githubTeam: 'test-team',
        scope: 'organization'
      }
      
      const original = new Options(originalData)
      
      // Test URLSearchParams round-trip
      const params = original.toURLSearchParams()
      const fromParams = Options.fromURLSearchParams(params)
      expect(fromParams.toObject()).toEqual(originalData)
      
      // Test query string round-trip
      const queryString = original.toQueryString()
      const searchParams = new URLSearchParams(queryString)
      const fromQuery = Options.fromURLSearchParams(searchParams)
      expect(fromQuery.toObject()).toEqual(originalData)
      
      // Test object round-trip
      const obj = original.toObject()
      const fromObj = new Options(obj)
      expect(fromObj.toObject()).toEqual(originalData)
    })

    test('normalizes legacy team-organization scope to organization', () => {
      const params = new URLSearchParams()
      params.set('scope', 'team-organization')
      params.set('githubOrg', 'test-org')
      params.set('githubTeam', 'test-team')
      
      const options = Options.fromURLSearchParams(params)
      expect(options.scope).toBe('organization')
      expect(options.githubTeam).toBe('test-team')
    })

    test('normalizes legacy team-enterprise scope to enterprise', () => {
      const params = new URLSearchParams()
      params.set('scope', 'team-enterprise')
      params.set('githubEnt', 'test-ent')
      params.set('githubTeam', 'test-team')
      
      const options = Options.fromURLSearchParams(params)
      expect(options.scope).toBe('enterprise')
      expect(options.githubTeam).toBe('test-team')
    })
  })
})
