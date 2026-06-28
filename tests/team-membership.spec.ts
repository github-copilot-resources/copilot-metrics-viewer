/**
 * Tests for requireTeamMembershipOrAdmin (Policy C, issue #398).
 *
 * Covers the GDPR-driven decision matrix:
 *   - No team filter            → no-op
 *   - Admin                     → no-op
 *   - PAT-mode (no OAuth)       → no-op (handled by isUsageAdminForEvent)
 *   - Reports-to virtual team   → no-op
 *   - Enterprise + non-admin    → 403 (no membership endpoint)
 *   - Org team + member         → no-op
 *   - Org team + non-member     → 403
 *   - Org team + pending state  → 403
 *   - Org team + maintainer     → no-op
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Nitro global stubs ───────────────────────────────────────────────────────
;(globalThis as any).defineEventHandler = (h: any) => h
;(globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
  const err: any = new Error(statusMessage)
  err.statusCode = statusCode
  return err
}
;(globalThis as any).useRuntimeConfig = () => ({ githubApiBaseUrl: '' })

let _fetchResult: { status: number; _data: any } = { status: 200, _data: { state: 'active', role: 'member' } }
;(globalThis as any).$fetch = {
  raw: vi.fn(async () => _fetchResult),
}

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockIsUsageAdmin = vi.fn()
const mockGetSessionLogin = vi.fn()
vi.mock('../server/utils/usage-admin', () => ({
  isUsageAdminForEvent: (...args: any[]) => mockIsUsageAdmin(...args),
  getSessionLoginForFilter: (...args: any[]) => mockGetSessionLogin(...args),
}))

import { requireTeamMembershipOrAdmin } from '../server/utils/team-membership'

function makeEvent(authHeader = 'Bearer xyz') {
  return {
    context: {
      headers: new Headers(authHeader ? { Authorization: authHeader } : {}),
    },
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  _fetchResult = { status: 200, _data: { state: 'active', role: 'member' } }
})

describe('requireTeamMembershipOrAdmin — no-op cases', () => {
  it('returns without check when no teamSlug is set', async () => {
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', undefined),
    ).resolves.toBeUndefined()
    expect(mockIsUsageAdmin).not.toHaveBeenCalled()
    expect((globalThis as any).$fetch.raw).not.toHaveBeenCalled()
  })

  it('returns without GitHub probe when caller is admin', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(true)
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'engineers'),
    ).resolves.toBeUndefined()
    expect((globalThis as any).$fetch.raw).not.toHaveBeenCalled()
  })

  it('returns without GitHub probe for reports-to virtual teams', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'reports-to:boss@example.com'),
    ).resolves.toBeUndefined()
    expect((globalThis as any).$fetch.raw).not.toHaveBeenCalled()
  })

  it('treats reports-to: prefix case-insensitively', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'Reports-To:boss'),
    ).resolves.toBeUndefined()
    expect((globalThis as any).$fetch.raw).not.toHaveBeenCalled()
  })
})

describe('requireTeamMembershipOrAdmin — enterprise scope is blocked for non-admins', () => {
  it('throws 403 for enterprise scope when not admin', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'enterprise', undefined, 'engineers'),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect((globalThis as any).$fetch.raw).not.toHaveBeenCalled()
  })

  it('throws 403 for team-enterprise scope when not admin', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'team-enterprise', undefined, 'engineers'),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('admins ARE allowed enterprise+team queries (short-circuits before the enterprise block)', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(true)
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'enterprise', undefined, 'engineers'),
    ).resolves.toBeUndefined()
  })
})

describe('requireTeamMembershipOrAdmin — org scope membership probe', () => {
  it('allows when GitHub returns 200 active member', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce('alice')
    _fetchResult = { status: 200, _data: { state: 'active', role: 'member' } }
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'engineers'),
    ).resolves.toBeUndefined()
    const calledUrl = (globalThis as any).$fetch.raw.mock.calls[0][0]
    expect(calledUrl).toBe('https://api.github.com/orgs/acme/teams/engineers/memberships/alice')
  })

  it('allows when GitHub returns 200 active maintainer', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce('alice')
    _fetchResult = { status: 200, _data: { state: 'active', role: 'maintainer' } }
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'engineers'),
    ).resolves.toBeUndefined()
  })

  it('denies when GitHub returns 404 (not a member)', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce('eve')
    _fetchResult = { status: 404, _data: { message: 'Not Found' } }
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'engineers'),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('denies when membership state is pending (invitation not accepted)', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce('alice')
    _fetchResult = { status: 200, _data: { state: 'pending', role: 'member' } }
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'engineers'),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('denies when role is something unexpected (defence in depth)', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce('alice')
    _fetchResult = { status: 200, _data: { state: 'active', role: 'observer' } }
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'engineers'),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('returns 400 when team filter is set without an org (org scope)', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', undefined, 'engineers'),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns 401 when OAuth mode but no session login resolved', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce(null)
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'engineers'),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns 401 when no Authorization header is attached', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce('alice')
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(''), 'organization', 'acme', 'engineers'),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('URL-encodes org, team, and login so injection cannot escape the path', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce('al ice/../admin')
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme/extra', 'engineers?x=1'),
    ).resolves.toBeUndefined()
    const calledUrl = (globalThis as any).$fetch.raw.mock.calls[0][0]
    expect(calledUrl).toBe(
      'https://api.github.com/orgs/acme%2Fextra/teams/engineers%3Fx%3D1/memberships/al%20ice%2F..%2Fadmin',
    )
  })

  it('treats network errors as deny (fail-closed)', async () => {
    mockIsUsageAdmin.mockResolvedValueOnce(false)
    mockGetSessionLogin.mockResolvedValueOnce('alice')
    ;((globalThis as any).$fetch.raw as any).mockRejectedValueOnce(new Error('boom'))
    await expect(
      requireTeamMembershipOrAdmin(makeEvent(), 'organization', 'acme', 'engineers'),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})
