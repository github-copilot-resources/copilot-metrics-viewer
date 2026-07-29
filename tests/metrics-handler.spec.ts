/**
 * Tests for the /api/metrics handler.
 *
 * Follows the data-range.spec.ts and seats-team-filter.spec.ts pattern:
 * stub Nitro auto-imports on globalThis, then dynamically import the handler.
 *
 * No Nuxt environment is needed — plain Vitest Node.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Nitro global stubs (must be installed before any import of the handler) ────
;(globalThis as any).defineEventHandler = (h: any) => h
;(globalThis as any).getQuery = (_event: any) => _mockQuery
;(globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
  const err: any = new Error(statusMessage)
  err.statusCode = statusCode
  return err
}

let _mockQuery: Record<string, string> = {}
function setQuery(q: Record<string, string>) { _mockQuery = q }

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockGetMetricsDataV2 = vi.fn()
vi.mock('../shared/utils/metrics-util-v2', () => ({
  getMetricsDataV2: (...args: any[]) => mockGetMetricsDataV2(...args),
}))

const mockRequireTeamMembershipOrAdmin = vi.fn()
vi.mock('../server/utils/team-membership', () => ({
  requireTeamMembershipOrAdmin: (...args: any[]) => mockRequireTeamMembershipOrAdmin(...args),
}))

// ── Fixture helpers ───────────────────────────────────────────────────────────

/** Minimal CopilotMetrics item that convertToMetrics() can handle. */
function makeUsageItem(day: string) {
  return {
    date: day,
    total_active_users: 10,
    total_engaged_users: 8,
    copilot_ide_code_completions: null,
    copilot_ide_chat: null,
    copilot_dotcom_chat: null,
    copilot_dotcom_pull_requests: null,
  }
}

function makeEvent() {
  return { context: { headers: new Headers() }, node: { req: { url: '/api/metrics' } } }
}

const ORIG_MOCKED = process.env.NUXT_PUBLIC_IS_DATA_MOCKED

describe('/api/metrics handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setQuery({ scope: 'organization', githubOrg: 'test-org' })
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'true'
    mockRequireTeamMembershipOrAdmin.mockResolvedValue(undefined)
  })

  afterEach(() => {
    if (ORIG_MOCKED === undefined) delete process.env.NUXT_PUBLIC_IS_DATA_MOCKED
    else process.env.NUXT_PUBLIC_IS_DATA_MOCKED = ORIG_MOCKED
  })

  it('happy path: returns { metrics, usage, reportData }', async () => {
    const usage = [makeUsageItem('2026-04-01'), makeUsageItem('2026-04-02')]
    const reportData = [{ day: '2026-04-01', daily_active_users: 10 }]
    mockGetMetricsDataV2.mockResolvedValue({ metrics: usage, reportData })

    const { default: handler } = await import('../server/api/metrics')
    const result: any = await handler(makeEvent() as any)

    expect(result).toHaveProperty('metrics')
    expect(result).toHaveProperty('usage')
    expect(result).toHaveProperty('reportData')
    expect(result.usage).toBe(usage)
    expect(result.reportData).toBe(reportData)
  })

  it('sortMetricsByDay: returned metrics are sorted ascending by day', async () => {
    // Supply usage items deliberately out of order
    const usage = [
      makeUsageItem('2026-04-03'),
      makeUsageItem('2026-04-01'),
      makeUsageItem('2026-04-02'),
    ]
    mockGetMetricsDataV2.mockResolvedValue({ metrics: usage, reportData: [] })

    const { default: handler } = await import('../server/api/metrics')
    const result: any = await handler(makeEvent() as any)

    const days = result.metrics.map((m: any) => m.day)
    expect(days).toEqual([...days].sort())
  })

  it('invokes requireTeamMembershipOrAdmin with the correct scope and org', async () => {
    setQuery({ scope: 'organization', githubOrg: 'my-org', githubTeam: 'my-team' })
    mockGetMetricsDataV2.mockResolvedValue({ metrics: [], reportData: [] })

    const { default: handler } = await import('../server/api/metrics')
    await handler(makeEvent() as any)

    expect(mockRequireTeamMembershipOrAdmin).toHaveBeenCalledWith(
      expect.anything(),
      'organization',
      'my-org',
      'my-team',
    )
  })

  it('rethrows H3 errors with the original statusCode', async () => {
    const h3Error: any = new Error('Not Found')
    h3Error.statusCode = 404
    mockGetMetricsDataV2.mockRejectedValue(h3Error)

    const { default: handler } = await import('../server/api/metrics')
    await expect(handler(makeEvent() as any)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('wraps unexpected errors with statusCode 500', async () => {
    mockGetMetricsDataV2.mockRejectedValue(new Error('boom'))

    const { default: handler } = await import('../server/api/metrics')
    await expect(handler(makeEvent() as any)).rejects.toMatchObject({ statusCode: 500 })
  })

  it('gates access via requireTeamMembershipOrAdmin and propagates 403', async () => {
    const forbidden: any = new Error('Forbidden')
    forbidden.statusCode = 403
    mockRequireTeamMembershipOrAdmin.mockRejectedValue(forbidden)

    const { default: handler } = await import('../server/api/metrics')
    await expect(handler(makeEvent() as any)).rejects.toMatchObject({ statusCode: 403 })
  })
})
