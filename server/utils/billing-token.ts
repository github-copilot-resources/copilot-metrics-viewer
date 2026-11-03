import type { H3Event } from 'h3'
import { createHash } from 'node:crypto'
import { buildBillingApiUrl } from './billing-url'

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

/**
 * True when the deployment has a billing mechanism at all: a billing PAT, or
 * the per-user token mode. Independent of the current caller.
 */
export function isBillingConfigured(config: Record<string, unknown>): boolean {
  const pat = ((config.githubBillingToken as string | undefined) || '').trim()
  return !!pat || isUserBillingTokenEnabled(config)
}

/** HTTP statuses GitHub returns when the caller lacks billing access. */
export const BILLING_DENIED_STATUSES: ReadonlySet<number> = new Set([401, 403, 404])

const PROBE_TTL_MS = 10 * 60 * 1000
const probeCache = new Map<string, { ok: boolean, at: number }>()

/** Test hook: forget cached probe results. */
export function clearBillingProbeCache(): void {
  probeCache.clear()
}

function normalizeScope(scope: unknown): string {
  const s = String(scope || '')
  if (s === 'team-enterprise') return 'enterprise'
  if (s === 'team-organization') return 'organization'
  return s
}

/**
 * Asks GitHub whether `token` may read the configured billing endpoint
 * (current month). 2xx → true; 401/403/404 → false. Both outcomes are cached
 * for 10 minutes per token (keyed by SHA-256, the token itself is not kept).
 * Other failures (network, 5xx, misconfiguration) return false without
 * caching, so a transient GitHub outage does not pin the tab hidden.
 */
export async function probeUserBillingAccess(
  event: H3Event,
  token: string,
  now: number = Date.now(),
): Promise<boolean> {
  const key = createHash('sha256').update(token).digest('hex')
  const hit = probeCache.get(key)
  if (hit && now - hit.at < PROBE_TTL_MS) return hit.ok

  const config = useRuntimeConfig(event) as Record<string, unknown> & {
    public?: Record<string, unknown>
  }
  let url: string
  try {
    url = buildBillingApiUrl({
      baseUrl: (config.githubApiBaseUrl as string | undefined) || 'https://api.github.com',
      scope: normalizeScope(config.public?.scope),
      githubOrg: (config.public?.githubOrg as string | undefined) || '',
      githubEnt: (config.public?.githubEnt as string | undefined) || '',
      billingEnterprise: ((config.billingEnterprise as string | undefined) || '').trim(),
    })
  } catch {
    return false
  }
  const d = new Date(now)
  url += `?year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}`

  try {
    await $fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
    })
    probeCache.set(key, { ok: true, at: now })
    return true
  } catch (error: unknown) {
    const status = (error as { statusCode?: number, status?: number })?.statusCode
      ?? (error as { status?: number })?.status
      ?? 0
    if (BILLING_DENIED_STATUSES.has(status)) {
      probeCache.set(key, { ok: false, at: now })
    }
    return false
  }
}

/**
 * Billing state for the current caller:
 * - `configured` — the deployment has a billing mechanism (see isBillingConfigured)
 * - `access`     — this caller will actually get billing data:
 *                  PAT → always; user-token mode → GitHub confirms the caller's
 *                  own token can read billing; otherwise false.
 */
export async function resolveBillingAccess(event: H3Event): Promise<{ configured: boolean, access: boolean }> {
  const config = useRuntimeConfig(event) as Record<string, unknown>
  const configured = isBillingConfigured(config)
  if (!configured) return { configured, access: false }

  const { token, source } = await resolveBillingToken(event)
  if (source === 'pat') return { configured, access: true }
  if (source === 'user') return { configured, access: await probeUserBillingAccess(event, token) }
  return { configured, access: false }
}

/** Message for the 503 raised when no billing credential is available. */
export const NO_BILLING_CREDENTIAL_MESSAGE =
  'No billing credential configured — set NUXT_GITHUB_BILLING_TOKEN (classic PAT with manage_billing:enterprise scope; SSO-authorized), ' +
  'or set NUXT_BILLING_USE_USER_TOKEN=true and sign in with GitHub using the manage_billing:enterprise OAuth scope.'
