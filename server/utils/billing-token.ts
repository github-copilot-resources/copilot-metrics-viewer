import type { H3Event } from 'h3'

/**
 * Where the credential for the GitHub billing endpoints came from.
 *
 * - `pat`  — the deployment-wide classic PAT in NUXT_GITHUB_BILLING_TOKEN
 * - `user` — the signed-in user's own GitHub OAuth token (opt-in via
 *            NUXT_BILLING_USE_USER_TOKEN=true). GitHub then enforces the
 *            caller's own billing permissions, so no shared PAT is needed.
 * - `none` — nothing usable; billing stays in preview/placeholder mode
 */
export type BillingTokenSource = 'pat' | 'user' | 'none'

export interface ResolvedBillingToken {
  token: string
  source: BillingTokenSource
}

/** True when NUXT_BILLING_USE_USER_TOKEN is enabled (boolean or "true"). */
export function isUserBillingTokenEnabled(config: Record<string, unknown>): boolean {
  const v = config.billingUseUserToken
  return v === true || String(v).trim().toLowerCase() === 'true'
}

/**
 * Extracts a still-valid GitHub OAuth access token from a session's `secure`
 * payload. Only the GitHub OAuth handler stores `secure.tokens`; sessions from
 * other identity providers return ''.
 *
 * `expires_at` is written as a Date but comes back as an ISO string after the
 * sealed cookie round-trips, so both shapes are accepted. A missing or
 * unparsable expiry is treated as "no expiry" (classic OAuth App tokens
 * without token expiration enabled do not carry one).
 */
export function userTokenFromSecure(secure: unknown, now: number = Date.now()): string {
  if (!secure || typeof secure !== 'object') return ''
  const s = secure as { tokens?: { access_token?: unknown }, expires_at?: unknown }
  const token = typeof s.tokens?.access_token === 'string' ? s.tokens.access_token.trim() : ''
  if (!token) return ''

  if (s.expires_at !== undefined && s.expires_at !== null) {
    const expiresAt = s.expires_at instanceof Date
      ? s.expires_at.getTime()
      : new Date(String(s.expires_at)).getTime()
    // 30s safety margin, same as authenticateAndGetGitHubHeaders.
    if (Number.isFinite(expiresAt) && expiresAt < now + 30 * 1000) return ''
  }
  return token
}

/**
 * Resolves the credential for the GitHub billing endpoints.
 *
 * Priority:
 *   1. NUXT_GITHUB_BILLING_TOKEN (classic PAT) — unchanged default behaviour
 *   2. The signed-in user's GitHub OAuth token, only when
 *      NUXT_BILLING_USE_USER_TOKEN=true. The OAuth app must request the
 *      `manage_billing:enterprise` scope (NUXT_OAUTH_GITHUB_CLIENT_SCOPE),
 *      otherwise GitHub answers 403/404 and the UI shows that error.
 *
 * NUXT_GITHUB_TOKEN is deliberately never used here — see billing-credits.get.ts.
 */
export async function resolveBillingToken(event: H3Event): Promise<ResolvedBillingToken> {
  const config = useRuntimeConfig(event) as Record<string, unknown>
  const pat = ((config.githubBillingToken as string | undefined) || '').trim()
  if (pat) return { token: pat, source: 'pat' }

  if (!isUserBillingTokenEnabled(config)) return { token: '', source: 'none' }

  try {
    const session = await getUserSession(event)
    const token = userTokenFromSecure((session as { secure?: unknown })?.secure)
    if (token) return { token, source: 'user' }
  } catch {
    // No/invalid session → fall through to "none".
  }
  return { token: '', source: 'none' }
}

/** Message for the 503 raised when no billing credential is available. */
export const NO_BILLING_CREDENTIAL_MESSAGE =
  'No billing credential configured — set NUXT_GITHUB_BILLING_TOKEN (classic PAT with manage_billing:enterprise scope; SSO-authorized), ' +
  'or set NUXT_BILLING_USE_USER_TOKEN=true and sign in with GitHub using the manage_billing:enterprise OAuth scope.'
