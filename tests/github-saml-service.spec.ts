import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchSamlIdentities, clearSamlCache } from '../server/services/github-saml-service'

function makeSamlResponse(nodes: Array<{ nameId: string | null; login: string | null }>, hasNextPage = false, endCursor: string | null = null) {
  return {
    data: {
      organization: {
        samlIdentityProvider: {
          externalIdentities: {
            pageInfo: { hasNextPage, endCursor },
            nodes: nodes.map(n => ({
              samlIdentity: n.nameId ? { nameId: n.nameId } : null,
              user: n.login ? { login: n.login } : null,
            })),
          },
        },
      },
    },
  }
}

beforeEach(() => {
  clearSamlCache()
  vi.restoreAllMocks()
})

describe('fetchSamlIdentities', () => {
  it('returns a map of lowercase nameId → login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeSamlResponse([
        { nameId: 'pkarpala@contoso.com', login: 'karpikpl' },
        { nameId: 'alice@contoso.com', login: 'alice-contoso' },
      ]),
    }))

    const map = await fetchSamlIdentities('my-org', 'token123')
    expect(map.get('pkarpala@contoso.com')).toBe('karpikpl')
    expect(map.get('alice@contoso.com')).toBe('alice-contoso')
  })

  it('normalizes nameId to lowercase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeSamlResponse([{ nameId: 'User@CONTOSO.COM', login: 'user123' }]),
    }))

    const map = await fetchSamlIdentities('my-org', 'token')
    expect(map.get('user@contoso.com')).toBe('user123')
    expect(map.has('User@CONTOSO.COM')).toBe(false)
  })

  it('skips entries where samlIdentity is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeSamlResponse([
        { nameId: null, login: 'orphan-user' },
        { nameId: 'real@co.com', login: 'realuser' },
      ]),
    }))

    const map = await fetchSamlIdentities('my-org', 'token')
    expect(map.size).toBe(1)
    expect(map.get('real@co.com')).toBe('realuser')
  })

  it('skips entries where user is null (unlinked identity)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeSamlResponse([
        { nameId: 'unlinked@co.com', login: null },
        { nameId: 'linked@co.com', login: 'linkeduser' },
      ]),
    }))

    const map = await fetchSamlIdentities('my-org', 'token')
    expect(map.size).toBe(1)
    expect(map.get('linked@co.com')).toBe('linkeduser')
  })

  it('paginates when hasNextPage is true', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeSamlResponse(
          [{ nameId: 'page1@co.com', login: 'user1' }],
          true, 'cursor-abc'
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeSamlResponse(
          [{ nameId: 'page2@co.com', login: 'user2' }],
          false, null
        ),
      })
    vi.stubGlobal('fetch', mockFetch)

    const map = await fetchSamlIdentities('my-org', 'token')
    expect(map.size).toBe(2)
    expect(map.get('page1@co.com')).toBe('user1')
    expect(map.get('page2@co.com')).toBe('user2')
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Second call should include the cursor
    const body2 = JSON.parse(mockFetch.mock.calls[1]![1].body)
    expect(body2.variables.after).toBe('cursor-abc')
  })

  it('returns empty map when org has no SAML IdP configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { organization: { samlIdentityProvider: null } } }),
    }))

    const map = await fetchSamlIdentities('my-org', 'token')
    expect(map.size).toBe(0)
  })

  it('returns empty map on GraphQL permission error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: 'Must have admin rights to Query.organization' }] }),
    }))

    const map = await fetchSamlIdentities('my-org', 'token')
    expect(map.size).toBe(0)
  })

  it('returns empty map on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }))

    const map = await fetchSamlIdentities('my-org', 'token')
    expect(map.size).toBe(0)
  })

  it('returns empty map on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')))

    const map = await fetchSamlIdentities('my-org', 'token')
    expect(map.size).toBe(0)
  })

  it('caches results for the same org', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSamlResponse([{ nameId: 'user@co.com', login: 'user1' }]),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchSamlIdentities('my-org', 'token')
    await fetchSamlIdentities('my-org', 'token')

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('uses the provided apiBaseUrl for the GraphQL endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeSamlResponse([]),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchSamlIdentities('my-org', 'token', 'https://ghes.example.com')

    expect(mockFetch.mock.calls[0]![0]).toBe('https://ghes.example.com/graphql')
  })
})
