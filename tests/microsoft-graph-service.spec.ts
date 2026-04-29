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
    expect(mockFetch.mock.calls[0][0]).toContain('displayName:ali')
    expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer my-delegated-token',
      ConsistencyLevel: 'eventual',
    })
    expect(results).toHaveLength(1)
    expect(results[0].displayName).toBe('Alice')
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

    expect(mockFetch.mock.calls[0][0]).not.toContain('oauth2/v2.0/token')
  })
})

// ── getSubtreeWithToken ───────────────────────────────────────────────────────

describe('getSubtreeWithToken', () => {
  it('fetches user then direct reports and returns node', async () => {
    mockFetch
      .mockResolvedValueOnce(USER_ALICE)    // fetchUser
      .mockResolvedValueOnce({ value: [] }) // fetchDirectReports

    const { getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    const result = await getSubtreeWithToken('my-token', 'alice@example.com', 1)

    expect(result.id).toBe('user-alice')
    expect(result.displayName).toBe('Alice')
    expect(result.directReports).toEqual([])
  })

  it('builds subtree recursively up to maxDepth', async () => {
    mockFetch
      .mockResolvedValueOnce(USER_ALICE)              // fetchUser root
      .mockResolvedValueOnce({ value: [USER_BOB] })   // directReports of root
      .mockResolvedValueOnce(USER_BOB)                // fetchUser child
      .mockResolvedValueOnce({ value: [] })            // directReports of child

    const { getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    const result = await getSubtreeWithToken('my-token', 'alice@example.com', 2)

    expect(result.directReports).toHaveLength(1)
    expect(result.directReports[0].id).toBe('user-bob')
    expect(result.directReports[0].directReports).toEqual([])
  })

  it('stops expanding at maxDepth (child has empty directReports)', async () => {
    mockFetch
      .mockResolvedValueOnce(USER_ALICE)
      .mockResolvedValueOnce({ value: [USER_BOB] })
      .mockResolvedValueOnce(USER_BOB)              // fetchUser still called for child node

    const { getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    // maxDepth=1: root depth=0 (< 1) fetches reports; child depth=1 (not < 1) stops — no fetchDirectReports
    const result = await getSubtreeWithToken('my-token', 'alice@example.com', 1)
    expect(result.directReports).toHaveLength(1)
    expect(result.directReports[0].directReports).toEqual([])
    // Only 3 fetches: fetchUser(root) + fetchDirectReports(root) + fetchUser(child)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws when user is not found', async () => {
    mockFetch.mockRejectedValueOnce(new Error('404 Not Found'))

    const { getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    await expect(
      getSubtreeWithToken('my-token', 'notfound@example.com', 1)
    ).rejects.toThrow('User not found')
  })

  it('passes the delegated token in Authorization header for all Graph calls', async () => {
    mockFetch
      .mockResolvedValueOnce(USER_ALICE)
      .mockResolvedValueOnce({ value: [] })

    const { getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    await getSubtreeWithToken('delegated-xyz', 'alice@example.com', 1)

    for (const call of mockFetch.mock.calls) {
      expect(call[1]?.headers?.Authorization).toBe('Bearer delegated-xyz')
    }
  })
})
