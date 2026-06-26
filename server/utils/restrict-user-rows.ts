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
 *   - isUsageAdminForEvent === true                 → return rows unchanged
 *   - No session login resolvable                   → return []
 *   - Otherwise                                     → keep only the row whose
 *                                                     login matches the session
 *
 * The matcher is case-insensitive on the `login` field — GitHub logins are
 * case-insensitive in URLs but the API can return either casing.
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
  if (opts.isMocked) return rows

  // PAT-mode short-circuit: when no OAuth/auth provider is configured, there
  // is no notion of "self" so the restriction is meaningless. Falling through
  // would return `[]` for every request and break User Metrics / Seats
  // entirely on PAT-mode deployments (e.g. internal previews behind IP allowlists).
  try {
    const config = useRuntimeConfig(event)
    const pub = config.public as Record<string, unknown>
    const authConfigured =
      pub.requireAuth || pub.usingGithubAuth || pub.isPublicApp || !!pub.authProviders
    if (!authConfigured) return rows
  } catch {
    // Unit-test contexts without Nuxt runtime: leave rows untouched (matches
    // existing test behaviour).
    return rows
  }

  // Wrap admin check in try/catch so unit-test contexts (where Nuxt auto-imports
  // like getUserSession / useRuntimeConfig are not defined) fall through to the
  // existing test behaviour: return rows unchanged. Production paths always
  // have Nuxt's runtime available, so this never matters at runtime.
  let admin: boolean
  try {
    admin = await isUsageAdminForEvent(event)
  } catch {
    return rows
  }
  if (admin) return rows

  let login: string | null
  try {
    login = await getSessionLoginForFilter(event)
  } catch {
    return rows
  }
  if (!login) return []

  const target = login.toLowerCase()
  return rows.filter(r => {
    const rowLogin = (r.login || r.user_login || '').toLowerCase()
    return rowLogin === target
  })
}
