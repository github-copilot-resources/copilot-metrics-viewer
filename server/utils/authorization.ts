/**
 * Shared user authorization for OAuth handlers.
 *
 * Checks the authenticated user against two optional env-var-based allowlists
 * before a session is created. When neither list is set, all authenticated users
 * are allowed (i.e., provider-level restrictions — Microsoft tenant, etc. — are
 * the only gate).
 *
 * Env vars (set in .env or container environment):
 *  - NUXT_AUTHORIZED_USERS         comma-separated GitHub logins or email addresses
 *  - NUXT_AUTHORIZED_EMAIL_DOMAINS comma-separated domains, e.g. "company.com,corp.org"
 */

export interface AuthorizedIdentity {
  /** GitHub login or generic username (lowercase for comparison) */
  login?: string
  /** Email address (lowercase for comparison) */
  email?: string
}

/**
 * Pure authorization check — accepts explicit allowlist strings so it can be
 * tested without mocking Nuxt runtime config.
 *
 * @param identity    The authenticated user's login and/or email
 * @param authorizedUsers         Comma-separated login/email allowlist (empty = no restriction)
 * @param authorizedEmailDomains  Comma-separated domain allowlist (empty = no restriction)
 */
export function checkAuthorization(
  identity: AuthorizedIdentity,
  authorizedUsers: string,
  authorizedEmailDomains: string
): boolean {
  // When both lists are empty → open to all authenticated users
  if (!authorizedUsers && !authorizedEmailDomains) {
    return true
  }

  const login = identity.login?.toLowerCase()
  const email = identity.email?.toLowerCase()

  // Check explicit user/email list
  if (authorizedUsers) {
    const allowed = authorizedUsers
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    if ((login && allowed.includes(login)) || (email && allowed.includes(email))) {
      return true
    }
  }

  // Check email domain allowlist
  if (authorizedEmailDomains && email) {
    const domains = authorizedEmailDomains
      .split(',')
      .map(s => s.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean)
    if (domains.some(d => email.endsWith(`@${d}`))) {
      return true
    }
  }

  return false
}

/**
 * Returns true when the identity is allowed to access the application.
 * Reads allowlists from Nuxt runtime config (NUXT_AUTHORIZED_USERS and
 * NUXT_AUTHORIZED_EMAIL_DOMAINS env vars).
 *
 * Call this in every OAuth handler's `onSuccess` callback **before** calling
 * `setUserSession`, so unauthorized users never receive a session cookie.
 */
export function isUserAuthorized(
  event: Parameters<typeof useRuntimeConfig>[0],
  identity: AuthorizedIdentity
): boolean {
  const config = useRuntimeConfig(event)
  const authorizedUsers = (config.authorizedUsers as string | undefined) ?? ''
  const authorizedEmailDomains = (config.authorizedEmailDomains as string | undefined) ?? ''
  return checkAuthorization(identity, authorizedUsers, authorizedEmailDomains)
}
