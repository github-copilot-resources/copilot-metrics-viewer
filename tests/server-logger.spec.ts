import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'

;(globalThis as any).defineEventHandler = (handler: any) => handler

const originalEnv = { ...process.env }

function captureConsole() {
  const calls: string[] = []
  const spies = ['error', 'warn', 'info', 'debug', 'log'].map((method) =>
    vi.spyOn(console, method as keyof Console).mockImplementation((...args: unknown[]) => {
      calls.push(args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '))
    })
  )
  return { calls, restore: () => spies.forEach(spy => spy.mockRestore()) }
}

async function importFresh<T>(path: string): Promise<T> {
  vi.resetModules()
  return await import(path) as T
}

function createEvent(url: string, requestId?: string) {
  const res = new EventEmitter() as EventEmitter & {
    statusCode: number
    setHeader: (name: string, value: string) => void
    getHeader: (name: string) => string | undefined
    headers: Record<string, string>
  }
  res.statusCode = 200
  res.headers = {}
  res.setHeader = (name: string, value: string) => { res.headers[name.toLowerCase()] = value }
  res.getHeader = (name: string) => res.headers[name.toLowerCase()]

  return {
    method: 'GET',
    node: {
      req: {
        method: 'GET',
        url,
        headers: requestId ? { 'x-request-id': requestId } : {}
      },
      res
    },
    context: {}
  } as any
}

beforeEach(() => {
  process.env = { ...originalEnv }
  ;(globalThis as any).useRuntimeConfig = () => ({
    logLevel: 'info',
    logFormat: 'pretty',
    logRequests: 'false'
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
})

describe('server logger', () => {
  it('honors NUXT_LOG_LEVEL from runtime config', async () => {
    ;(globalThis as any).useRuntimeConfig = () => ({
      logLevel: 'warn',
      logFormat: 'pretty',
      logRequests: 'false'
    })
    const captured = captureConsole()
    const { createLogger } = await importFresh<typeof import('../server/utils/logger')>('../server/utils/logger')

    const logger = createLogger('test')
    logger.info('hidden info')
    logger.warn('visible warning')

    expect(captured.calls.join('\n')).not.toContain('hidden info')
    expect(captured.calls.join('\n')).toContain('visible warning')
    captured.restore()
  })
})

describe('request log middleware', () => {
  it('skips health endpoints', async () => {
    ;(globalThis as any).useRuntimeConfig = () => ({
      logLevel: 'debug',
      logFormat: 'pretty',
      logRequests: 'true'
    })
    const captured = captureConsole()
    const middleware = await importFresh<typeof import('../server/middleware/log')>('../server/middleware/log')
    const event = createEvent('/api/health')

    await middleware.default(event)
    event.node.res.emit('finish')

    expect(captured.calls).toHaveLength(0)
    captured.restore()
  })

  it('redacts query strings from request logs', async () => {
    ;(globalThis as any).useRuntimeConfig = () => ({
      logLevel: 'debug',
      logFormat: 'pretty',
      logRequests: 'true'
    })
    const captured = captureConsole()
    const middleware = await importFresh<typeof import('../server/middleware/log')>('../server/middleware/log')
    const event = createEvent('/auth/github?code=secret-code&state=secret-state')

    await middleware.default(event)
    event.node.res.emit('finish')

    const output = captured.calls.join('\n')
    expect(output).toContain('/auth/github')
    expect(output).not.toContain('?code=')
    expect(output).not.toContain('secret-code')
    expect(output).not.toContain('secret-state')
    captured.restore()
  })

  it('generates a request id when absent', async () => {
    const middleware = await importFresh<typeof import('../server/middleware/log')>('../server/middleware/log')
    const event = createEvent('/api/metrics')

    await middleware.default(event)

    expect(event.node.res.getHeader('x-request-id')).toEqual(expect.any(String))
    expect(event.context.requestId).toBe(event.node.res.getHeader('x-request-id'))
  })

  it('echoes an existing request id', async () => {
    const middleware = await importFresh<typeof import('../server/middleware/log')>('../server/middleware/log')
    const event = createEvent('/api/metrics', 'req-123')

    await middleware.default(event)

    expect(event.node.res.getHeader('x-request-id')).toBe('req-123')
    expect(event.context.requestId).toBe('req-123')
  })
})
