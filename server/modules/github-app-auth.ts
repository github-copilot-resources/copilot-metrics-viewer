import { createPrivateKey, createSign } from 'node:crypto'
import type { H3Event, EventHandlerRequest } from 'h3'

const TOKEN_EXPIRY_BUFFER_SECONDS = 300 // refresh 5 min before expiry
const INSTALLATIONS_CACHE_TTL_SECONDS = 300 // re-list installations every 5 min

export interface AppInstallation {
  id: number
  login: string
  type: 'Organization' | 'User'
}

// Per-installation token cache keyed by installation ID
const tokenCache = new Map<number, { token: string; expiresAt: number }>()
// In-flight token requests to prevent thundering herd per installation
const tokenInflight = new Map<number, Promise<{ token: string; expiresAt: number }>>()

// Cached installation list
let installationsCache: { list: AppInstallation[]; cachedAt: number } | null = null
let installationsInflight: Promise<AppInstallation[]> | null = null

// ── Crypto helpers ─────────────────────────────────────────────────────────────

/** Base64url-encode a buffer. */
function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

/** Normalise a PEM key that may use literal \n instead of real newlines. */
function normalisePem(pem: string): string {
  return pem.replace(/\\n/g, '\n')
}

/**
 * Sign a compact JWT (RS256) using Node's built-in crypto.
 * Handles PKCS#1 ("BEGIN RSA PRIVATE KEY") and PKCS#8 ("BEGIN PRIVATE KEY"),
 * and both real-newline and \n-escaped PEM strings.
 */
function signJWT(payload: Record<string, unknown>, privateKeyPem: string): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  const signingInput = `${header}.${body}`

  const key = createPrivateKey({ key: normalisePem(privateKeyPem), format: 'pem' })
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const sig = sign.sign(key)
  return `${signingInput}.${b64url(sig)}`
}

/** Build a short-lived JWT for GitHub App API calls. */
function buildAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  console.log(`[github-app-auth] Building JWT with App ID ${appId}`)
  try {
    return signJWT({ iss: appId, iat: now - 10, exp: now + 600 }, privateKey)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to sign GitHub App JWT: ${msg}. Check NUXT_GITHUB_APP_PRIVATE_KEY is a valid PEM-encoded RSA private key.`)
  }
}

// ── Installation listing ───────────────────────────────────────────────────────

/**
 * List all orgs/users the GitHub App is installed on.
 * Paginates through all results and caches for INSTALLATIONS_CACHE_TTL_SECONDS.
 */
export async function listAppInstallations(appId: string, privateKey: string): Promise<AppInstallation[]> {
  const now = Math.floor(Date.now() / 1000)
  if (installationsCache && now - installationsCache.cachedAt < INSTALLATIONS_CACHE_TTL_SECONDS) {
    return installationsCache.list
  }

  // Dedupe concurrent calls
  if (installationsInflight) return installationsInflight

  installationsInflight = (async () => {
    try {
      const jwt = await buildAppJwt(appId, privateKey)
      const all: AppInstallation[] = []
      let page = 1

      while (true) {
        const page_items = await $fetch<Array<{ id: number; account: { login: string; type: string } }>>(
          `https://api.github.com/app/installations?per_page=100&page=${page}`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${jwt}`,
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'copilot-metrics-viewer'
            }
          }
        )
        for (const item of page_items) {
          all.push({ id: item.id, login: item.account.login, type: item.account.type as AppInstallation['type'] })
        }
        if (page_items.length < 100) break
        page++
      }

      installationsCache = { list: all, cachedAt: Math.floor(Date.now() / 1000) }
      return all
    } finally {
      installationsInflight = null
    }
  })()

  return installationsInflight
}

// ── Installation token ─────────────────────────────────────────────────────────

async function fetchInstallationToken(jwt: string, installationId: number): Promise<{ token: string; expiresAt: number }> {
  const response = await $fetch<{ token: string; expires_at: string }>(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'copilot-metrics-viewer'
      }
    }
  )
  return { token: response.token, expiresAt: Math.floor(new Date(response.expires_at).getTime() / 1000) }
}

/**
 * Return a valid installation token for the given org.
 * Caches per installation ID and dedupes concurrent refreshes.
 */
async function getTokenForInstallation(appId: string, privateKey: string, installationId: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const cached = tokenCache.get(installationId)
  if (cached && cached.expiresAt > now + TOKEN_EXPIRY_BUFFER_SECONDS) {
    return cached.token
  }

  // Dedupe concurrent refresh for the same installation
  let inflight = tokenInflight.get(installationId)
  if (!inflight) {
    inflight = (async () => {
      const jwt = buildAppJwt(appId, privateKey)
      const result = await fetchInstallationToken(jwt, installationId)
      tokenCache.set(installationId, result)
      tokenInflight.delete(installationId)
      return result
    })()
    tokenInflight.set(installationId, inflight)
  }

  return (await inflight).token
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return a valid GitHub App installation token for the org/enterprise in the request.
 *
 * Org resolution order:
 *   1. githubOrg query param  2. githubEnt query param
 *   3. NUXT_PUBLIC_GITHUB_ORG config  4. NUXT_PUBLIC_GITHUB_ENT config
 *   5. Single installation auto-select
 */
export async function getGitHubAppToken(event: H3Event<EventHandlerRequest>): Promise<string> {
  const config = useRuntimeConfig(event)
  const { githubAppPrivateKey } = config
  // Accept numeric App ID (NUXT_GITHUB_APP_ID) or OAuth Client ID (NUXT_OAUTH_GITHUB_CLIENT_ID) as the JWT issuer
  const githubAppId = config.githubAppId || config.oauth?.github?.clientId

  if (!githubAppId || !githubAppPrivateKey) {
    throw new Error('GitHub App configuration incomplete. Set NUXT_GITHUB_APP_PRIVATE_KEY and NUXT_GITHUB_APP_ID (or NUXT_OAUTH_GITHUB_CLIENT_ID).')
  }

  const query = getQuery(event)
  const targetOrg = (query.githubOrg || query.githubEnt || config.public.githubOrg || config.public.githubEnt) as string | undefined

  const installations = await listAppInstallations(githubAppId, githubAppPrivateKey)

  let installation: AppInstallation | undefined
  if (targetOrg) {
    installation = installations.find(i => i.login.toLowerCase() === targetOrg.toLowerCase())
    if (!installation) {
      throw new Error(`GitHub App is not installed on org/enterprise "${targetOrg}". Available: ${installations.map(i => i.login).join(', ')}`)
    }
  } else if (installations.length === 1) {
    installation = installations[0]
  } else if (installations.length === 0) {
    throw new Error('GitHub App has no installations. Install the App on your org first.')
  } else {
    throw new Error('Multiple GitHub App installations found. Set NUXT_PUBLIC_GITHUB_ORG or navigate to a specific org URL.')
  }

  return getTokenForInstallation(githubAppId, githubAppPrivateKey, installation.id)
}

export async function buildGitHubAppHeaders(event: H3Event<EventHandlerRequest>): Promise<Headers> {
  const token = await getGitHubAppToken(event)
  return new Headers({
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `token ${token}`
  })
}
