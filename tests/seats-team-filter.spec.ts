/**
 * Tests for seat team-membership filtering in /api/seats.
 *
 * Covers:
 *  - filterSeatsByTeamMembers() pure function
 *  - Historical mode (no auth) + team scope → 503
 *  - Historical mode (with auth) + team scope → filtered result
 *  - reports-to: virtual team handling in fetchAllTeamMembers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Seat } from '@/model/Seat'
import type { TeamMember } from '../server/api/seats'
import { filterSeatsByTeamMembers } from '../server/utils/seats-filter'
import { Options } from '@/model/Options'

// ── filterSeatsByTeamMembers unit tests ──────────────────────────────────────

const makeSeat = (login: string, id: number): Seat =>
  new Seat({
    assignee: { login, id },
    assigning_team: { name: 'Team A' },
    created_at: '2024-01-01T00:00:00Z',
    last_activity_at: '2024-06-01T00:00:00Z',
    last_activity_editor: 'vscode',
  })

const makeMembers = (...users: Array<{ login: string; id: number }>): TeamMember[] =>
  users.map(u => ({ login: u.login, id: u.id }))

describe('filterSeatsByTeamMembers()', () => {
  it('keeps seats whose user id is in the team', () => {
    const seats = [makeSeat('octocat', 1), makeSeat('octokitten', 2)]
    const members = makeMembers({ login: 'octocat', id: 1 })
    const result = filterSeatsByTeamMembers(seats, members)
    expect(result).toHaveLength(1)
    expect(result[0].login).toBe('octocat')
  })

  it('returns all seats when teamMembers is empty (no filtering)', () => {
    const seats = [makeSeat('octocat', 1), makeSeat('octokitten', 2)]
    const result = filterSeatsByTeamMembers(seats, [])
    expect(result).toHaveLength(2)
  })

  it('falls back to login match when seat id is 0', () => {
    // A seat with id=0 (assignee missing id) should still be matched by login
    const seat = makeSeat('octocat', 0)
    const members = makeMembers({ login: 'octocat', id: 1 })
    const result = filterSeatsByTeamMembers([seat], members)
    expect(result).toHaveLength(1)
    expect(result[0].login).toBe('octocat')
  })

  it('login comparison is case-insensitive', () => {
    const seats = [makeSeat('OctoCAT', 0)]
    const members = makeMembers({ login: 'octocat', id: 1 })
    const result = filterSeatsByTeamMembers([seats[0]], members)
    expect(result).toHaveLength(1)
  })

  it('excludes seats whose user is not a team member', () => {
    const seats = [makeSeat('octocat', 1), makeSeat('octokitten', 2), makeSeat('hubot', 3)]
    const members = makeMembers({ login: 'octocat', id: 1 }, { login: 'hubot', id: 3 })
    const result = filterSeatsByTeamMembers(seats, members)
    expect(result).toHaveLength(2)
    expect(result.map(s => s.login)).toEqual(expect.arrayContaining(['octocat', 'hubot']))
    expect(result.map(s => s.login)).not.toContain('octokitten')
  })
})

// ── /api/seats handler — historical mode team filtering ──────────────────────
//
// Stubs Nitro globals so the handler can be imported without a full runtime.

;(globalThis as any).defineEventHandler = (h: any) => h
;(globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
  const err: any = new Error(statusMessage)
  err.statusCode = statusCode
  return err
}
;(globalThis as any).getQuery = (_event: any) => ({
  scope: 'organization',
  githubOrg: 'test-org',
  githubTeam: 'the-a-team',
})

const mockGetLatestSeats = vi.fn()

vi.mock('../server/storage/seats-storage', () => ({
  getLatestSeats: (...args: any[]) => mockGetLatestSeats(...args),
  storeSeats: vi.fn(),
}))

const seatOctocat    = makeSeat('octocat',    1)
const seatOctokitten = makeSeat('octokitten', 2)

function makeEvent(withAuth: boolean): any {
  const headers = new Headers()
  if (withAuth) headers.set('Authorization', 'Bearer test-token')
  return { context: { headers }, node: { req: { url: '/api/seats' } } }
}

describe('/api/seats handler – historical mode team filtering', () => {
  const ORIG_HISTORICAL = process.env.ENABLE_HISTORICAL_MODE
  const ORIG_MOCKED     = process.env.NUXT_PUBLIC_IS_DATA_MOCKED
  const ORIG_GET_QUERY  = (globalThis as any).getQuery

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_HISTORICAL_MODE    = 'true'
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'false'
    // Storage returns both users
    mockGetLatestSeats.mockResolvedValue([seatOctocat, seatOctokitten])
  })

  afterEach(() => {
    if (ORIG_HISTORICAL === undefined) delete process.env.ENABLE_HISTORICAL_MODE
    else process.env.ENABLE_HISTORICAL_MODE = ORIG_HISTORICAL

    if (ORIG_MOCKED === undefined) delete process.env.NUXT_PUBLIC_IS_DATA_MOCKED
    else process.env.NUXT_PUBLIC_IS_DATA_MOCKED = ORIG_MOCKED

    ;(globalThis as any).getQuery = ORIG_GET_QUERY
  })

  it('throws 503 when team is requested in historical mode without auth', async () => {
    // No auth + historical mode + team → cannot filter without fetching members → 503
    const { default: handler } = await import('../server/api/seats')
    await expect(handler(makeEvent(false))).rejects.toMatchObject({ statusCode: 503 })
  })

  it('filters stored seats by team members in historical mode with auth', async () => {
    // With auth, handler should fetch team members and filter stored seats.
    // $fetch is called by fetchAllTeamMembers — stub it to return only octocat.
    const mockFetch = vi.fn().mockResolvedValueOnce([
      { login: 'octocat', id: 1 },   // page 1 → only member
    ])
    ;(globalThis as any).$fetch = mockFetch

    const { default: handler } = await import('../server/api/seats')
    const result = await handler(makeEvent(true)) as any

    expect(result.seats).toHaveLength(1)
    expect(result.seats[0].login).toBe('octocat')
    expect(result.total_seats).toBe(1)
  })
})

// ── fetchAllTeamMembers — reports-to: virtual team ───────────────────────────

describe('fetchAllTeamMembers – reports-to: virtual team', () => {
  it('returns pre-resolved logins when reportToLogins is set', async () => {
    const { fetchAllTeamMembers } = await import('../server/api/seats')
    const options = new Options({
      githubOrg: 'octodemo',
      scope: 'organization',
      githubTeam: 'reports-to:monalisa@octodemo.com',
      reportToLogins: ['monalisa', 'defunkt', 'octocat'],
    })
    const members = await fetchAllTeamMembers(options, new Headers())
    expect(members.map(m => m.login)).toEqual(['monalisa', 'defunkt', 'octocat'])
    // Synthetic members have id: 0
    expect(members.every(m => m.id === 0)).toBe(true)
  })

  it('resolves from mock Entra tree when no reportToLogins (mock mode)', async () => {
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'true'
    const { fetchAllTeamMembers } = await import('../server/api/seats')
    const options = new Options({
      githubOrg: 'octodemo',
      scope: 'organization',
      githubTeam: 'reports-to:monalisa@octodemo.com',
      isDataMocked: true,
    })
    const members = await fetchAllTeamMembers(options, new Headers())
    // monalisa@octodemo.com should resolve to 'monalisa' login (and descendants)
    const logins = members.map(m => m.login)
    expect(logins).toContain('monalisa')
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'false'
  })

  it('returns empty array when reports-to team has no reportToLogins in real mode', async () => {
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'false'
    const { fetchAllTeamMembers } = await import('../server/api/seats')
    const options = new Options({
      githubOrg: 'octodemo',
      scope: 'organization',
      githubTeam: 'reports-to:unknown@octodemo.com',
      isDataMocked: false,
    })
    const members = await fetchAllTeamMembers(options, new Headers())
    expect(members).toHaveLength(0)
  })
})
