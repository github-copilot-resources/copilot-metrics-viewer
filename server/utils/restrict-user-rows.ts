/**
 * User-data visibility filter for issue #398 (Austrian/EU compliance).
 *
 * Non-admin callers must NOT see other users' breakdown rows. Each endpoint
 * that returns per-user records (currently /api/user-metrics, /api/seats)
 * delegates to this helper to strip out everyone except the session login
 * itself.
 *
 * Behaviour matrix:
 *   - Mock mode                                     → return rows unchanged
 *   - PAT-mode (no OAuth configured)                → return rows unchanged
 *   - isUsageAdminForEvent === true                 → return rows unchanged
 *   - No session login resolvable                   → return []
 *   - Otherwise                                     → keep only the row whose
 *                                                     login matches the session
 *
 * The matcher is case-insensitive on the `login` field — GitHub logins are
 * case-insensitive in URLs but the API can return either casing.
 *
 * Rows with a missing / empty login are NEVER returned to non-admins, so a
 * legacy sentinel like "" or null cannot wildcard-match a logged-in caller.
 */

import type { H3Event, EventHandlerRequest } from 'h3'
import { isUsageAdminForEvent, getSessionLoginForFilter } from './usage-admin'

export interface HasLogin {
  login?: string
  user_login?: string
}

export interface RestrictOptions {
  /** Skip filtering entirely — used by mock-mode endpoints. */
  isMocked?: boolean
}

export interface RestrictDecisionInputs {
  isMocked: boolean
  authConfigured: boolean
  isAdmin: boolean
  sessionLogin: string | null
}

/**
 * Pure decision function. No I/O, no Nuxt imports — directly unit-testable.
 *
 * This is the LOAD-BEARING security primitive for issue #398: if this returns
 * other users' rows to a non-admin, that is a GDPR violation. Test it.
 */
export function filterRowsByDecision<T extends HasLogin>(
  rows: T[],
  inputs: RestrictDecisionInputs
): T[] {
  if (inputs.isMocked) return rows
  if (!inputs.authConfigured) return rows
  if (inputs.isAdmin) return rows
  if (!inputs.sessionLogin) return []

  const target = inputs.sessionLogin.toLowerCase()
  return rows.filter(r => {
    const rowLoginRaw = r.login || r.user_login || ''
    if (!rowLoginRaw) return false
    return rowLoginRaw.toLowerCase() === target
  })
}

/**
 * Filter a list of user rows down to the caller's own row when the caller is
 * not on the NUXT_USAGE_ADMINS allowlist.
 *
 * Returns the rows unchanged when:
 *   - `isMocked` is true (test fixtures stay browsable in local/Playwright)
 *   - the deployment is running in PAT-mode (no OAuth / no per-user identity);
 *     issue #398's restrict-to-self rule has no signal to act on, so applying
 *     it would render the dashboard empty for every caller. PAT-mode is the
 *     legacy single-tenant model — it should be locked down at the network
 *     layer (e.g. PREVIEW_ALLOWED_IPS), not at the row layer.
 *   - the caller is a usage admin
 *
 * Returns `[]` when auth IS configured but there is no session login to match
 * against (e.g. an unauthenticated request that slipped past middleware).
 */
export async function restrictUserRowsToSelf<T extends HasLogin>(
  event: H3Event<EventHandlerRequest>,
  rows: T[],
  opts: RestrictOptions = {}
): Promise<T[]> {
  const inputs = await resolveDecisionInputs(event, opts.isMocked ?? false)
  return filterRowsByDecision(rows, inputs)
}

/**
 * Adapter: extracts the decision inputs from the live Nuxt H3 event. Wrapped
 * in try/catch so unit-test contexts (no Nuxt runtime) fall back to a
 * permissive default — production paths always have Nuxt available.
 */
async function resolveDecisionInputs(
  event: H3Event<EventHandlerRequest>,
  isMocked: boolean
): Promise<RestrictDecisionInputs> {
  if (isMocked) {
    return { isMocked: true, authConfigured: false, isAdmin: false, sessionLogin: null }
  }

  let authConfigured = false
  try {
    const config = useRuntimeConfig(event)
    const pub = config.public as Record<string, unknown>
    authConfigured = !!(
      pub.requireAuth || pub.usingGithubAuth || pub.isPublicApp || pub.authProviders
    )
  } catch {
    // No Nuxt runtime (vitest without env) — treat as PAT-mode (permissive).
    return { isMocked: false, authConfigured: false, isAdmin: false, sessionLogin: null }
  }

  if (!authConfigured) {
    return { isMocked: false, authConfigured: false, isAdmin: false, sessionLogin: null }
  }

  let isAdmin = false
  try {
    isAdmin = await isUsageAdminForEvent(event)
  } catch {
    // Defensive: if the admin probe blows up we MUST NOT default to admin.
    isAdmin = false
  }

  let sessionLogin: string | null = null
  try {
    sessionLogin = await getSessionLoginForFilter(event)
  } catch {
    sessionLogin = null
  }

  return { isMocked: false, authConfigured: true, isAdmin, sessionLogin }
}
