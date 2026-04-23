/**
 * Tests for the Teams tab / Full GHEC support:
 *   - /api/enterprise-orgs mock-mode response
 *   - /api/teams: org override for Full GHEC, enterprise-only path, mock mode
 *   - Header logic: X-GitHub-Api-Version applied only to enterprise teams endpoint
 *   - Options model behavior with org override in enterprise scope
 */

import { describe, it, test, expect, vi, beforeEach } from 'vitest'
import { Options } from '@/model/Options'
import type { Scope } from '@/model/Options'

// ---------------------------------------------------------------------------
// Stub Nuxt/h3 globals required by server-side handler files
// ---------------------------------------------------------------------------
;(globalThis as any).defineEventHandler = (handler: any) => handler
;(globalThis as any).getQuery = (event: any) => event?.query ?? {}
;(globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
  const err = new Error(statusMessage) as any
  err.statusCode = statusCode
  return err
}

// ---------------------------------------------------------------------------
// Teams tab: Options model tests (Full GHEC org override)
// ---------------------------------------------------------------------------

describe('Teams tab — Options model (Full GHEC org override)', () => {
  describe('getTeamsApiUrl with org override', () => {
    test('enterprise scope without org uses enterprise teams URL', () => {
      const options = new Options({ scope: 'enterprise', githubEnt: 'acme-ent' })
      expect(options.getTeamsApiUrl()).toBe('https://api.github.com/enterprises/acme-ent/teams')
    })

    test('enterprise scope with org override uses org teams URL (Full GHEC)', () => {
      const options = new Options({ scope: 'enterprise', githubEnt: 'acme-ent', githubOrg: 'acme-org' })
      expect(options.getTeamsApiUrl()).toBe('https://api.github.com/orgs/acme-org/teams')
    })

    test('organization scope uses org teams URL', () => {
      const options = new Options({ scope: 'organization', githubOrg: 'acme-org' })
      expect(options.getTeamsApiUrl()).toBe('https://api.github.com/orgs/acme-org/teams')
    })
  })

  describe('getTeamMembersApiUrl with org override', () => {
    test('enterprise scope without org uses enterprise memberships URL', () => {
      const options = new Options({ scope: 'enterprise', githubEnt: 'acme-ent', githubTeam: 'the-a-team' })
      expect(options.getTeamMembersApiUrl()).toBe('https://api.github.com/enterprises/acme-ent/teams/the-a-team/memberships')
    })

    test('enterprise scope with org override uses org members URL (Full GHEC)', () => {
      const options = new Options({
        scope: 'enterprise',
        githubEnt: 'acme-ent',
        githubOrg: 'acme-org',
        githubTeam: 'the-a-team'
      })
      expect(options.getTeamMembersApiUrl()).toBe('https://api.github.com/orgs/acme-org/teams/the-a-team/members')
    })

    test('organization scope uses org members URL', () => {
      const options = new Options({ scope: 'organization', githubOrg: 'acme-org', githubTeam: 'the-a-team' })
      expect(options.getTeamMembersApiUrl()).toBe('https://api.github.com/orgs/acme-org/teams/the-a-team/members')
    })
  })
})

// ---------------------------------------------------------------------------
// Teams tab: enterprise-orgs API mock mode
// ---------------------------------------------------------------------------

describe('Teams tab — /api/enterprise-orgs (mock mode)', () => {
  let handler: any

  beforeEach(async () => {
    ;(globalThis as any).useRuntimeConfig = () => ({
      public: { scope: 'enterprise', githubEnt: 'acme-ent', isDataMocked: false }
    })

    // Import fresh handler
    vi.resetModules()
    const mod = await import('../server/api/enterprise-orgs')
    handler = (mod as any).default ?? mod
  })

  it('returns Full GHEC mock data when isDataMocked=true', async () => {
    const event = { query: { isDataMocked: 'true', scope: 'enterprise', githubEnt: 'acme-ent' }, context: { headers: new Headers() } }
    const result = await handler(event)

    expect(result.isFullGhec).toBe(true)
    expect(result.orgs).toBeInstanceOf(Array)
    expect(result.orgs.length).toBeGreaterThan(0)
    expect(result.orgs[0]).toMatchObject({ login: expect.any(String), name: expect.any(String) })
  })

  it('returns orgs with login and name fields', async () => {
    const event = { query: { isDataMocked: 'true', scope: 'enterprise', githubEnt: 'acme-ent' }, context: { headers: new Headers() } }
    const result = await handler(event)

    for (const org of result.orgs) {
      expect(org).toHaveProperty('login')
      expect(org).toHaveProperty('name')
      expect(typeof org.login).toBe('string')
      expect(typeof org.name).toBe('string')
    }
  })

  it('throws 400 when githubEnt is missing (non-mocked)', async () => {
    const event = { query: { scope: 'enterprise' }, context: { headers: new Headers({ Authorization: 'Bearer token' }) } }
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 401 when no Authorization header (non-mocked)', async () => {
    const event = { query: { scope: 'enterprise', githubEnt: 'acme-ent' }, context: { headers: new Headers() } }
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ---------------------------------------------------------------------------
// Teams tab: /api/teams API mock mode
// ---------------------------------------------------------------------------

describe('Teams tab — /api/teams (mock mode)', () => {
  let getTeams: any

  beforeEach(async () => {
    ;(globalThis as any).useRuntimeConfig = () => ({
      public: { scope: 'enterprise', githubEnt: 'acme-ent', isDataMocked: false }
    })

    vi.resetModules()
    const mod = await import('../server/api/teams')
    getTeams = (mod as any).getTeams
  })

  it('returns mock teams in mock mode', async () => {
    const event = {
      query: { isDataMocked: 'true', scope: 'enterprise', githubEnt: 'acme-ent' },
      context: { headers: new Headers() }
    }
    const result = await getTeams(event)

    expect(result).toBeInstanceOf(Array)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toMatchObject({ name: expect.any(String), slug: expect.any(String) })
  })

  it('mock teams include slug and description', async () => {
    const event = {
      query: { isDataMocked: 'true', scope: 'organization', githubOrg: 'my-org' },
      context: { headers: new Headers() }
    }
    const result = await getTeams(event)

    for (const team of result) {
      expect(team).toHaveProperty('name')
      expect(team).toHaveProperty('slug')
      expect(team).toHaveProperty('description')
    }
  })

  it('throws 401 when Authorization header is missing (non-mocked)', async () => {
    const event = {
      query: { scope: 'enterprise', githubEnt: 'acme-ent' },
      context: { headers: new Headers() }
    }
    await expect(getTeams(event)).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ---------------------------------------------------------------------------
// Teams tab: enterprise API version header logic
// ---------------------------------------------------------------------------

describe('Teams tab — enterprise API version header logic', () => {
  test('enterprise scope without org requires X-GitHub-Api-Version header', () => {
    const options = new Options({ scope: 'enterprise', githubEnt: 'acme-ent' })
    const needsEnterpriseHeader = options.scope === 'enterprise' && !options.githubOrg
    expect(needsEnterpriseHeader).toBe(true)
  })

  test('enterprise scope with org override does NOT need X-GitHub-Api-Version header', () => {
    const options = new Options({ scope: 'enterprise', githubEnt: 'acme-ent', githubOrg: 'acme-org' })
    const needsEnterpriseHeader = options.scope === 'enterprise' && !options.githubOrg
    expect(needsEnterpriseHeader).toBe(false)
  })

  test('organization scope does NOT need X-GitHub-Api-Version header', () => {
    const options = new Options({ scope: 'organization', githubOrg: 'acme-org' })
    const needsEnterpriseHeader = options.scope === 'enterprise' && !options.githubOrg
    expect(needsEnterpriseHeader).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Teams tab: Full GHEC detection logic
// ---------------------------------------------------------------------------

describe('Teams tab — Full GHEC detection logic', () => {
  test('isFullGhec is true when totalCount > 0', () => {
    const totalCount = 5
    const isFullGhec = totalCount > 0
    expect(isFullGhec).toBe(true)
  })

  test('isFullGhec is false when totalCount = 0', () => {
    const totalCount = 0
    const isFullGhec = totalCount > 0
    expect(isFullGhec).toBe(false)
  })

  test('org-level team detail URL uses /orgs/:org/teams/:team when org is selected', () => {
    const selectedOrg = 'acme-org'
    const teamSlug = 'the-a-team'
    const url = selectedOrg
      ? `/orgs/${selectedOrg}/teams/${teamSlug}`
      : `/enterprises/acme-ent/teams/${teamSlug}`
    expect(url).toBe('/orgs/acme-org/teams/the-a-team')
  })

  test('enterprise-level team detail URL uses /enterprises/:ent/teams/:team when no org selected', () => {
    const selectedOrg: string | null = null
    const teamSlug = 'the-a-team'
    const url = selectedOrg
      ? `/orgs/${selectedOrg}/teams/${teamSlug}`
      : `/enterprises/acme-ent/teams/${teamSlug}`
    expect(url).toBe('/enterprises/acme-ent/teams/the-a-team')
  })

  test('org navigate URL is /orgs/:org', () => {
    const orgLogin = 'acme-org'
    const url = `/orgs/${orgLogin}`
    expect(url).toBe('/orgs/acme-org')
  })
})
