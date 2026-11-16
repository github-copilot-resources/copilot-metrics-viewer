// @vitest-environment node
import { generateKeyPairSync } from 'node:crypto'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, getQuery } from 'h3'
import { $fetch } from 'ofetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as unknown as { useRuntimeConfig: () => unknown }).useRuntimeConfig(),
}))

const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

// Enterprise account has slug, not login or type (GitHub REST OpenAPI).
const enterprise = { id: 42, target_type: 'Enterprise', account: { slug: 'test-enterprise' } }
const organization = { id: 7, target_type: 'Organization', account: { login: 'test-org', type: 'Organization' } }
let installations: unknown[]
let failedPath: string | undefined
let paths: string[]
let config: {
  githubAppId?: string
  githubAppPrivateKey?: string
  githubToken?: string
  public: { scope: string; githubOrg?: string; githubEnt?: string; isDataMocked?: boolean }
}
const session = vi.fn()

function event(query: string) {
  const req = new IncomingMessage(new Socket())
  req.url = `/api/metrics?${query}`
  return createEvent(req, new ServerResponse(req))
}

beforeEach(() => {
  vi.resetModules()
  installations = [organization, enterprise]
  failedPath = undefined
  paths = []
  config = {
    githubAppId: '12345',
    githubAppPrivateKey: privateKey,
    public: { scope: 'organization', githubOrg: 'test-org', githubEnt: 'test-enterprise' },
  }
  session.mockReset()
  vi.stubEnv('NUXT_PUBLIC_IS_DATA_MOCKED', 'false')
  vi.stubEnv('NUXT_GITHUB_API_BASE_URL', 'https://api.github.com')
  vi.stubEnv('NUXT_GITHUB_TOKEN', 'synthetic-pat')
  vi.stubEnv('NUXT_GITHUB_APP_ID', '12345')
  vi.stubEnv('NUXT_GITHUB_APP_PRIVATE_KEY', privateKey)
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('getQuery', getQuery)
  vi.stubGlobal('getUserSession', session)
  vi.stubGlobal('$fetch', $fetch)
  // Exercise actual ofetch clients; intercept only the native HTTP transport.
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.origin !== 'https://api.github.com') throw new Error('Unexpected HTTP origin')
    paths.push(url.pathname)
    expect(new Headers(init?.headers).get('authorization')).toBeTruthy()
    const body = url.pathname === failedPath
      ? { message: 'Resource not accessible by integration' }
      : url.pathname === '/app/installations'
        ? installations
        : url.pathname.endsWith('/access_tokens')
          ? { token: `synthetic-installation-${url.pathname.split('/')[3]}`, expires_at: '2099-01-01T00:00:00Z' }
          : { download_links: [], report_start_day: '2026-01-01', report_end_day: '2026-01-28' }
    return new Response(JSON.stringify(body), {
      status: url.pathname === failedPath ? 403 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('GitHub enterprise installation contracts through actual clients', () => {
  it('normalizes enterprise slug and target_type without inventing account.type', async () => {
    const { listAppInstallations } = await import('../server/modules/github-app-auth')
    expect(await listAppInstallations('12345', privateKey)).toEqual([
      { id: 7, login: 'test-org', type: 'Organization' },
      { id: 42, login: 'test-enterprise', type: 'Enterprise' },
    ])
  })

  it('explicit enterprise query wins over organization deployment config', async () => {
    const { authenticateAndGetGitHubHeaders } = await import('../server/modules/authentication')
    const { requestDownloadLinks } = await import('../server/services/github-copilot-usage-api')
    const headers = await authenticateAndGetGitHubHeaders(event('githubEnt=test-enterprise'))
    expect(headers.get('authorization')).toBe('token synthetic-installation-42')
    await requestDownloadLinks({ scope: 'enterprise', identifier: 'test-enterprise' }, headers)
    expect(paths).toContain('/enterprises/test-enterprise/copilot/metrics/reports/enterprise-28-day/latest')
    expect(session).not.toHaveBeenCalled()
  })

  it('keeps an explicit organization request on an enterprise deployment', async () => {
    config.public.scope = 'enterprise'
    const { authenticateAndGetGitHubHeaders } = await import('../server/modules/authentication')
    const { requestDownloadLinks } = await import('../server/services/github-copilot-usage-api')
    const headers = await authenticateAndGetGitHubHeaders(event('githubOrg=test-org'))
    expect(headers.get('authorization')).toBe('token synthetic-installation-7')
    await requestDownloadLinks({ scope: 'organization', identifier: 'test-org' }, headers)
    expect(paths).toContain('/orgs/test-org/copilot/metrics/reports/organization-28-day/latest')
  })

  it('selects the enterprise, not an organization with the same identifier', async () => {
    installations = [{ ...organization, account: { login: 'test-enterprise', type: 'Organization' } }, enterprise]
    const { getGitHubAppToken } = await import('../server/modules/github-app-auth')
    expect(await getGitHubAppToken(event('scope=enterprise&githubEnt=test-enterprise')))
      .toBe('synthetic-installation-42')
  })

  it('does not fall back to an organization identifier for enterprise scope', async () => {
    config.public.githubEnt = ''
    const { getGitHubAppToken } = await import('../server/modules/github-app-auth')
    await expect(getGitHubAppToken(event('scope=enterprise'))).rejects.toThrow(/enterprise/i)
    expect(paths.filter(path => path.endsWith('/access_tokens'))).toEqual([])
  })

  it('does not auto-select a user installation for enterprise requests', async () => {
    config.public.githubOrg = ''
    config.public.githubEnt = ''
    installations = [{ id: 9, target_type: 'User', account: { login: 'test-user', type: 'User' } }]
    const { getGitHubAppToken } = await import('../server/modules/github-app-auth')
    await expect(getGitHubAppToken(event('scope=enterprise'))).rejects.toThrow(/installation/i)
    expect(paths.filter(path => path.endsWith('/access_tokens'))).toEqual([])
  })

  it.each(['/app/installations', '/app/installations/42/access_tokens'])(
    'preserves permission failures at %s without falling back to PAT or OAuth',
    async path => {
      failedPath = path
      config.githubToken = 'synthetic-pat'
      const { authenticateAndGetGitHubHeaders } = await import('../server/modules/authentication')
      await expect(authenticateAndGetGitHubHeaders(event('scope=enterprise&githubEnt=test-enterprise')))
        .rejects.toMatchObject({ statusCode: 403 })
      expect(session).not.toHaveBeenCalled()
    },
  )

  it('preserves report 403 after successful enterprise authentication', async () => {
    failedPath = '/enterprises/test-enterprise/copilot/metrics/reports/enterprise-28-day/latest'
    const { authenticateAndGetGitHubHeaders } = await import('../server/modules/authentication')
    const { requestDownloadLinks } = await import('../server/services/github-copilot-usage-api')
    const headers = await authenticateAndGetGitHubHeaders(event('scope=enterprise&githubEnt=test-enterprise'))
    await expect(requestDownloadLinks({ scope: 'enterprise', identifier: 'test-enterprise' }, headers))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('sync authenticates an enterprise account lacking login/type with App before PAT', async () => {
    const { getSyncAuthHeaders } = await import('../server/utils/sync-auth')
    const headers = await getSyncAuthHeaders(console, 'test-enterprise', 'enterprise')
    expect(headers.get('authorization')).toBe('Bearer synthetic-installation-42')
  })

  it('sync rejects an organization installation when enterprise scope is requested', async () => {
    installations = [{ ...organization, account: { login: 'test-enterprise', type: 'Organization' } }]
    const { getSyncAuthHeaders } = await import('../server/utils/sync-auth')
    await expect(getSyncAuthHeaders(console, 'test-enterprise', 'enterprise')).rejects.toThrow(/not installed/)
    expect(paths.filter(path => path.endsWith('/access_tokens'))).toEqual([])
  })

  it('keeps mock, PAT, and OAuth provider paths without installation requests', async () => {
    const { authenticateAndGetGitHubHeaders } = await import('../server/modules/authentication')
    config.public.isDataMocked = true
    expect((await authenticateAndGetGitHubHeaders(event(''))).get('authorization')).toBe('token mock-token')
    config.public.isDataMocked = false
    config.githubAppId = undefined
    config.githubAppPrivateKey = undefined
    config.githubToken = 'synthetic-pat'
    expect((await authenticateAndGetGitHubHeaders(event(''))).get('authorization')).toBe('token synthetic-pat')
    config.githubToken = undefined
    session.mockResolvedValue({ secure: { tokens: { access_token: 'synthetic-oauth' } } })
    expect((await authenticateAndGetGitHubHeaders(event(''))).get('authorization')).toBe('token synthetic-oauth')
    expect(paths).toEqual([])
  })
})
