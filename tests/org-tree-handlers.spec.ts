import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── vi.hoisted: runs at hoist-time so it's available inside vi.mock factories ─
const mockCfg = vi.hoisted(() => ({
  public: { isDataMocked: false },
}))

// ── Mock Nuxt's runtime-config source so useRuntimeConfig() returns mockCfg ──
// #app/nuxt resolves to node_modules/nuxt/dist/app/nuxt.js per .nuxt/tsconfig.json
vi.mock('#app/nuxt', async (importOriginal) => {
  const original = await importOriginal<typeof import('#app/nuxt')>()
  return {
    ...original,
    useRuntimeConfig: () => mockCfg,
  }
})

// ── Stub h3 globals that server handlers expect ────────────────────────────────
;(globalThis as any).defineEventHandler = (handler: any) => handler
;(globalThis as any).getQuery = (event: any) => event._query ?? {}
;(globalThis as any).getRequestHeader = (event: any, name: string) => (event._headers ?? {})[name.toLowerCase()] ?? undefined

// ── Helper: set mock config then fresh-import handler ────────────────────────
function setConfig(isDataMocked: boolean) {
  mockCfg.public.isDataMocked = isDataMocked
}

async function loadSearchHandler(isDataMocked: boolean) {
  setConfig(isDataMocked)
  vi.resetModules()
  vi.mock('../server/services/microsoft-graph-service', () => ({
    searchUsersWithToken: vi.fn(),
    getUserWithToken: vi.fn(),
    getTransitiveReportsWithToken: vi.fn(),
  }))
  const mod = await import('../server/api/org-search')
  return (mod as any).default
}

async function loadReportsHandler(isDataMocked: boolean) {
  setConfig(isDataMocked)
  vi.resetModules()
  vi.mock('../server/services/microsoft-graph-service', () => ({
    searchUsersWithToken: vi.fn(),
    getUserWithToken: vi.fn(),
    getTransitiveReportsWithToken: vi.fn(),
  }))
  const mod = await import('../server/api/org-reports')
  return (mod as any).default
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── /api/org-search ───────────────────────────────────────────────────────────

describe('org-search handler (mock mode)', () => {
  it('returns empty array for query shorter than 2 characters', async () => {
    const handler = await loadSearchHandler(true)
    const result = await handler({ _query: { q: 'a' } })
    expect(result).toEqual([])
  })

  it('returns empty array for missing q param', async () => {
    const handler = await loadSearchHandler(true)
    const result = await handler({ _query: {} })
    expect(result).toEqual([])
  })

  it('filters mock users by displayName (case-insensitive)', async () => {
    const handler = await loadSearchHandler(true)
    const result = await handler({ _query: { q: 'mona' } })
    const names = result.map((u: any) => u.displayName)
    expect(names).toContain('Monalisa Octocat')
  })

  it('filters mock users by email', async () => {
    const handler = await loadSearchHandler(true)
    const result = await handler({ _query: { q: 'defunkt@' } })
    expect(result.some((u: any) => (u.mail ?? '').includes('defunkt@'))).toBe(true)
  })

  it('returns multiple matches when query is broad', async () => {
    const handler = await loadSearchHandler(true)
    const result = await handler({ _query: { q: 'octo' } })
    expect(result.length).toBeGreaterThan(1)
  })

  it('returns empty array when no mock user matches', async () => {
    const handler = await loadSearchHandler(true)
    const result = await handler({ _query: { q: 'zzznomatch' } })
    expect(result).toEqual([])
  })
})

describe('org-search handler (live mode — no auth header)', () => {
  it('throws 503 when no Authorization header is provided', async () => {
    const handler = await loadSearchHandler(false)
    await expect(
      handler({ _query: { q: 'alice' } })
    ).rejects.toMatchObject({ statusCode: 503 })
  })
})

// ── /api/org-reports ──────────────────────────────────────────────────────────

describe('org-reports handler (mock mode)', () => {
  it('throws 400 when userUpn is missing', async () => {
    const handler = await loadReportsHandler(true)
    await expect(
      handler({ _query: {} })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns transitive reports for the root user UPN', async () => {
    const handler = await loadReportsHandler(true)
    const result = await handler({ _query: { userUpn: 'monalisa@octodemo.com' } })
    expect(result.rootUser.displayName).toBe('Monalisa Octocat')
    expect(result.members.length).toBeGreaterThan(0)
    expect(result.truncated).toBe(false)
  })

  it('throws 404 when UPN is not found in mock tree', async () => {
    const handler = await loadReportsHandler(true)
    await expect(
      handler({ _query: { userUpn: 'notfound@octodemo.com' } })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns sub-reports when a direct report UPN is requested', async () => {
    const handler = await loadReportsHandler(true)
    const result = await handler({ _query: { userUpn: 'defunkt@octodemo.com' } })
    expect(result.rootUser.displayName).toBe('Defunkt Jones')
    expect(result.count).toBeGreaterThanOrEqual(0)
  })
})

describe('org-reports handler (live mode — no auth header)', () => {
  it('throws 503 when no Authorization header is provided', async () => {
    const handler = await loadReportsHandler(false)
    await expect(
      handler({ _query: { userUpn: 'alice@example.com' } })
    ).rejects.toMatchObject({ statusCode: 503 })
  })
})

describe('org-reports handler (delegated token)', () => {
  it('calls getUserWithToken and getTransitiveReportsWithToken when Authorization header is present', async () => {
    const handler = await loadReportsHandler(false)
    const { getUserWithToken, getTransitiveReportsWithToken } = await import('../server/services/microsoft-graph-service')
    vi.mocked(getUserWithToken).mockResolvedValue({
      id: 'u1', displayName: 'Alice', userPrincipalName: 'alice@example.com',
      mail: 'alice@example.com', jobTitle: 'Manager', department: null, officeLocation: null
    })
    vi.mocked(getTransitiveReportsWithToken).mockResolvedValue([
      { id: 'u2', userPrincipalName: 'bob@example.com', mail: 'bob@example.com' },
    ])

    const result = await handler({
      _query: { userUpn: 'alice@example.com' },
      _headers: { authorization: 'Bearer fake-token-xyz' },
    })

    expect(vi.mocked(getUserWithToken)).toHaveBeenCalledWith('fake-token-xyz', 'alice@example.com')
    expect(result.rootUser.displayName).toBe('Alice')
    expect(result.members).toHaveLength(1)
    expect(result.members[0].userPrincipalName).toBe('bob@example.com')
  })

  it('throws 404 when getUserWithToken returns null', async () => {
    const handler = await loadReportsHandler(false)
    const { getUserWithToken, getTransitiveReportsWithToken } = await import('../server/services/microsoft-graph-service')
    vi.mocked(getUserWithToken).mockResolvedValue(null)
    vi.mocked(getTransitiveReportsWithToken).mockResolvedValue([])

    await expect(
      handler({
        _query: { userUpn: 'missing@example.com' },
        _headers: { authorization: 'Bearer fake-token-xyz' },
      })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
// ── /api/org-search delegated-token path ─────────────────────────────────────

describe('org-search handler (delegated token)', () => {
  it('calls searchUsersWithToken when Authorization header is present', async () => {
    const handler = await loadSearchHandler(false)
    const { searchUsersWithToken } = await import('../server/services/microsoft-graph-service')
    const mockFn = vi.mocked(searchUsersWithToken)
    mockFn.mockResolvedValue([{ id: 'u1', displayName: 'Alice', userPrincipalName: 'alice@example.com' }])

    const result = await handler({
      _query: { q: 'alice' },
      _headers: { authorization: 'Bearer fake-token-abc' },
    })

    expect(mockFn).toHaveBeenCalledWith('fake-token-abc', 'alice')
    expect(result).toHaveLength(1)
    expect(result[0].displayName).toBe('Alice')
  })

  it('returns empty array when searchUsersWithToken returns nothing', async () => {
    const handler = await loadSearchHandler(false)
    const { searchUsersWithToken } = await import('../server/services/microsoft-graph-service')
    vi.mocked(searchUsersWithToken).mockResolvedValue([])

    const result = await handler({
      _query: { q: 'alice' },
      _headers: { authorization: 'Bearer fake-token-abc' },
    })

    expect(result).toEqual([])
  })

  it('propagates errors from searchUsersWithToken', async () => {
    const handler = await loadSearchHandler(false)
    const { searchUsersWithToken } = await import('../server/services/microsoft-graph-service')
    vi.mocked(searchUsersWithToken).mockRejectedValue(new Error('Token expired'))

    await expect(
      handler({
        _query: { q: 'alice' },
        _headers: { authorization: 'Bearer expired-token' },
      })
    ).rejects.toThrow('Token expired')
  })
})
