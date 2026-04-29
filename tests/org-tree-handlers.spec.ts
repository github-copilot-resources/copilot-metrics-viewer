import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── vi.hoisted: runs at hoist-time so it's available inside vi.mock factories ─
const mockCfg = vi.hoisted(() => ({
  public: { isDataMocked: false },
  entraTenantId: '',
  entraClientId: '',
  entraClientSecret: '',
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
function setConfig(isDataMocked: boolean, entra = false) {
  mockCfg.public.isDataMocked = isDataMocked
  mockCfg.entraTenantId = entra ? 't1' : ''
  mockCfg.entraClientId = entra ? 'c1' : ''
  mockCfg.entraClientSecret = entra ? 's1' : ''
}

async function loadSearchHandler(isDataMocked: boolean, entra = false) {
  setConfig(isDataMocked, entra)
  vi.resetModules()
  vi.mock('../server/services/microsoft-graph-service', () => ({
    searchUsers: vi.fn(),
    searchUsersWithToken: vi.fn(),
    getSubtree: vi.fn(),
    getSubtreeWithToken: vi.fn(),
  }))
  const mod = await import('../server/api/org-search')
  return (mod as any).default
}

async function loadTreeHandler(isDataMocked: boolean, entra = false) {
  setConfig(isDataMocked, entra)
  vi.resetModules()
  vi.mock('../server/services/microsoft-graph-service', () => ({
    searchUsers: vi.fn(),
    searchUsersWithToken: vi.fn(),
    getSubtree: vi.fn(),
    getSubtreeWithToken: vi.fn(),
  }))
  const mod = await import('../server/api/org-tree')
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

describe('org-search handler (live mode)', () => {
  it('throws 503 when Entra is not configured', async () => {
    const handler = await loadSearchHandler(false, false)
    await expect(
      handler({ _query: { q: 'alice' } })
    ).rejects.toMatchObject({ statusCode: 503 })
  })
})

// ── /api/org-tree ─────────────────────────────────────────────────────────────

describe('org-tree handler (mock mode)', () => {
  it('throws 400 when userEmail is missing', async () => {
    const handler = await loadTreeHandler(true)
    await expect(
      handler({ _query: {} })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns full mock tree for the root user email', async () => {
    const handler = await loadTreeHandler(true)
    const result = await handler({ _query: { userEmail: 'monalisa@octodemo.com' } })
    expect(result.root.displayName).toBe('Monalisa Octocat')
    expect(result.totalNodes).toBeGreaterThan(1)
    expect(result.copilotMatchCount).toBeGreaterThanOrEqual(0)
  })

  it('falls back to the root tree when email is not found', async () => {
    const handler = await loadTreeHandler(true)
    const result = await handler({ _query: { userEmail: 'notfound@octodemo.com' } })
    expect(result.root).toBeDefined()
    expect(result.totalNodes).toBeGreaterThan(1)
  })

  it('returns sub-tree when a direct report email is requested', async () => {
    const handler = await loadTreeHandler(true)
    const result = await handler({ _query: { userEmail: 'defunkt@octodemo.com' } })
    expect(result.root.displayName).toBe('Defunkt Jones')
    expect(result.root.directReports.length).toBeGreaterThan(0)
  })

  it('does not throw for a valid maxDepth override', async () => {
    const handler = await loadTreeHandler(true)
    const result = await handler({ _query: { userEmail: 'monalisa@octodemo.com', maxDepth: '2' } })
    expect(result.root).toBeDefined()
  })

  it('clamps maxDepth to 6 for extreme values', async () => {
    const handler = await loadTreeHandler(true)
    const result = await handler({ _query: { userEmail: 'monalisa@octodemo.com', maxDepth: '999' } })
    expect(result.root).toBeDefined()
  })
})

describe('org-tree handler (live mode)', () => {
  it('throws 503 when Entra is not configured', async () => {
    const handler = await loadTreeHandler(false, false)
    await expect(
      handler({ _query: { userEmail: 'alice@example.com' } })
    ).rejects.toMatchObject({ statusCode: 503 })
  })
})

// ── Delegated-token (MSAL) path ────────────────────────────────────────────────

describe('org-search handler (delegated token)', () => {
  it('calls searchUsersWithToken when Authorization header is present', async () => {
    const handler = await loadSearchHandler(false, false)
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

  it('does not call searchUsers (SP path) when Authorization header is present', async () => {
    const handler = await loadSearchHandler(false, false)
    const { searchUsers, searchUsersWithToken } = await import('../server/services/microsoft-graph-service')
    vi.mocked(searchUsersWithToken).mockResolvedValue([])

    await handler({
      _query: { q: 'alice' },
      _headers: { authorization: 'Bearer fake-token-abc' },
    })

    expect(vi.mocked(searchUsers)).not.toHaveBeenCalled()
  })

  it('propagates errors from searchUsersWithToken without SP fallback', async () => {
    const handler = await loadSearchHandler(false, false)
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

describe('org-tree handler (delegated token)', () => {
  it('calls getSubtreeWithToken when Authorization header is present', async () => {
    const handler = await loadTreeHandler(false, false)
    const { getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    const mockFn = vi.mocked(getSubtreeWithToken)
    const mockRoot = { id: 'u1', displayName: 'Alice', userPrincipalName: 'alice@example.com', mail: 'alice@example.com', jobTitle: 'Engineer', directReports: [] }
    mockFn.mockResolvedValue(mockRoot)

    const result = await handler({
      _query: { userEmail: 'alice@example.com' },
      _headers: { authorization: 'Bearer fake-token-xyz' },
    })

    expect(mockFn).toHaveBeenCalledWith('fake-token-xyz', 'alice@example.com', 3)
    expect(result.root.displayName).toBe('Alice')
    expect(result.totalNodes).toBe(1)
  })

  it('does not call getSubtree (SP path) when Authorization header is present', async () => {
    const handler = await loadTreeHandler(false, false)
    const { getSubtree, getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    const mockRoot = { id: 'u1', displayName: 'Alice', userPrincipalName: 'alice@example.com', mail: 'alice@example.com', jobTitle: 'Engineer', directReports: [] }
    vi.mocked(getSubtreeWithToken).mockResolvedValue(mockRoot)

    await handler({
      _query: { userEmail: 'alice@example.com' },
      _headers: { authorization: 'Bearer fake-token-xyz' },
    })

    expect(vi.mocked(getSubtree)).not.toHaveBeenCalled()
  })

  it('propagates errors from getSubtreeWithToken without SP fallback', async () => {
    const handler = await loadTreeHandler(false, false)
    const { getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    vi.mocked(getSubtreeWithToken).mockRejectedValue(new Error('Consent required'))

    await expect(
      handler({
        _query: { userEmail: 'alice@example.com' },
        _headers: { authorization: 'Bearer bad-token' },
      })
    ).rejects.toThrow('Consent required')
  })

  it('respects maxDepth query param in delegated mode', async () => {
    const handler = await loadTreeHandler(false, false)
    const { getSubtreeWithToken } = await import('../server/services/microsoft-graph-service')
    const mockRoot = { id: 'u1', displayName: 'Alice', userPrincipalName: 'alice@example.com', mail: 'alice@example.com', jobTitle: 'Engineer', directReports: [] }
    vi.mocked(getSubtreeWithToken).mockResolvedValue(mockRoot)

    await handler({
      _query: { userEmail: 'alice@example.com', maxDepth: '5' },
      _headers: { authorization: 'Bearer fake-token-xyz' },
    })

    expect(vi.mocked(getSubtreeWithToken)).toHaveBeenCalledWith('fake-token-xyz', 'alice@example.com', 5)
  })
})
