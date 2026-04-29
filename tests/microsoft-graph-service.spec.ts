import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Globals required by Microsoft Graph service ────────────────────────────
// $fetch is a Nuxt global — stub it before each test so different tests can
// exercise different fetch sequences without module-level cache interference.
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

const TOKEN_RES = { access_token: 'test-token', expires_in: 3600 }

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

// ── searchUsers ───────────────────────────────────────────────────────────────

describe('searchUsers', () => {
  it('fetches token, then calls Graph search with ConsistencyLevel header', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RES)
      .mockResolvedValueOnce({ value: [USER_ALICE] })

    const { searchUsers } = await import('../server/services/microsoft-graph-service')
    const results = await searchUsers('tenant1', 'client1', 'secret1', 'ali')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    // First call: token endpoint
    expect(mockFetch.mock.calls[0][0]).toContain('oauth2/v2.0/token')
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    // Second call: search endpoint with required header
    expect(mockFetch.mock.calls[1][0]).toContain('displayName:ali')
    expect(mockFetch.mock.calls[1][1].headers).toMatchObject({
      ConsistencyLevel: 'eventual',
    })
    expect(results).toHaveLength(1)
    expect(results[0].displayName).toBe('Alice')
  })

  it('returns empty array when Graph search throws', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RES)
      .mockRejectedValueOnce(new Error('forbidden'))

    const { searchUsers } = await import('../server/services/microsoft-graph-service')
    const results = await searchUsers('t1', 'c1', 's1', 'ali')
    expect(results).toEqual([])
  })
})

// ── getSubtree ────────────────────────────────────────────────────────────────

describe('getSubtree', () => {
  it('fetches token → user → direct reports and returns node', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RES)     // getAccessToken
      .mockResolvedValueOnce(USER_ALICE)    // fetchUser
      .mockResolvedValueOnce({ value: [] }) // fetchDirectReports

    const { getSubtree } = await import('../server/services/microsoft-graph-service')
    const result = await getSubtree('t1', 'c1', 's1', 'alice@example.com', 1)

    expect(result.id).toBe('user-alice')
    expect(result.displayName).toBe('Alice')
    expect(result.directReports).toEqual([])
  })

  it('builds subtree recursively up to maxDepth', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RES)          // token
      .mockResolvedValueOnce(USER_ALICE)          // fetchUser root
      .mockResolvedValueOnce({ value: [USER_BOB] }) // directReports of root
      .mockResolvedValueOnce(USER_BOB)            // fetchUser child
      .mockResolvedValueOnce({ value: [] })        // directReports of child

    const { getSubtree } = await import('../server/services/microsoft-graph-service')
    const result = await getSubtree('t1', 'c1', 's1', 'alice@example.com', 2)

    expect(result.directReports).toHaveLength(1)
    expect(result.directReports[0].id).toBe('user-bob')
    expect(result.directReports[0].directReports).toEqual([])
  })

  it('stops expanding at maxDepth=1 (only fetches direct reports but not their children)', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RES)
      .mockResolvedValueOnce(USER_ALICE)
      .mockResolvedValueOnce({ value: [USER_BOB] }) // reports listed but NOT recursed at depth>=maxDepth
      .mockResolvedValueOnce(USER_BOB)
      .mockResolvedValueOnce({ value: [] })

    const { getSubtree } = await import('../server/services/microsoft-graph-service')
    // maxDepth=1: root is at depth 0 (< maxDepth) → fetches reports; child is at depth 1 (not < 1) → no reports
    const result = await getSubtree('t1', 'c1', 's1', 'alice@example.com', 1)
    expect(result.directReports).toHaveLength(1)
    expect(result.directReports[0].directReports).toEqual([])
  })

  it('throws when user is not found', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RES)
      .mockRejectedValueOnce(new Error('404 Not Found')) // fetchUser catches and returns null

    const { getSubtree } = await import('../server/services/microsoft-graph-service')
    await expect(
      getSubtree('t1', 'c1', 's1', 'notfound@example.com', 1)
    ).rejects.toThrow('User not found')
  })

  it('caches result and avoids re-fetching on second call with same key', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RES)
      .mockResolvedValueOnce(USER_ALICE)
      .mockResolvedValueOnce({ value: [] })

    const { getSubtree } = await import('../server/services/microsoft-graph-service')
    const first  = await getSubtree('t1', 'c1', 's1', 'cached@example.com', 2)
    const second = await getSubtree('t1', 'c1', 's1', 'cached@example.com', 2)

    // Only 3 fetch calls (token + user + reports) despite 2 getSubtree calls
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(second).toBe(first) // same object reference from cache
  })
})

// ── Token caching ─────────────────────────────────────────────────────────────

describe('token caching', () => {
  it('reuses a cached token across multiple API calls', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RES)             // token — fetched once
      .mockResolvedValueOnce({ value: [USER_ALICE] }) // first search
      .mockResolvedValueOnce({ value: [USER_BOB] })   // second search

    const { searchUsers } = await import('../server/services/microsoft-graph-service')
    await searchUsers('t1', 'c1', 's1', 'ali')
    await searchUsers('t1', 'c1', 's1', 'bob')

    // 1 token call + 2 search calls = 3 total (not 4)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(mockFetch.mock.calls[0][0]).toContain('oauth2/v2.0/token')
    expect(mockFetch.mock.calls[1][0]).not.toContain('oauth2/v2.0/token')
    expect(mockFetch.mock.calls[2][0]).not.toContain('oauth2/v2.0/token')
  })
})
