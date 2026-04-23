import { webcrypto } from 'node:crypto'
import type { H3Event, EventHandlerRequest } from 'h3'

const TOKEN_EXPIRY_BUFFER_SECONDS = 300 // refresh 5 min before expiry

let cachedToken: { token: string; expiresAt: number } | null = null

/** Convert a PEM private key string to a DER ArrayBuffer for Web Crypto. */
function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s/g, '')
  const binary = Buffer.from(base64, 'base64')
  return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength)
}

/** Base64url-encode a buffer. */
function b64url(buf: ArrayBuffer | Buffer): string {
  return Buffer.from(buf).toString('base64url')
}

/**
 * Sign a compact JWT (RS256) using Node's built-in Web Crypto.
 * No external dependencies required.
 */
async function signJWT(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  const signingInput = `${header}.${body}`

  // Normalise PKCS#1 RSA key to PKCS#8 if needed (GitHub App keys are PKCS#1)
  const isPkcs1 = privateKeyPem.includes('BEGIN RSA PRIVATE KEY')
  const pkcs8Pem = isPkcs1
    ? privateKeyPem
        .replace('BEGIN RSA PRIVATE KEY', 'BEGIN PRIVATE KEY')
        .replace('END RSA PRIVATE KEY', 'END PRIVATE KEY')
    : privateKeyPem

  const keyData = pemToDer(pkcs8Pem.replace(/\\n/g, '\n'))
  const key = await webcrypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await webcrypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    Buffer.from(signingInput)
  )

  return `${signingInput}.${b64url(sig)}`
}

/**
 * Exchange a GitHub App JWT for an installation access token.
 * The result is cached for up to 1 hour (with a 5-minute refresh buffer).
 */
async function generateInstallationToken(appId: string, privateKey: string, installationId: string): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000)
  const jwt = await signJWT(
    { iss: appId, iat: now - 10, exp: now + 600 },
    privateKey
  )

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

  const expiresAt = Math.floor(new Date(response.expires_at).getTime() / 1000)
  return { token: response.token, expiresAt }
}

/**
 * Return a valid GitHub App installation token, using the in-memory cache
 * to avoid generating a new JWT on every request.
 */
export async function getGitHubAppToken(event: H3Event<EventHandlerRequest>): Promise<string> {
  const config = useRuntimeConfig(event)
  const { githubAppId, githubAppPrivateKey, githubAppInstallationId } = config

  if (!githubAppId || !githubAppPrivateKey || !githubAppInstallationId) {
    throw new Error(
      'GitHub App configuration incomplete. Set NUXT_GITHUB_APP_ID, NUXT_GITHUB_APP_PRIVATE_KEY, and NUXT_GITHUB_APP_INSTALLATION_ID.'
    )
  }

  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_EXPIRY_BUFFER_SECONDS) {
    return cachedToken.token
  }

  cachedToken = await generateInstallationToken(githubAppId, githubAppPrivateKey, githubAppInstallationId)
  return cachedToken.token
}

export async function buildGitHubAppHeaders(event: H3Event<EventHandlerRequest>): Promise<Headers> {
  const token = await getGitHubAppToken(event)
  return new Headers({
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `token ${token}`
  })
}
