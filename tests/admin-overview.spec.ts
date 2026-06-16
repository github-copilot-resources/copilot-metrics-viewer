/**
 * Tests for the /api/admin/overview endpoint and the new retry-failed
 * action on /api/admin/sync.
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
;(globalThis as any).readBody = async (_e: any) => _body
;(globalThis as any).useRuntimeConfig = () => ({ public: { version: '3.7.2' } })

let _body: Record<string, unknown> = {}
function setQuery(q: Record<string, string>) { _query = q }
function setBody(b: Record<string, unknown>) { _body = b }

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockPoolQuery = vi.fn()
vi.mock('../server/storage/db', () => ({
  getPool: () => ({ query: (...args: any[]) => mockPoolQuery(...args) }),
}))

const mockGetFailedSyncsForScope = vi.fn()
const mockGetPendingSyncsForScope = vi.fn()
vi.mock('../server/storage/sync-storage', () => ({
  getFailedSyncsForScope: (...args: any[]) => mockGetFailedSyncsForScope(...args),
  getPendingSyncsForScope: (...args: any[]) => mockGetPendingSyncsForScope(...args),
  getPendingSyncs: vi.fn(async () => []),
  getFailedSyncs: vi.fn(async () => []),
}))

const mockGetSyncStats = vi.fn()
const mockSyncMetricsForDate = vi.fn()
const mockSyncMetricsForDateRange = vi.fn()
const mockSyncGaps = vi.fn()
const mockSyncBulk = vi.fn()
vi.mock('../server/services/sync-service', () => ({
  getSyncStats: (...args: any[]) => mockGetSyncStats(...args),
  syncMetricsForDate: (...args: any[]) => mockSyncMetricsForDate(...args),
  syncMetricsForDateRange: (...args: any[]) => mockSyncMetricsForDateRange(...args),
  syncGaps: (...args: any[]) => mockSyncGaps(...args),
  syncBulk: (...args: any[]) => mockSyncBulk(...args),
}))

vi.mock('../server/services/github-copilot-usage-api-mock', () => ({
  isMockMode: () => false,
}))

function makeEvent(withAuth = true): any {
  const headers = new Headers()
  if (withAuth) headers.set('Authorization', 'Bearer test')
  return { context: { headers }, node: { req: { url: '/api/admin/overview' } } }
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('/api/admin/overview', () => {
  const ORIG_HISTORICAL = process.env.ENABLE_HISTORICAL_MODE

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ENABLE_HISTORICAL_MODE
    setQuery({ scope: 'organization', githubOrg: 'cody-test-org' })
  })
  afterEach(() => {
    if (ORIG_HISTORICAL === undefined) delete process.env.ENABLE_HISTORICAL_MODE
    else process.env.ENABLE_HISTORICAL_MODE = ORIG_HISTORICAL
  })

  it('mock mode: reports mock + skips DB probe', async () => {
    setQuery({ scope: 'organization', githubOrg: 'cody-test-org', isDataMocked: 'true' })

    const { default: handler } = await import('../server/api/admin/overview.get')
    const result = await handler(makeEvent())

    expect(result.mode).toBe('mock')
    expect(result.db.connected).toBe(false)
    expect(mockPoolQuery).not.toHaveBeenCalled()
    expect(mockGetSyncStats).not.toHaveBeenCalled()
  })

  it('live mode with DB connected: enriches (writes happen regardless of mode label)', async () => {
    // 1st query: SELECT 1 (probe)
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
    // 2nd query: data range
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ earliest: '2026-04-01', latest: '2026-06-15' }],
    })
    mockGetSyncStats.mockResolvedValueOnce({
      totalDays: 76, syncedDays: 70, missingDays: 6, missingDates: [],
    })
    mockGetPendingSyncsForScope.mockResolvedValueOnce([])
    mockGetFailedSyncsForScope.mockResolvedValueOnce([])

    const { default: handler } = await import('../server/api/admin/overview.get')
    const result = await handler(makeEvent())

    expect(result.mode).toBe('live')
    expect(result.db.connected).toBe(true)
    expect(result.dataRange).toEqual({ earliest: '2026-04-01', latest: '2026-06-15' })
    expect(result.syncStats.syncedDays).toBe(70)
  })

  it('historical mode: enriches with data range, sync stats and failures', async () => {
    process.env.ENABLE_HISTORICAL_MODE = 'true'
    // 1st query: SELECT 1 (probe)
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
    // 2nd query: data range
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ earliest: '2026-04-01', latest: '2026-06-15' }],
    })
    mockGetSyncStats.mockResolvedValueOnce({
      totalDays: 76,
      syncedDays: 70,
      missingDays: 6,
      missingDates: ['2026-04-05', '2026-04-12'],
    })
    mockGetPendingSyncsForScope.mockResolvedValueOnce([])
    mockGetFailedSyncsForScope.mockResolvedValueOnce([
      { metricsDate: '2026-05-01', errorMessage: 'boom', attemptCount: 3, lastAttemptAt: '2026-05-02T00:00:00Z' },
      { metricsDate: '2026-05-02', errorMessage: 'oops', attemptCount: 2 },
    ])

    const { default: handler } = await import('../server/api/admin/overview.get')
    const result = await handler(makeEvent())

    expect(result.mode).toBe('historical')
    expect(result.dataRange).toEqual({ earliest: '2026-04-01', latest: '2026-06-15' })
    expect(result.syncStats.syncedDays).toBe(70)
    expect(result.failedCount).toBe(2)
    expect(result.recentFailures).toHaveLength(2)
    expect(result.recentFailures[0]).toMatchObject({ metricsDate: '2026-05-01', errorMessage: 'boom' })
  })

  it('historical mode: gracefully degrades when DB is down', async () => {
    process.env.ENABLE_HISTORICAL_MODE = 'true'
    mockPoolQuery.mockRejectedValue(new Error('connection refused'))

    const { default: handler } = await import('../server/api/admin/overview.get')
    const result = await handler(makeEvent())

    expect(result.db.connected).toBe(false)
    expect(result.db.error).toContain('connection refused')
    // Falls back to live mode when DB is unreachable
    expect(result.mode).toBe('live')
    expect(mockGetSyncStats).not.toHaveBeenCalled()
  })
})

describe('/api/admin/sync — retry-failed action', () => {
  const ORIG_HISTORICAL = process.env.ENABLE_HISTORICAL_MODE
  const ORIG_MOCKED = process.env.NUXT_PUBLIC_IS_DATA_MOCKED

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_HISTORICAL_MODE = 'true'
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'false'
    setQuery({})
    setBody({})
  })
  afterEach(() => {
    if (ORIG_HISTORICAL === undefined) delete process.env.ENABLE_HISTORICAL_MODE
    else process.env.ENABLE_HISTORICAL_MODE = ORIG_HISTORICAL
    if (ORIG_MOCKED === undefined) delete process.env.NUXT_PUBLIC_IS_DATA_MOCKED
    else process.env.NUXT_PUBLIC_IS_DATA_MOCKED = ORIG_MOCKED
  })

  it('returns 0/0 when no failed entries exist', async () => {
    mockGetFailedSyncsForScope.mockResolvedValue([])
    setBody({ action: 'retry-failed', scope: 'organization', githubOrg: 'cody-test-org' })

    const { default: handler } = await import('../server/api/admin/sync.post')
    const result = await handler(makeEvent(true))

    expect(result).toMatchObject({ action: 'retry-failed', retried: 0, successCount: 0, failureCount: 0 })
    expect(mockSyncMetricsForDate).not.toHaveBeenCalled()
  })

  it('re-attempts each failed entry and counts successes/failures', async () => {
    mockGetFailedSyncsForScope.mockResolvedValue([
      { metricsDate: '2026-05-01', errorMessage: 'x', attemptCount: 1 },
      { metricsDate: '2026-05-02', errorMessage: 'y', attemptCount: 1 },
      { metricsDate: '2026-05-03', errorMessage: 'z', attemptCount: 1 },
    ])
    mockSyncMetricsForDate
      .mockResolvedValueOnce({ success: true, date: '2026-05-01', metricsCount: 1 })
      .mockResolvedValueOnce({ success: false, date: '2026-05-02', metricsCount: 0, error: 'still failing' })
      .mockResolvedValueOnce({ success: true, date: '2026-05-03', metricsCount: 1 })
    setBody({ action: 'retry-failed', scope: 'organization', githubOrg: 'cody-test-org' })

    const { default: handler } = await import('../server/api/admin/sync.post')
    const result = await handler(makeEvent(true))

    expect(mockSyncMetricsForDate).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({
      action: 'retry-failed',
      retried: 3,
      successCount: 2,
      failureCount: 1,
    })
    expect(result.results).toHaveLength(3)
  })
})
