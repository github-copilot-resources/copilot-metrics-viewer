/**
 * Unit tests for the seat deduplication and pagination helpers.
 *
 * Tests import the real functions from server/utils/seats-dedup.ts rather than
 * re-implementing the logic inline (see Category 2 of the coverage plan).
 *
 * No Nuxt environment is needed — plain Vitest Node.
 */

import { describe, it, expect } from 'vitest'
import { Seat } from '@/model/Seat'
import { deduplicateSeats, paginateSeats, normalizeTeamMember } from '../server/utils/seats-dedup'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSeat(login: string, id: number, lastActivity: string | null = '2024-06-01T00:00:00Z', team = 'Team A'): Seat {
  return new Seat({
    assignee: { login, id },
    assigning_team: { name: team },
    created_at: '2021-08-03T18:00:00-06:00',
    last_activity_at: lastActivity,
    last_activity_editor: 'vscode/1.77.3/copilot/1.86.82',
  })
}

// ── deduplicateSeats ──────────────────────────────────────────────────────────

describe('deduplicateSeats()', () => {
  it('keeps a single seat unchanged', () => {
    const seats = [makeSeat('user1', 1)]
    expect(deduplicateSeats(seats)).toHaveLength(1)
  })

  it('deduplicates seats with the same user ID, keeping the most recent activity', () => {
    const seats = [
      makeSeat('user1', 1, '2021-10-14T00:53:32-06:00', 'Team A'),
      makeSeat('user1', 1, '2021-10-15T00:53:32-06:00', 'Team B'),
      makeSeat('user2', 2, '2021-10-12T00:53:32-06:00', 'Team A'),
    ]
    const result = deduplicateSeats(seats)
    expect(result).toHaveLength(2)
    const user1 = result.find(s => s.id === 1)
    expect(user1).toBeDefined()
    expect(user1!.team).toBe('Team B')
    expect(user1!.last_activity_at).toBe('2021-10-15T00:53:32-06:00')
    expect(result.find(s => s.id === 2)).toBeDefined()
  })

  it('keeps earlier entry when a later duplicate has older activity', () => {
    const seats = [
      makeSeat('user1', 1, '2021-10-20T00:00:00Z', 'New Team'),
      makeSeat('user1', 1, '2021-10-10T00:00:00Z', 'Old Team'),
    ]
    const result = deduplicateSeats(seats)
    expect(result).toHaveLength(1)
    expect(result[0]!.team).toBe('New Team')
  })

  it('treats null last_activity_at as the epoch (earliest possible date)', () => {
    const seats = [
      makeSeat('user1', 1, null, 'No-Activity Team'),
      makeSeat('user1', 1, '2021-10-15T00:53:32-06:00', 'Active Team'),
    ]
    const result = deduplicateSeats(seats)
    expect(result).toHaveLength(1)
    expect(result[0]!.team).toBe('Active Team')
  })

  it('skips seats whose id is 0 (not deduplicated — id-0 seats are excluded entirely)', () => {
    const seats = [
      makeSeat('ghost', 0),
      makeSeat('ghost', 0),
    ]
    // id=0 seats are skipped by deduplicateSeats
    expect(deduplicateSeats(seats)).toHaveLength(0)
  })

  it('returns an empty array for an empty input', () => {
    expect(deduplicateSeats([])).toHaveLength(0)
  })
})

// ── paginateSeats ─────────────────────────────────────────────────────────────

describe('paginateSeats()', () => {
  const makeSeats = (count: number) =>
    Array.from({ length: count }, (_, i) => makeSeat(`user${i + 1}`, i + 1))

  it('returns all seats on page 1 when count ≤ perPage', () => {
    const seats = makeSeats(3)
    const result = paginateSeats(seats, 1, 10)
    expect(result.seats).toHaveLength(3)
    expect(result.total_seats).toBe(3)
    expect(result.total_pages).toBe(1)
    expect(result.page).toBe(1)
    expect(result.per_page).toBe(10)
  })

  it('returns an empty seats array with total_pages=1 for an empty list', () => {
    const result = paginateSeats([], 1, 10)
    expect(result.seats).toHaveLength(0)
    expect(result.total_seats).toBe(0)
    expect(result.total_pages).toBe(1)
  })

  it('paginates correctly — page 2 of 2', () => {
    const seats = makeSeats(15)
    const result = paginateSeats(seats, 2, 10)
    expect(result.seats).toHaveLength(5)
    expect(result.total_seats).toBe(15)
    expect(result.total_pages).toBe(2)
    expect(result.page).toBe(2)
    // The 11th seat (index 10) should be the first on page 2
    expect(result.seats[0]!.login).toBe('user11')
  })

  it('handles a partial last page', () => {
    const seats = makeSeats(7)
    const result = paginateSeats(seats, 2, 5)
    expect(result.seats).toHaveLength(2)
    expect(result.total_pages).toBe(2)
    expect(result.page).toBe(2)
  })

  it('clamps page > total_pages to total_pages', () => {
    const seats = makeSeats(5)
    const result = paginateSeats(seats, 99, 5)
    expect(result.page).toBe(1)
    expect(result.seats).toHaveLength(5)
  })

  it('clamps page < 1 to page 1', () => {
    const seats = makeSeats(5)
    const result = paginateSeats(seats, 0, 5)
    expect(result.page).toBe(1)
  })

  it('works with per_page = 1', () => {
    const seats = makeSeats(3)
    const p1 = paginateSeats(seats, 1, 1)
    const p2 = paginateSeats(seats, 2, 1)
    const p3 = paginateSeats(seats, 3, 1)
    expect(p1.seats[0]!.login).toBe('user1')
    expect(p2.seats[0]!.login).toBe('user2')
    expect(p3.seats[0]!.login).toBe('user3')
    expect(p1.total_pages).toBe(3)
  })
})

// ── normalizeTeamMember ───────────────────────────────────────────────────────

describe('normalizeTeamMember()', () => {
  it('returns the item as-is for a flat user object with login and id', () => {
    const item = { login: 'octocat', id: 1 }
    const result = normalizeTeamMember(item)
    expect(result).not.toBeNull()
    expect(result!.login).toBe('octocat')
    expect(result!.id).toBe(1)
  })

  it('extracts from the nested user property (defensive membership shape)', () => {
    const item = { user: { login: 'defunkt', id: 2 }, role: 'member' }
    const result = normalizeTeamMember(item)
    expect(result).not.toBeNull()
    expect(result!.login).toBe('defunkt')
    expect(result!.id).toBe(2)
  })

  it('returns null when the item has neither a valid flat shape nor a nested user', () => {
    expect(normalizeTeamMember({})).toBeNull()
    expect(normalizeTeamMember({ login: 'no-id' })).toBeNull()
    expect(normalizeTeamMember({ id: 42 })).toBeNull()
  })

  it('prefers the flat shape over the nested user property', () => {
    const item = { login: 'top-login', id: 10, user: { login: 'nested-login', id: 99 } }
    const result = normalizeTeamMember(item)
    expect(result!.login).toBe('top-login')
    expect(result!.id).toBe(10)
  })

  it('returns null when nested user exists but is missing id or login', () => {
    expect(normalizeTeamMember({ user: { login: 'only-login' } })).toBeNull()
    expect(normalizeTeamMember({ user: { id: 5 } })).toBeNull()
  })
})
