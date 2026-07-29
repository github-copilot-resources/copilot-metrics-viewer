/**
 * Unit tests for the pure date-range helpers in server/utils/data-range-utils.ts.
 *
 * These functions have no Nuxt auto-import dependencies and run in plain Node.
 */

import { describe, it, expect, vi } from 'vitest'

// ── Break the pg import chain ─────────────────────────────────────────────────
// data-range-utils imports baseScope from user-day-metrics-storage, which
// itself imports getPool (pg). Mocking the db module avoids the native-module
// error without affecting baseScope, which is a pure string transform.
vi.mock('../server/storage/db', () => ({
  getPool: vi.fn(),
  isDbConfigured: vi.fn(),
}))

import {
  toIsoDay,
  yesterdayIso,
  liveWindow,
  collectMockDays,
  mockRange,
} from '../server/utils/data-range-utils'

// ── toIsoDay ─────────────────────────────────────────────────────────────────

describe('toIsoDay', () => {
  it('formats a Date as YYYY-MM-DD (UTC)', () => {
    const d = new Date('2026-03-15T12:34:56Z')
    expect(toIsoDay(d)).toBe('2026-03-15')
  })

  it('uses UTC (not local time), so midnight UTC stays on the same day', () => {
    const d = new Date('2026-03-15T00:00:00Z')
    expect(toIsoDay(d)).toBe('2026-03-15')
  })
})

// ── yesterdayIso ─────────────────────────────────────────────────────────────

describe('yesterdayIso', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(yesterdayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns a date strictly before today (UTC)', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(yesterdayIso() < today).toBe(true)
  })

  it('is within 2 days of today', () => {
    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000
    const yesterday = new Date(now.getTime() - dayMs).toISOString().slice(0, 10)
    expect(yesterdayIso()).toBe(yesterday)
  })
})

// ── liveWindow ───────────────────────────────────────────────────────────────

describe('liveWindow', () => {
  it('returns an object with earliest and latest YYYY-MM-DD strings', () => {
    const { earliest, latest } = liveWindow()
    expect(earliest).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(latest).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('latest equals yesterday', () => {
    const { latest } = liveWindow()
    expect(latest).toBe(yesterdayIso())
  })

  it('spans exactly 28 days (27 days before latest)', () => {
    const { earliest, latest } = liveWindow()
    const earlyMs = new Date(`${earliest}T00:00:00Z`).getTime()
    const lateMs  = new Date(`${latest}T00:00:00Z`).getTime()
    const daysDiff = (lateMs - earlyMs) / (24 * 60 * 60 * 1000)
    expect(daysDiff).toBe(27)
  })

  it('earliest is before latest', () => {
    const { earliest, latest } = liveWindow()
    expect(earliest < latest).toBe(true)
  })
})

// ── collectMockDays ───────────────────────────────────────────────────────────

describe('collectMockDays', () => {
  it('returns an empty array when day_totals is missing', () => {
    expect(collectMockDays({})).toEqual([])
  })

  it('returns an empty array when day_totals is not an array', () => {
    expect(collectMockDays({ day_totals: 'bad' })).toEqual([])
  })

  it('returns an empty array for an empty day_totals array', () => {
    expect(collectMockDays({ day_totals: [] })).toEqual([])
  })

  it('extracts valid YYYY-MM-DD day strings', () => {
    const input = {
      day_totals: [
        { day: '2026-01-01' },
        { day: '2026-01-02' },
        { day: '2026-01-03' },
      ],
    }
    expect(collectMockDays(input)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  it('filters out non-conforming day strings', () => {
    const input = {
      day_totals: [
        { day: '2026-01-01' },
        { day: 'not-a-date' },
        { day: '20260102' },
        { day: '2026-13-01' }, // invalid month still matches regex — only format is checked
        { other: 'field' },    // missing day property
      ],
    }
    const result = collectMockDays(input)
    expect(result).toContain('2026-01-01')
    expect(result).not.toContain('not-a-date')
    expect(result).not.toContain('20260102')
  })

  it('filters out entries with a missing day property', () => {
    const input = { day_totals: [{ other: 'field' }] }
    expect(collectMockDays(input)).toEqual([])
  })
})

// ── mockRange ─────────────────────────────────────────────────────────────────

describe('mockRange', () => {
  const orgJson  = { day_totals: [{ day: '2026-01-05' }, { day: '2026-01-01' }, { day: '2026-01-10' }] }
  const entJson  = { day_totals: [{ day: '2026-02-01' }, { day: '2026-02-28' }] }
  const orgUsers = { day_totals: [{ day: '2026-01-03' }, { day: '2026-01-15' }] }
  const entUsers = { day_totals: [{ day: '2026-02-05' }, { day: '2026-03-01' }] }

  it('returns the correct earliest/latest for organization scope', () => {
    const result = mockRange('organization', orgJson, entJson, orgUsers, entUsers)
    // org days: 2026-01-05, 2026-01-01, 2026-01-10 + orgUsers: 2026-01-03, 2026-01-15
    expect(result.earliest).toBe('2026-01-01')
    expect(result.latest).toBe('2026-01-15')
  })

  it('returns the correct earliest/latest for enterprise scope', () => {
    const result = mockRange('enterprise', orgJson, entJson, orgUsers, entUsers)
    // ent days: 2026-02-01, 2026-02-28 + entUsers: 2026-02-05, 2026-03-01
    expect(result.earliest).toBe('2026-02-01')
    expect(result.latest).toBe('2026-03-01')
  })

  it('treats team-organization scope as organization', () => {
    const result = mockRange('team-organization', orgJson, entJson, orgUsers, entUsers)
    expect(result.earliest).toBe('2026-01-01')
  })

  it('treats team-enterprise scope as enterprise', () => {
    const result = mockRange('team-enterprise', orgJson, entJson, orgUsers, entUsers)
    expect(result.earliest).toBe('2026-02-01')
  })

  it('falls back to liveWindow when all day_totals are empty', () => {
    const empty = { day_totals: [] }
    const result = mockRange('organization', empty, empty, empty, empty)
    // liveWindow returns yesterday as latest
    expect(result.latest).toBe(yesterdayIso())
    expect(result.earliest).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('falls back to liveWindow when day_totals are missing', () => {
    const result = mockRange('organization', {}, {}, {}, {})
    expect(result.latest).toBe(yesterdayIso())
  })
})
