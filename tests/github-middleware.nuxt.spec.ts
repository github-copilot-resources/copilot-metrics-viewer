import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub Nuxt/h3 helper used at module import time so defineEventHandler calls in
// the middleware file don't throw during tests.
;(globalThis as any).defineEventHandler = (handler: any) => handler

// Mock the authentication module so the middleware uses the mocked function.
vi.mock('../server/modules/authentication', () => ({
  authenticateAndGetGitHubHeaders: vi.fn()
}))

// We'll import the mocked auth module and the middleware dynamically after the
// defineEventHandler stub is installed (static imports are hoisted and would
// otherwise attempt to evaluate the middleware file too early).
let authenticateAndGetGitHubHeaders: any
let middlewareHandler: any

beforeEach(async () => {
  vi.clearAllMocks()

  // Minimal runtime config used by the middleware
  ;(globalThis as any).useRuntimeConfig = (_event?: unknown) => ({
    public: {
      githubEnt: undefined,
      githubOrg: undefined,
      githubTeam: undefined,
      version: 'test'
    }
  })

  // Dynamically import the mocked authentication module and middleware
  const auth = await import('../server/modules/authentication')
  authenticateAndGetGitHubHeaders = auth.authenticateAndGetGitHubHeaders

  const mw = await import('../server/middleware/github')
  middlewareHandler = mw.default
})

describe('GitHub middleware authentication guard', () => {
  it('skips authentication for health endpoints', async () => {
    // If the auth function is called during this test, fail the test
    ;(authenticateAndGetGitHubHeaders as any).mockImplementation(() => { throw new Error('authenticate called unexpectedly') })

    const event: any = {
      node: { req: { url: '/api/health' } },
      context: {}
    }

    await expect((middlewareHandler as any)(event)).resolves.not.toThrow()
    expect(authenticateAndGetGitHubHeaders).not.toHaveBeenCalled()
  })

  it('skips authentication for live and ready endpoints', async () => {
    ;(authenticateAndGetGitHubHeaders as any).mockImplementation(() => { throw new Error('authenticate called unexpectedly') })

    const liveEvent: any = { node: { req: { url: '/api/live' } }, context: {} }
    const readyEvent: any = { node: { req: { url: '/api/ready' } }, context: {} }

    await expect((middlewareHandler as any)(liveEvent)).resolves.not.toThrow()
    await expect((middlewareHandler as any)(readyEvent)).resolves.not.toThrow()
    expect(authenticateAndGetGitHubHeaders).not.toHaveBeenCalled()
  })

  it('requires authentication for other api routes', async () => {
    // Return a resolved Headers object to simulate successful authentication
    ;(authenticateAndGetGitHubHeaders as any).mockResolvedValue(new Headers({ Authorization: 'token x' }))

    const event: any = {
      node: { req: { url: '/api/metrics' } },
      context: {}
    }

    await (middlewareHandler as any)(event)

    expect(authenticateAndGetGitHubHeaders).toHaveBeenCalled()
    expect(event.context.headers).toBeInstanceOf(Headers)
  })
})
