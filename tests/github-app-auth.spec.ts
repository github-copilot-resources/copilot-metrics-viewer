import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

const mockFetch = vi.hoisted(() => {
  const fetch = vi.fn()
  ;(globalThis as { $fetch?: unknown }).$fetch = fetch
  return fetch
})

vi.mock('ofetch', () => ({ $fetch: mockFetch }))

import { listAppInstallations } from '../server/modules/github-app-auth'

describe('listAppInstallations', () => {
  it('uses an enterprise account slug when its installation has no login', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    mockFetch.mockResolvedValueOnce([
      {
        id: 42,
        account: { slug: 'my-real-ent', type: 'Enterprise' },
      },
    ])

    const installations = await listAppInstallations(
      '12345',
      privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    )

    expect(installations).toEqual([
      { id: 42, login: 'my-real-ent', type: 'Enterprise' },
    ])
  })
})