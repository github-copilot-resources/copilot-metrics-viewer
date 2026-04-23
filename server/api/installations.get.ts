import { listAppInstallations, type AppInstallation } from '../modules/github-app-auth'

interface GitHubInstallationsResponse {
  installations: Array<{ account: { login: string; type: string } }>
}

/**
 * Returns the list of orgs/accounts the app can access.
 *
 * Private/internal app (NUXT_PUBLIC_IS_PUBLIC_APP not set):
 *   - App JWT lists all installations (small, known set) → dropdown in UI
 *
 * Public/marketplace app (NUXT_PUBLIC_IS_PUBLIC_APP=true):
 *   - App JWT would list ALL marketplace installs — not useful for individual users
 *   - Returns empty so the UI shows a text input instead
 *   - Exception: GitHub OAuth session token → /user/installations (user-filtered)
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
    // For marketplace apps, only return installations if the user logged in via GitHub OAuth,
    // because /user/installations scopes results to what they personally have access to.
    // Without a GitHub identity (e.g. Google login), we can't know their orgs — return empty
    // so the UI shows a manual text input.
    const githubToken = (session?.secure as { tokens?: { access_token?: string } } | undefined)
      ?.tokens?.access_token
    if (githubToken) {
      try {
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
      } catch {
        // Fall through — return empty, UI will show text input
      }
    }

    // No GitHub token → can't determine user's orgs; UI will show a text input
    return { installations: [] }
  }

  // Private/internal app: list all installations via App JWT.
  const appId = config.githubAppId || config.oauth?.github?.clientId || ''
  if (appId && config.githubAppPrivateKey) {
    const installations = await listAppInstallations(appId, config.githubAppPrivateKey)
    return { installations: installations.map(i => ({ login: i.login, type: i.type })) }
  }

  // GitHub OAuth without App key — use orgs stored in session at login.
  const sessionOrgs: string[] = (session as { organizations?: string[] }).organizations ?? []
  return {
    installations: sessionOrgs.map(login => ({ login, type: 'Organization' as const }))
  }
})
