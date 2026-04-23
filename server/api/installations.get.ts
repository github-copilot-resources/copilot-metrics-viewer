import { listAppInstallations, type AppInstallation } from '../modules/github-app-auth'

interface GitHubInstallationsResponse {
  installations: Array<{ account: { login: string; type: string } }>
}

/**
 * Returns the list of orgs/accounts the app can access, filtered to what the
 * current user is allowed to see.
 *
 * For public/marketplace apps (NUXT_PUBLIC_IS_PUBLIC_APP=true):
 *   1. GitHub OAuth session token → call /user/installations (user-filtered)
 *   2. session.organizations (pre-populated at GitHub login)
 *
 * For private/internal apps:
 *   - App JWT → list ALL installations (typically just 1–2 orgs)
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

  // Public/marketplace apps: filter to the authenticated user's accessible installations.
  // Without this, listing via App JWT would return every org that installed the app.
  if (config.public.isPublicApp) {
    // Priority 1: GitHub OAuth token in session — call /user/installations for a live, user-scoped list.
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
        // Fall through to session cache
      }
    }

    // Priority 2: Organizations pre-populated in session at GitHub login.
    const sessionOrgs: string[] = (session as { organizations?: string[] }).organizations ?? []
    return {
      installations: sessionOrgs.map(login => ({ login, type: 'Organization' as const }))
    }
  }

  // Private/internal app: list all installations via App JWT (small, known set).
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
