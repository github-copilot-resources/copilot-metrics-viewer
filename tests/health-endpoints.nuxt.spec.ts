/**
 * Tests for the /api/health, /api/ready and /api/live endpoints.
 *
 * The handlers use the Nuxt auto-import `defineEventHandler` and
 * `useRuntimeConfig`. Since all tests run under the Nuxt vitest environment,
 * `useRuntimeConfig` is already available — we only need to stub
 * `defineEventHandler` (which is not globally stubbed in test.setup.ts).
 *
 * No separate Nuxt environment override needed.
 */

import { describe, it, expect } from 'vitest'

// ── Nitro global stub ─────────────────────────────────────────────────────────
;(globalThis as any).defineEventHandler = (h: any) => h

/** Minimal H3 event that satisfies the handlers. */
function makeEvent() {
  return { context: { headers: new Headers() }, node: { req: { url: '/api/health' } } }
}

// ── /api/health ───────────────────────────────────────────────────────────────

describe('/api/health', () => {
  it('returns the correct shape with all required fields', async () => {
    const { default: handler } = await import('../server/api/health')
    const result = await handler(makeEvent() as any)

    expect(result).toMatchObject({ status: 'healthy' })
    expect(typeof result.version).toBe('string')
    expect(result.version.length).toBeGreaterThan(0)
    expect(typeof result.timestamp).toBe('string')
    expect(typeof result.uptime).toBe('number')
  })

  it('timestamp is a valid ISO 8601 string', async () => {
    const { default: handler } = await import('../server/api/health')
    const result = await handler(makeEvent() as any)

    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
  })

  it('uptime is non-negative', async () => {
    const { default: handler } = await import('../server/api/health')
    const result = await handler(makeEvent() as any)

    expect(result.uptime).toBeGreaterThanOrEqual(0)
  })
})

// ── /api/ready ────────────────────────────────────────────────────────────────

describe('/api/ready', () => {
  it('returns the correct shape with all required fields', async () => {
    const { default: handler } = await import('../server/api/ready')
    const result = await handler(makeEvent() as any)

    expect(result).toMatchObject({
      status: 'ready',
      checks: { server: 'ok', config: 'ok' },
    })
    expect(typeof result.version).toBe('string')
    expect(typeof result.timestamp).toBe('string')
  })

  it('timestamp is a valid ISO 8601 string', async () => {
    const { default: handler } = await import('../server/api/ready')
    const result = await handler(makeEvent() as any)

    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
  })
})

// ── /api/live ─────────────────────────────────────────────────────────────────

describe('/api/live', () => {
  it('returns the correct shape with all required fields', async () => {
    const { default: handler } = await import('../server/api/live')
    const result = await handler(makeEvent() as any)

    expect(result).toMatchObject({ status: 'alive' })
    expect(typeof result.version).toBe('string')
    expect(typeof result.timestamp).toBe('string')
    expect(typeof result.pid).toBe('number')
    expect(typeof result.uptime).toBe('number')
    expect(typeof result.memory).toBe('object')
    expect(typeof result.memory.used).toBe('number')
    expect(typeof result.memory.total).toBe('number')
  })

  it('timestamp is a valid ISO 8601 string', async () => {
    const { default: handler } = await import('../server/api/live')
    const result = await handler(makeEvent() as any)

    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
  })

  it('pid is a positive integer', async () => {
    const { default: handler } = await import('../server/api/live')
    const result = await handler(makeEvent() as any)

    expect(result.pid).toBeGreaterThan(0)
    expect(Number.isInteger(result.pid)).toBe(true)
  })

  it('uptime is non-negative', async () => {
    const { default: handler } = await import('../server/api/live')
    const result = await handler(makeEvent() as any)

    expect(result.uptime).toBeGreaterThanOrEqual(0)
  })

  it('memory.used and memory.total are non-negative integers', async () => {
    const { default: handler } = await import('../server/api/live')
    const result = await handler(makeEvent() as any)

    expect(result.memory.used).toBeGreaterThanOrEqual(0)
    expect(result.memory.total).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(result.memory.used)).toBe(true)
    expect(Number.isInteger(result.memory.total)).toBe(true)
  })
})

