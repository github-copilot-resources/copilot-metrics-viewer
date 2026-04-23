import { listAppInstallations, type AppInstallation } from '../modules/github-app-auth'

interface GitHubInstallationsResponse {
  installations: Array<{ account: { login: string; type: string } }>
}

/**
 * Returns the list of orgs/accounts the app can access, filtered to what the
 * current user is allowed to see.
 *
 * Priority order:
 *   1. GitHub OAuth session token → call /user/installations (user-filtered)
 *   2. session.organizations (pre-populated at GitHub login)
 *   3. App JWT → list ALL installations (fallback for non-GitHub OAuth users)
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

  // Priority 1: User has a GitHub OAuth token — fetch only their accessible installations.
  // This is the correct path for marketplace/public apps so users only see their own orgs.
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
      const installations: Array<Pick<AppInstallation, 'login' | 'type'>> =
        response.installations.map(i => ({
          login: i.account.login,
          type: i.account.type as 'Organization' | 'User'
        }))
      return { installations }
    } catch {
      // Fall through to next strategy
    }
  }

  // Priority 2: Organizations pre-populated in session at login (GitHub OAuth path).
  const sessionOrgs: string[] = (session as { organizations?: string[] }).organizations ?? []
  if (sessionOrgs.length > 0) {
    return {
      installations: sessionOrgs.map(login => ({ login, type: 'Organization' as const }))
    }
  }

  // Priority 3: App JWT — lists ALL installations.
  // Used for non-GitHub OAuth users (Google, Microsoft, etc.) or unauthenticated mode.
  // Admins should set NUXT_PUBLIC_GITHUB_ORG to restrict to a single org in this case.
  const appId = config.githubAppId || config.oauth?.github?.clientId || ''
  if (appId && config.githubAppPrivateKey) {
    const installations = await listAppInstallations(appId, config.githubAppPrivateKey)
    return { installations: installations.map(i => ({ login: i.login, type: i.type })) }
  }

  return { installations: [] }
})
