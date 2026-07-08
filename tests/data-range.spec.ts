/**
 * Tests for the /api/data-range endpoint.
 *
 * The endpoint reports the available data window in three modes:
 *   - mock: derived from the bundled mock JSON
 *   - historical: derived from MIN/MAX(metrics_date) in storage tables
 *   - live: rolling 28-day window ending yesterday
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Nitro global stubs ───────────────────────────────────────────────────────
;(globalThis as any).defineEventHandler = (h: any) => h
;(globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
  const err: any = new Error(statusMessage)
  err.statusCode = statusCode
  return err
}
let _query: Record<string, string> = {}
;(globalThis as any).getQuery = () => _query
function setQuery(q: Record<string, string>) { _query = q }

// ── Storage mock ─────────────────────────────────────────────────────────────
const mockPoolQuery = vi.fn()
vi.mock('../server/storage/db', () => ({
  getPool: () => ({ query: (...args: any[]) => mockPoolQuery(...args) }),
  isDbConfigured: () => !!process.env.DATABASE_URL,
}))

/** Build an empty H3-style event (the handler does not read it directly). */
function makeEvent() {
  return { context: { headers: new Headers() }, node: { req: { url: '/api/data-range' } } }
}

const ORIG_DBURL = process.env.DATABASE_URL
const ORIG_MOCKED = process.env.NUXT_PUBLIC_IS_DATA_MOCKED

describe('/api/data-range handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DATABASE_URL
    delete process.env.NUXT_PUBLIC_IS_DATA_MOCKED
    setQuery({ scope: 'organization', githubOrg: 'test-org' })
  })

  afterEach(() => {
    if (ORIG_DBURL === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = ORIG_DBURL
    if (ORIG_MOCKED === undefined) delete process.env.NUXT_PUBLIC_IS_DATA_MOCKED
    else process.env.NUXT_PUBLIC_IS_DATA_MOCKED = ORIG_MOCKED
  })

  it('mock mode: returns earliest/latest derived from bundled mock JSON', async () => {
    setQuery({ scope: 'organization', githubOrg: 'test-org', isDataMocked: 'true' })

    const { default: handler } = await import('../server/api/data-range')
    const result = await handler(makeEvent() as any)

    expect(result.mode).toBe('mock')
    expect(result.earliest).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.latest).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.earliest <= result.latest).toBe(true)
    // mock pool should never be queried in mock mode
    expect(mockPoolQuery).not.toHaveBeenCalled()
  })

  it('live mode: falls back to 28-day window when DB has no data', async () => {
    // DB is now always probed; simulate empty DB to land in live mode.
    mockPoolQuery.mockResolvedValue({ rows: [{ earliest: null, latest: null }] })

    const { default: handler } = await import('../server/api/data-range')
    const result = await handler(makeEvent() as any)

    expect(result.mode).toBe('live')
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const earliest = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    expect(result.latest).toBe(yesterday)
    expect(result.earliest).toBe(earliest)
  })

  it('returns DB-derived range when storage has data (no env flag required)', async () => {
    // Use a "latest" that is >= yesterday so the widening in bug #412 is a no-op
    // and this test can assert the raw DB output.
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    mockPoolQuery.mockResolvedValue({
      rows: [{ earliest: '2026-01-15', latest: today }],
    })

    const { default: handler } = await import('../server/api/data-range')
    const result = await handler(makeEvent() as any)

    expect(result).toEqual({ earliest: '2026-01-15', latest: today, mode: 'historical' })
  })

  it('historical mode: returns DB-derived earliest/latest', async () => {
    process.env.DATABASE_URL = 'postgres://test'
    // Use a "latest" that is >= yesterday so the widening in bug #412 is a no-op.
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    mockPoolQuery.mockResolvedValue({
      rows: [{ earliest: '2026-01-15', latest: today }],
    })

    const { default: handler } = await import('../server/api/data-range')
    const result = await handler(makeEvent() as any)

    expect(result).toEqual({ earliest: '2026-01-15', latest: today, mode: 'historical' })
    expect(mockPoolQuery).toHaveBeenCalledTimes(1)
    // organization (not the team-* variant) is forwarded to the query
    const [, params] = mockPoolQuery.mock.calls[0]!
    expect(params).toEqual(['organization', 'test-org'])
  })

  it('historical mode: strips team- prefix to base scope', async () => {
    process.env.DATABASE_URL = 'postgres://test'
    setQuery({ scope: 'team-organization', githubOrg: 'test-org', githubTeam: 'a-team' })
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    mockPoolQuery.mockResolvedValue({
      rows: [{ earliest: '2026-01-15', latest: today }],
    })

    const { default: handler } = await import('../server/api/data-range')
    await handler(makeEvent() as any)

    const [, params] = mockPoolQuery.mock.calls[0]!
    expect(params).toEqual(['organization', 'test-org'])
  })

  it('historical mode: falls back to live window when DB has no data', async () => {
    process.env.DATABASE_URL = 'postgres://test'
    mockPoolQuery.mockResolvedValue({ rows: [{ earliest: null, latest: null }] })

    const { default: handler } = await import('../server/api/data-range')
    const result = await handler(makeEvent() as any)

    expect(result.mode).toBe('live')
    expect(result.earliest).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.latest).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('historical mode: falls back to live window when the DB query throws', async () => {
    process.env.DATABASE_URL = 'postgres://test'
    mockPoolQuery.mockRejectedValue(new Error('connection refused'))

    const { default: handler } = await import('../server/api/data-range')
    const result = await handler(makeEvent() as any)

    expect(result.mode).toBe('live')
  })

  // ── Bug #412: picker "To Date" was 1-2 days behind yesterday ────────────────
  // Historical MAX(metrics_date) lags behind the calendar because the sync
  // container only ingests once/day. The billing tile pulls live from GitHub
  // so it can show yesterday even when the picker won't let you select it.
  // Fix: widen `latest` to at least yesterday (UTC).

  it('historical mode: extends latest to yesterday when DB max lags behind', async () => {
    process.env.DATABASE_URL = 'postgres://test'
    // Simulate a DB whose most recent row is 5 days old.
    const now = new Date()
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    mockPoolQuery.mockResolvedValue({
      rows: [{ earliest: '2026-01-15', latest: fiveDaysAgo }],
    })

    const { default: handler } = await import('../server/api/data-range')
    const result = await handler(makeEvent() as any)

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    expect(result.mode).toBe('historical')
    expect(result.earliest).toBe('2026-01-15') // honest DB earliest
    expect(result.latest).toBe(yesterday)      // widened to yesterday
  })

  it('historical mode: keeps DB latest when it is already past yesterday', async () => {
    process.env.DATABASE_URL = 'postgres://test'
    // A DB with data through today (or later — e.g. clock skew, timezones)
    // should not be truncated back to yesterday.
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    mockPoolQuery.mockResolvedValue({
      rows: [{ earliest: '2026-01-15', latest: today }],
    })

    const { default: handler } = await import('../server/api/data-range')
    const result = await handler(makeEvent() as any)

    expect(result.mode).toBe('historical')
    expect(result.latest).toBe(today)
  })
})
