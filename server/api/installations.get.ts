import { listAppInstallations, type AppInstallation } from '../modules/github-app-auth'

/**
 * Returns the list of orgs/accounts the app can access.
 *
 * Public/marketplace app (NUXT_PUBLIC_IS_PUBLIC_APP=true):
 *   - MUST NOT have a private key configured — throws 500 (misconfiguration)
 *   - If user logged in via GitHub OAuth: calls /user/orgs with the user's own token
 *     to auto-populate the org picker with orgs they belong to.
 *     Safe: only shows the logged-in user's own org memberships.
 *   - Falls back to empty list (text input) if no GitHub token is in the session.
 *
 * Private/internal app:
 *   - App JWT lists all installations (small, known set) → dropdown in UI
 *
 * Protected: requires an active session when any auth mode is enabled.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const isAuthRequired = config.public.requireAuth || config.public.usingGithubAuth || config.public.isPublicApp || !!config.public.authProviders

  const session = await getUserSession(event)

  if (isAuthRequired && !session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  setResponseHeaders(event, { 'Cache-Control': 'private, no-store' })

  if (config.public.isPublicApp) {
    // A private key with a public/marketplace app is a misconfiguration: the App JWT
    // can mint tokens for every org that installed it, bypassing per-user access control.
    if (config.githubAppPrivateKey) {
      throw createError({
        statusCode: 500,
        statusMessage:
          'Misconfiguration: NUXT_GITHUB_APP_PRIVATE_KEY must not be set when ' +
          'NUXT_PUBLIC_IS_PUBLIC_APP=true. Remove the private key or disable isPublicApp.'
      })
    }

    // Organizations were resolved during login (onSuccess) and stored in the session.
    // Return them directly — no extra GitHub API call needed.
    const orgs = (session as { organizations?: Array<{ login: string; type: string }> })?.organizations ?? []
    return { installations: orgs }
  }

  // Private/internal app: list all installations via App JWT.
  const appId = config.githubAppId || ''
  if (appId && config.githubAppPrivateKey) {
    try {
      const installations = await listAppInstallations(appId, config.githubAppPrivateKey)
      return { installations: installations.map(i => ({ login: i.login, type: i.type })) }
    } catch {
      // JWT auth failed or network error — fall through to empty list so the UI
      // shows a text input instead of a broken dropdown.
    }
  }

  // No installations available — UI will show a text input.
  return { installations: [] }
})
