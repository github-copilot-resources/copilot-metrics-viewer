import { listAppInstallations, type AppInstallation } from '../modules/github-app-auth'

interface GitHubInstallationsResponse {
  installations: Array<{ account: { login: string; type: string } }>
}

/**
 * Returns the list of orgs/accounts the app can access.
 *
 * Public/marketplace app (NUXT_PUBLIC_IS_PUBLIC_APP=true):
 *   - MUST NOT have a private key configured — throws 500 (misconfiguration)
 *   - Uses the user's GitHub OAuth token → /user/installations (user-scoped)
 *   - Returns empty if user did not sign in with GitHub (UI shows text input)
 *
 * Private/internal app:
 *   - App JWT lists all installations (small, known set) → dropdown in UI
 *
 * Protected: requires an active session when requireAuth / usingGithubAuth / isPublicApp is set.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const isAuthRequired = config.public.requireAuth || config.public.usingGithubAuth || config.public.isPublicApp

  const session = await getUserSession(event)

  if (isAuthRequired && !session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  setResponseHeaders(event, { 'Cache-Control': 'private, no-store' })

  if (config.public.isPublicApp) {
    // A private key with a public/marketplace app is a misconfiguration: the App JWT
    // can mint tokens for every org that installed it, bypassing per-user access control.
    // Public apps must rely on the user's own GitHub OAuth token for data access.
    if (config.githubAppPrivateKey) {
      throw createError({
        statusCode: 500,
        statusMessage:
          'Misconfiguration: NUXT_GITHUB_APP_PRIVATE_KEY must not be set when ' +
          'NUXT_PUBLIC_IS_PUBLIC_APP=true. Public apps use the user\'s GitHub OAuth token ' +
          'for data access. Remove the private key or disable isPublicApp.'
      })
    }

    // Use the user's GitHub OAuth token to get their personal installation list.
    const githubToken = (session?.secure as { tokens?: { access_token?: string } } | undefined)
      ?.tokens?.access_token
    if (githubToken) {
      const response = await $fetch<GitHubInstallationsResponse>(
        'https://api.github.com/user/installations',
        {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      )
      return {
        installations: response.installations.map(i => ({
          login: i.account.login,
          type: i.account.type as 'Organization' | 'User'
        }))
      }
    }

    // User did not sign in with GitHub — no way to determine their orgs.
    // UI will show a text input so they can type their org slug.
    return { installations: [] }
  }

  // Private/internal app: list all installations via App JWT.
  const appId = config.githubAppId || config.oauth?.github?.clientId || ''
  if (appId && config.githubAppPrivateKey) {
    const installations = await listAppInstallations(appId, config.githubAppPrivateKey)
    return { installations: installations.map(i => ({ login: i.login, type: i.type })) }
  }

  // GitHub OAuth without App key — session has orgs from login redirect.
  const sessionOrgs: string[] = (session as { organizations?: string[] }).organizations ?? []
  return {
    installations: sessionOrgs.map(login => ({ login, type: 'Organization' as const }))
  }
})
