import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Globals required by Microsoft Graph service ────────────────────────────
const mockFetch = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('$fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ALICE = {
  id: 'user-alice',
  displayName: 'Alice',
  mail: 'alice@example.com',
  userPrincipalName: 'alice@example.com',
  jobTitle: 'Engineer',
  department: 'Eng',
  officeLocation: 'SF',
}

const USER_BOB = {
  id: 'user-bob',
  displayName: 'Bob',
  mail: 'bob@example.com',
  userPrincipalName: 'bob@example.com',
  jobTitle: 'Engineer',
  department: 'Eng',
  officeLocation: 'NY',
}

// ── searchUsersWithToken ──────────────────────────────────────────────────────

describe('searchUsersWithToken', () => {
  it('calls Graph search with the provided token and ConsistencyLevel header', async () => {
    mockFetch.mockResolvedValueOnce({ value: [USER_ALICE] })

    const { searchUsersWithToken } = await import('../server/services/microsoft-graph-service')
    const results = await searchUsersWithToken('my-delegated-token', 'ali')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]![0]).toContain('displayName:ali')
    expect(mockFetch.mock.calls[0]![1].headers).toMatchObject({
      Authorization: 'Bearer my-delegated-token',
      ConsistencyLevel: 'eventual',
    })
    expect(results).toHaveLength(1)
    expect(results[0]!.displayName).toBe('Alice')
  })

  it('returns empty array when Graph search throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('forbidden'))

    const { searchUsersWithToken } = await import('../server/services/microsoft-graph-service')
    const results = await searchUsersWithToken('bad-token', 'ali')
    expect(results).toEqual([])
  })

  it('does not call token endpoint (no client credentials needed)', async () => {
    mockFetch.mockResolvedValueOnce({ value: [] })

    const { searchUsersWithToken } = await import('../server/services/microsoft-graph-service')
    await searchUsersWithToken('delegated-token', 'test')

    expect(mockFetch.mock.calls[0]![0]).not.toContain('oauth2/v2.0/token')
  })
})

// ── getUserWithToken ──────────────────────────────────────────────────────────

describe('getUserWithToken', () => {
  it('fetches a user by UPN using the delegated token', async () => {
    mockFetch.mockResolvedValueOnce(USER_ALICE)

    const { getUserWithToken } = await import('../server/services/microsoft-graph-service')
    const result = await getUserWithToken('my-token', 'alice@example.com')

    expect(result?.id).toBe('user-alice')
    expect(result?.displayName).toBe('Alice')
    expect(mockFetch.mock.calls[0]![1].headers).toMatchObject({
      Authorization: 'Bearer my-token',
    })
  })

  it('returns null when the user is not found (Graph throws)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('404 Not Found'))

    const { getUserWithToken } = await import('../server/services/microsoft-graph-service')
    const result = await getUserWithToken('my-token', 'notfound@example.com')
    expect(result).toBeNull()
  })
})

// ── getTransitiveReportsWithToken ─────────────────────────────────────────────

describe('getTransitiveReportsWithToken', () => {
  it('returns flat list of transitive reports', async () => {
    mockFetch.mockResolvedValueOnce({ value: [USER_BOB] })

    const { getTransitiveReportsWithToken } = await import('../server/services/microsoft-graph-service')
    const result = await getTransitiveReportsWithToken('my-token', 'alice@example.com')

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('user-bob')
    expect(result[0]!.userPrincipalName).toBe('bob@example.com')
  })

  it('follows @odata.nextLink for pagination', async () => {
    mockFetch
      .mockResolvedValueOnce({ value: [USER_ALICE], '@odata.nextLink': 'https://graph.microsoft.com/next' })
      .mockResolvedValueOnce({ value: [USER_BOB] })

    const { getTransitiveReportsWithToken } = await import('../server/services/microsoft-graph-service')
    const result = await getTransitiveReportsWithToken('my-token', 'root@example.com')

    expect(result).toHaveLength(2)
  })

  it('returns empty array when there are no reports', async () => {
    mockFetch.mockResolvedValueOnce({ value: [] })

    const { getTransitiveReportsWithToken } = await import('../server/services/microsoft-graph-service')
    const result = await getTransitiveReportsWithToken('my-token', 'leaf@example.com')
    expect(result).toEqual([])
  })

  it('passes the delegated token in Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({ value: [] })

    const { getTransitiveReportsWithToken } = await import('../server/services/microsoft-graph-service')
    await getTransitiveReportsWithToken('delegated-xyz', 'alice@example.com')

    expect(mockFetch.mock.calls[0]![1].headers.Authorization).toBe('Bearer delegated-xyz')
  })
})
