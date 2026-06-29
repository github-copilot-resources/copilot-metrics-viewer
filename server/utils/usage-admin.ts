/**
 * Usage-admin gating for admin-only data surfaces.
 *
 * Two surfaces use this allowlist:
 *   1. The **Billing tab** (/api/billing-credits) — aggregate AI-credit
 *      breakdown by SKU/model/cost-center/repo.
 *   2. **User-level breakdown data** (/api/user-metrics, /api/seats) —
 *      per-user names and metrics. Non-admins are restricted to their own
 *      row only (issue #398 — Austrian/EU compliance).
 *
 * Gating is **CLOSED-BY-DEFAULT** in OAuth-mode deployments: when
 * NUXT_USAGE_ADMINS is empty, NO ONE is an admin. This is a deliberate
 * breaking change from earlier versions to align with the principle of
 * least privilege and the EU compliance requirement in issue #398.
 *
 * In **PAT-mode deployments** (no OAuth provider configured, recognised via
 * requireAuth / usingGithubAuth / isPublicApp / authProviders all falsy)
 * there is no per-user identity, so the allowlist has no signal to act on.
 * In that case we treat every caller as admin so the Billing tab and
 * per-user breakdowns remain usable. PAT-mode is the legacy single-tenant
 * model — it should be locked down at the network layer (firewall / IP
 * allowlist) rather than at the row layer.
 *
 * To restore the old "everyone sees everything" behaviour, deployments must
 * set `NUXT_USAGE_ADMINS` to an explicit allowlist of logins/emails.
 *
 * We do NOT support email-domain wildcards — only explicit logins / email
 * addresses — so the admin set is auditable.
 */

import type { H3Event, EventHandlerRequest } from 'h3'
import type { AuthorizedIdentity } from './authorization'

/**
 * Pure check — accepts an explicit allowlist string so it can be unit-tested
 * without mocking Nuxt runtime config.
 *
 * Closed-by-default: empty / whitespace / delimiters-only allowlist → false.
 *
 * @param identity   The authenticated user's login and/or email
 * @param allowlist  Comma-separated logins/emails
 */
export function isUsageAdmin(
  identity: AuthorizedIdentity,
  allowlist: string
): boolean {
  // Closed-by-default: an unconfigured allowlist means NO admin access.
  if (!allowlist || !allowlist.trim()) {
    return false
  }

  const allowed = allowlist
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

  // A string like ",,," parses to zero entries — still treat as closed.
  if (allowed.length === 0) {
    return false
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
 *   - allowlist empty                              → false (closed by default)
 *   - allowlist set, session present + on list     → true
 *   - allowlist set, session present + not on list → false
 *   - allowlist set, NO session                    → false
 */
export async function isUsageAdminForEvent(
  event: H3Event<EventHandlerRequest>
): Promise<boolean> {
  const config = useRuntimeConfig(event)
  const allowlist = (config.usageAdmins as string | undefined) ?? ''

  // PAT-mode short-circuit: when no OAuth/auth provider is configured, there
  // is no per-user identity to gate on. The deployment operator is implicitly
  // the only "user" — treat them as admin so the Billing tab remains usable.
  // PAT-mode deployments are expected to be locked down at the network layer
  // (e.g. PREVIEW_ALLOWED_IPS) rather than at the row layer.
  const pub = config.public as Record<string, unknown>
  const authConfigured =
    pub.requireAuth || pub.usingGithubAuth || pub.isPublicApp || !!pub.authProviders
  if (!authConfigured) return true

  // Closed-by-default — empty or whitespace-only allowlist denies access.
  if (!allowlist.trim()) {
    return false
  }
  // A "list" with only delimiters is also treated as closed.
  const parsed = allowlist.split(',').map(s => s.trim()).filter(Boolean)
  if (parsed.length === 0) {
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

/**
 * Resolve the session login for filtering per-user data when the caller is
 * NOT a usage admin. Returns `null` when no session is available (e.g.
 * unauthenticated PAT-mode requests) so the caller can decide how to react.
 *
 * Used by /api/user-metrics and /api/seats to enforce issue #398's rule:
 * "non-admins may only see their own user breakdown row".
 */
export async function getSessionLoginForFilter(
  event: H3Event<EventHandlerRequest>
): Promise<string | null> {
  const session = await getUserSession(event).catch(() => null)
  const user = session?.user as { login?: string } | undefined
  return user?.login || null
}

