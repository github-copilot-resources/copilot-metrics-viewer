// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createApp, createError, defineEventHandler, getQuery, readBody, sendRedirect, toNodeListener, type H3Event } from 'h3'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => (globalThis as unknown as { useRuntimeConfig: () => unknown }).useRuntimeConfig(),
}))

// Keep application storage/service modules real without opening database connections.
vi.mock('pg', () => ({
  default: {
    Pool: class {
      query = vi.fn()
      end = vi.fn().mockResolvedValue(undefined)
    },
  },
}))

const sentinel = 'SYNTHETIC_DO_NOT_LOG'

function capture() {
  const lines: string[] = []
  for (const method of ['info', 'debug', 'warn', 'error'] as const) {
    vi.spyOn(console, method).mockImplementation((...args) => {
      lines.push(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '))
    })
  }
  return lines
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('logging contracts with real modules', () => {
  it.each(['body', 'query'])('keeps accepted and failing admin-sync %s values out of real module logs', async (source) => {
    vi.stubGlobal('defineEventHandler', defineEventHandler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getQuery', getQuery)
    vi.stubGlobal('readBody', readBody)
    vi.stubGlobal('useRuntimeConfig', () => ({
      logLevel: 'info', logFormat: 'json', logRequests: true, public: { isDataMocked: true },
    }))
    const input = `SYNTHETIC_${source.toUpperCase()}_SENTINEL`
    const failure = Object.assign(new Error(input), { code: 'ECONNREFUSED', statusCode: 503 })
    // Fail at transport boundaries, never connecting to a database or upstream.
    const transport = vi.fn().mockRejectedValue(failure)
    vi.stubGlobal('$fetch', transport)
    const { getPool, closePool } = await import('../server/storage/db')
    vi.spyOn(getPool(), 'query').mockImplementation(transport)
    const lines = capture()
    const { default: logRequest } = await import('../server/middleware/00.log')
    const { default: sync } = await import('../server/api/admin/sync.post')
    const app = createApp()
    app.use(logRequest)
    app.use('/api/admin/sync', sync)
    const server = createServer(toNodeListener(app))
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')
    const base = `http://127.0.0.1:${address.port}`
    const httpFetch = globalThis.fetch
    const external = vi.fn()
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (!String(url).startsWith(`${base}/`)) {
        external()
        return Promise.reject(new Error('External requests forbidden'))
      }
      return httpFetch(url, init)
    })
    try {
      const cases: Record<string, string>[] = [
        { action: 'sync-date', date: `z${input}` },
        { action: 'sync-range', since: `z${input}`, until: `z${input}` },
        { action: 'sync-gaps', since: `z${input}`, until: `z${input}` },
        { action: 'sync-date', date: `0${input}` },
        { action: 'sync-bulk' },
        { action: `unknown-${input}` },
      ]
      const responses = []
      for (const [index, params] of cases.entries()) {
        const values = { scope: 'organization', githubOrg: input, githubTeam: input, ...params }
        const requestId = `req-sync-${source}-${index}`
        const query = source === 'query' ? `?${new URLSearchParams(values)}` : ''
        const response = await fetch(`${base}/api/admin/sync${query}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-request-id': requestId },
          ...(source === 'body' ? { body: JSON.stringify(values) } : {}),
        })
        expect(response.headers.get('x-request-id')).toBe(requestId)
        const payload = await response.json()
        responses.push(payload)
        expect(response.status).toBe(index === cases.length - 1 ? 500 : 200)
      }
      expect(responses[0]).toMatchObject({ result: { success: true, date: `z${input}`, metricsCount: 0 } })
      expect(responses[1]).toMatchObject({ results: [], totalDays: 0 })
      expect(responses[2]).toMatchObject({ results: [], gapsDetected: 0 })
      expect(responses[3]).toMatchObject({ result: { success: false, date: `0${input}` } })
      expect(responses[4]).toMatchObject({ success: false })
      expect(external).not.toHaveBeenCalled()
      const records = lines.map(line => JSON.parse(line))
      expect(records).toEqual(expect.arrayContaining([
        expect.objectContaining({ tag: 'admin-sync', level: 'info', requestId: `req-sync-${source}-0` }),
        expect.objectContaining({ tag: 'sync-service', level: 'info' }),
        expect.objectContaining({ tag: 'sync-service', level: 'error', name: 'Error', code: 'ECONNREFUSED', statusCode: 503 }),
        expect.objectContaining({ tag: 'request', status: 500, requestId: `req-sync-${source}-5` }),
      ]))
      expect(records.filter(record => record.tag === 'request')).toHaveLength(cases.length)
      expect(lines.join('\n')).not.toContain(input)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      await closePool()
    }
  })

  it.each(['json', 'pretty'])('keeps only safe metadata and never serializes raw errors in %s', async (format) => {
    vi.stubGlobal('useRuntimeConfig', () => ({ logLevel: 'debug', logFormat: format }))
    const lines = capture()
    const { createLogger } = await import('../server/utils/logger')
    const error = Object.assign(new Error(`https://example.invalid/auth?code=${sentinel}`), {
      statusCode: 401,
      cause: { access_token: sentinel },
      data: { email: `${sentinel}@example.invalid` },
    })
    const fields: Record<string, unknown> = {
      status: 401, requestId: 'request-safe', headers: { authorization: sentinel },
      body: sentinel, data: error.data, token: sentinel, message: sentinel, level: sentinel,
      bigint: 1n,
    }
    fields.circular = fields
    const logger = createLogger('contract')
    expect(() => logger.error('OAuth exchange failed', fields, error)).not.toThrow()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('OAuth exchange failed')
    expect(lines[0]).toContain('401')
    expect(lines[0]).not.toContain(sentinel)
    if (format === 'json') {
      expect(JSON.parse(lines[0]!)).toMatchObject({
        level: 'error', tag: 'contract', status: 401, requestId: 'request-safe',
        args: [{ name: 'Error', statusCode: 401 }],
      })
    }
  })

  it('uses supported consola levels, production JSON and standalone environment fallback', async () => {
    vi.stubGlobal('useRuntimeConfig', undefined)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NUXT_LOG_FORMAT', '')
    vi.stubEnv('NUXT_LOG_LEVEL', 'warn')
    const lines = capture()
    const { createLogger } = await import('../server/utils/logger')
    const logger = createLogger('sync')
    logger.info('hidden')
    logger.warn('retrying')
    logger.error('failed')
    expect(lines.map(line => JSON.parse(line).level)).toEqual(['warn', 'error'])
    vi.stubEnv('NUXT_LOG_LEVEL', 'silent')
    logger.error('hidden')
    expect(lines).toHaveLength(2)
    vi.stubEnv('NUXT_LOG_LEVEL', 'toString')
    logger.info('default level')
    expect(JSON.parse(lines[2]!).message).toBe('default level')
  })

  it('initializes the real proxy agent without logging userinfo and still rethrows failures', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ logLevel: 'info', logFormat: 'json' }))
    vi.stubEnv('HTTP_PROXY', `http://${sentinel}:${sentinel}@proxy.example.invalid:8080`)
    vi.stubEnv('CUSTOM_CA_PATH', '')
    const previous = getGlobalDispatcher()
    const lines = capture()
    const { initializeProxyAgent } = await import('../server/utils/proxy-agent')
    const agent = initializeProxyAgent()
    try {
      expect(getGlobalDispatcher()).toBe(agent)
      expect(lines.join('\n')).toContain('Proxy initialized')
      expect(lines.join('\n')).not.toContain(sentinel)
      vi.stubEnv('CUSTOM_CA_PATH', `./nonexistent-${sentinel}.crt`)
      expect(() => initializeProxyAgent()).toThrow('CUSTOM_CA_PATH file not found')
      expect(lines.map(line => JSON.parse(line).level)).toEqual(['info', 'error'])
      expect(lines.join('\n')).not.toContain(sentinel)
    } finally {
      setGlobalDispatcher(previous)
      await agent?.close()
    }
  })

  it('redacts an actual OAuth error and correlates response, request and error over HTTP', async () => {
    vi.stubGlobal('defineEventHandler', defineEventHandler)
    vi.stubGlobal('defineOAuthGitHubEventHandler', (options: unknown) => options)
    vi.stubGlobal('sendRedirect', sendRedirect)
    vi.stubGlobal('getAppBaseURL', () => '/')
    vi.stubGlobal('useRuntimeConfig', () => ({ logLevel: 'debug', logFormat: 'json' }))
    const lines = capture()
    const { default: logRequest } = await import('../server/middleware/00.log')
    const { default: oauthHandler } = await import('../server/routes/auth/github.get')
    const oauth = oauthHandler as unknown as { onError: (event: H3Event, error: Error) => Promise<unknown> }
    const app = createApp()
    app.use(logRequest)
    app.use(defineEventHandler(event => {
      if (event.path.startsWith('/auth/github')) {
        return oauth.onError(event, Object.assign(new Error(`OAuth code=${sentinel}`), {
          statusCode: 401, data: { access_token: sentinel }, cause: sentinel,
        }))
      }
      return { requestId: event.context.requestId }
    }))
    const server = createServer(toNodeListener(app))
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')
    const base = `http://127.0.0.1:${address.port}`
    try {
      const response = await fetch(`${base}/auth/github?code=${sentinel}&state=${sentinel}&password=${sentinel}`, {
        redirect: 'manual', headers: { 'x-request-id': 'req-contract-1', authorization: `Bearer ${sentinel}` },
      })
      expect(response.status).toBe(302)
      expect(response.headers.get('x-request-id')).toBe('req-contract-1')
      const records = lines.map(line => JSON.parse(line))
      expect(records).toEqual(expect.arrayContaining([
        expect.objectContaining({ tag: 'auth-github', level: 'error', requestId: 'req-contract-1' }),
        expect.objectContaining({
          tag: 'request', method: 'GET', path: '/auth/github', status: 302,
          requestId: 'req-contract-1', durationMs: expect.any(Number),
        }),
      ]))
      expect(lines.join('\n')).not.toContain(sentinel)

      for (const header of ['bad id', 'x'.repeat(129), 'one,two']) {
        const reply = await fetch(`${base}/api/test`, { headers: { 'x-request-id': header } })
        const id = reply.headers.get('x-request-id')
        expect(id).toMatch(/^[a-f0-9-]{36}$/)
        expect(await reply.json()).toEqual({ requestId: id })
      }
      const count = lines.length
      for (const path of ['/api/health?code=hidden', '/api/ready', '/api/live', '/_nuxt/test.js', '/favicon.svg']) {
        const reply = await fetch(`${base}${path}`)
        expect(reply.headers.get('x-request-id')).toBeTruthy()
        await reply.text()
      }
      expect(lines).toHaveLength(count)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })

  it('assigns IDs before real authentication middleware rejects an HTTP request', async () => {
    vi.stubGlobal('defineEventHandler', defineEventHandler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getUserSession', async () => ({}))
    vi.stubGlobal('useRuntimeConfig', () => ({
      logLevel: 'debug', logFormat: 'json', public: { requireAuth: true },
    }))
    const lines = capture()
    const app = createApp()
    const middleware = import.meta.glob<{ default: ReturnType<typeof defineEventHandler> }>('../server/middleware/*.ts')
    for (const path of Object.keys(middleware).sort()) {
      app.use((await middleware[path]!()).default)
    }
    app.use(defineEventHandler(() => 'should not reach handler'))
    const server = createServer(toNodeListener(app))
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/metrics?code=${sentinel}`, {
        headers: { 'x-request-id': 'req-auth-rejection' },
      })
      expect(response.status, await response.text()).toBe(401)
      expect(response.headers.get('x-request-id')).toBe('req-auth-rejection')
      expect(lines.map(line => JSON.parse(line))).toEqual([
        expect.objectContaining({ status: 401, path: '/api/metrics', requestId: 'req-auth-rejection' }),
      ])
      expect(lines.join('\n')).not.toContain(sentinel)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
})
