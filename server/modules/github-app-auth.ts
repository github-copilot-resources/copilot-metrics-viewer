import jwt from 'jsonwebtoken'
import type { H3Event, EventHandlerRequest } from 'h3'

interface GitHubAppConfig {
  appId: string
  privateKey: string
  installationId: string
}

// Token expiry constants
const GITHUB_APP_TOKEN_EXPIRY_SECONDS = 3600 // 1 hour
const TOKEN_EXPIRY_BUFFER_SECONDS = 300 // 5 minutes

let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Generate a GitHub App installation access token.
 * 
 * @param config GitHub App configuration
 * @returns Installation access token
 */
async function generateInstallationToken(config: GitHubAppConfig): Promise<string> {
  // Create JWT for GitHub App authentication
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: config.appId,
    iat: now - 10, // 10 seconds in the past to account for clock drift
    exp: now + 600 // 10 minutes from now (max allowed is 10 minutes)
  }

  const privateKey = config.privateKey.replace(/\\n/g, '\n')
  const appToken = jwt.sign(payload, privateKey, { algorithm: 'RS256' })

  // Exchange App token for Installation token
  const response = await $fetch(`https://api.github.com/app/installations/${config.installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${appToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'copilot-metrics-viewer'
    }
  }) as { token: string; expires_at: string }

  return response.token
}

/**
 * Get a valid GitHub App installation token, using cache if available.
 * 
 * @param event H3 event object
 * @returns Installation access token
 */
export async function getGitHubAppToken(event: H3Event<EventHandlerRequest>): Promise<string> {
  const config = useRuntimeConfig(event)
  
  const appConfig: GitHubAppConfig = {
    appId: config.githubAppId,
    privateKey: config.githubAppPrivateKey,
    installationId: config.githubAppInstallationId
  }

  // Validate configuration
  if (!appConfig.appId || !appConfig.privateKey || !appConfig.installationId) {
    throw new Error('GitHub App configuration is incomplete. Please set NUXT_GITHUB_APP_ID, NUXT_GITHUB_APP_PRIVATE_KEY, and NUXT_GITHUB_APP_INSTALLATION_ID environment variables.')
  }

  // Check if we have a cached token that's still valid (with 5 minute buffer)
  const now = Date.now() / 1000
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_EXPIRY_BUFFER_SECONDS) {
    return cachedToken.token
  }

  // Generate new token
  const token = await generateInstallationToken(appConfig)
  
  // Cache the token (GitHub App installation tokens are valid for 1 hour)
  cachedToken = {
    token,
    expiresAt: now + GITHUB_APP_TOKEN_EXPIRY_SECONDS // 1 hour from now
  }

  return token
}

/**
 * Build GitHub API headers using GitHub App authentication.
 * 
 * @param event H3 event object
 * @returns Headers with GitHub App authentication
 */
export async function buildGitHubAppHeaders(event: H3Event<EventHandlerRequest>): Promise<Headers> {
  const token = await getGitHubAppToken(event)
  
  return new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `token ${token}`,
    'User-Agent': 'copilot-metrics-viewer'
  })
}