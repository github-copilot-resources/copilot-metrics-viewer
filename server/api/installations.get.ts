import { listAppInstallations, type AppInstallation } from '../modules/github-app-auth'

/**
 * Returns the list of orgs/accounts the app can access.
 *
 * - Private App (NUXT_GITHUB_APP_ID + private key): lists via GitHub App JWT
 * - Public App / GitHub OAuth (isPublicApp): reads from user session (set at login)
 *
 * Protected: requires an active session when requireAuth / usingGithubAuth / isPublicApp is set.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const isAuthRequired = config.public.requireAuth || config.public.usingGithubAuth || config.public.isPublicApp

  if (isAuthRequired) {
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  setResponseHeaders(event, { 'Cache-Control': 'private, no-store' })

  // Flow 2: GitHub App private key — list via App JWT
  if (config.githubAppId && config.githubAppPrivateKey) {
    const installations = await listAppInstallations(config.githubAppId, config.githubAppPrivateKey)
    return { installations: installations.map(i => ({ login: i.login, type: i.type })) }
  }

  // Flow 1: Public App / GitHub OAuth — organizations stored in session at login
  const session = await getUserSession(event)
  const orgs: string[] = (session as { organizations?: string[] }).organizations ?? []
  const installations: Array<Pick<AppInstallation, 'login' | 'type'>> =
    orgs.map(login => ({ login, type: 'Organization' as const }))
  return { installations }
})
