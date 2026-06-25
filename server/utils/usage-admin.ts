/**
 * Usage-admin gating for the Billing tab.
 *
 * The Billing tab surfaces /settings/billing/ai_credit/usage data — an
 * AGGREGATE breakdown by SKU/model/cost-center/repo. It does not expose
 * per-user attribution (that lives on User Metrics as `ai_credits_used`).
 *
 * Gating is OPEN-BY-DEFAULT and mirrors NUXT_AUTHORIZED_USERS:
 *   - empty NUXT_USAGE_ADMINS → anyone who can already use the dashboard
 *     can see the Billing tab (trust-the-deployment-perimeter mode)
 *   - non-empty NUXT_USAGE_ADMINS → strict allowlist of logins/emails
 *
 * Unlike NUXT_AUTHORIZED_USERS we do NOT support email-domain wildcards —
 * only explicit logins / email addresses — so the admin set is auditable
 * when an allowlist is configured.
 */

import type { H3Event, EventHandlerRequest } from 'h3'
import type { AuthorizedIdentity } from './authorization'

/**
 * Pure check — accepts an explicit allowlist string so it can be unit-tested
 * without mocking Nuxt runtime config.
 *
 * @param identity   The authenticated user's login and/or email
 * @param allowlist  Comma-separated logins/emails (empty or whitespace = open)
 */
export function isUsageAdmin(
  identity: AuthorizedIdentity,
  allowlist: string
): boolean {
  // Open-by-default: an unconfigured allowlist means everyone is an admin.
  // Same semantics as authorizedUsers in server/utils/authorization.ts.
  if (!allowlist || !allowlist.trim()) {
    return true
  }

  const allowed = allowlist
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

  // A string like ",,," parses to zero entries — still treat as "open".
  if (allowed.length === 0) {
    return true
  }

  const login = identity.login?.toLowerCase()
  const email = identity.email?.toLowerCase()
  if (!login && !email) {
    return false
  }

  return allowed.some(entry =>
    (login !== undefined && entry === login) ||
    (email !== undefined && entry === email)
  )
}

/**
 * H3 wrapper that reads the allowlist from runtime config (NUXT_USAGE_ADMINS).
 *
 * Behaviour:
 *   - allowlist empty                              → true  (open by default)
 *   - allowlist set, session present + on list     → true
 *   - allowlist set, session present + not on list → false
 *   - allowlist set, NO session                    → false
 */
export async function isUsageAdminForEvent(
  event: H3Event<EventHandlerRequest>
): Promise<boolean> {
  const config = useRuntimeConfig(event)
  const allowlist = (config.usageAdmins as string | undefined) ?? ''

  // Open-by-default — empty or whitespace-only allowlist grants access.
  if (!allowlist.trim()) {
    return true
  }
  // A "list" with only delimiters is also treated as open.
  const parsed = allowlist.split(',').map(s => s.trim()).filter(Boolean)
  if (parsed.length === 0) {
    return true
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
 * server handler that returns admin-gated billing data.
 */
export async function requireUsageAdmin(
  event: H3Event<EventHandlerRequest>
): Promise<void> {
  const ok = await isUsageAdminForEvent(event)
  if (!ok) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: your account is not on the NUXT_USAGE_ADMINS allowlist.'
    })
  }
}
