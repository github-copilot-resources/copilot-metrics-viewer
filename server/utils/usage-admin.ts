/**
 * Usage-admin gating for the per-user billing breakdown tab.
 *
 * The admin Billing tab surfaces /settings/billing/ai_credit/usage data that
 * is sensitive (it reveals individual users' premium-request spend). It is
 * gated by a closed-by-default allowlist read from the NUXT_USAGE_ADMINS
 * environment variable.
 *
 * This is intentionally STRICTER than NUXT_AUTHORIZED_USERS in
 * server/utils/authorization.ts:
 *   - authorizedUsers is open-by-default (empty = anyone authenticated)
 *   - usageAdmins is closed-by-default (empty = NO admins)
 *   - usageAdmins does not support email-domain wildcards — only explicit
 *     logins / email addresses, to avoid accidentally granting admin to a
 *     whole company.
 */

import type { H3Event, EventHandlerRequest } from 'h3'
import type { AuthorizedIdentity } from './authorization'

/**
 * Pure check — accepts an explicit allowlist string so it can be unit-tested
 * without mocking Nuxt runtime config.
 *
 * @param identity   The authenticated user's login and/or email
 * @param allowlist  Comma-separated logins/emails (empty or whitespace = no admins)
 */
export function isUsageAdmin(
  identity: AuthorizedIdentity,
  allowlist: string
): boolean {
  if (!allowlist || !allowlist.trim()) {
    return false
  }

  const login = identity.login?.toLowerCase()
  const email = identity.email?.toLowerCase()
  if (!login && !email) {
    return false
  }

  const allowed = allowlist
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

  return allowed.some(entry =>
    (login !== undefined && entry === login) ||
    (email !== undefined && entry === email)
  )
}

/**
 * H3 wrapper that reads the allowlist from runtime config (NUXT_USAGE_ADMINS).
 * Returns false if no session is present.
 */
export async function isUsageAdminForEvent(
  event: H3Event<EventHandlerRequest>
): Promise<boolean> {
  const config = useRuntimeConfig(event)
  const allowlist = (config.usageAdmins as string | undefined) ?? ''
  if (!allowlist.trim()) {
    return false
  }

  const session = await getUserSession(event).catch(() => null)
  const user = session?.user as { login?: string; email?: string } | undefined
  if (!user) {
    return false
  }

  return isUsageAdmin({ login: user.login, email: user.email }, allowlist)
}

/**
 * Throws 403 if the caller is not a usage admin. Use this at the top of any
 * server handler that returns per-user billing data.
 */
export async function requireUsageAdmin(
  event: H3Event<EventHandlerRequest>
): Promise<void> {
  const ok = await isUsageAdminForEvent(event)
  if (!ok) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: this endpoint requires usage-admin privileges (NUXT_USAGE_ADMINS).'
    })
  }
}
