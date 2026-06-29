/**
 * Startup self-check for auth misconfiguration that could silently disable
 * issue-#398 user-data restriction.
 *
 * `restrictUserRowsToSelf` and `isUsageAdminForEvent` short-circuit to a
 * permissive PAT-mode when none of the public auth flags is set. If an
 * operator wires up OAuth credentials but forgets to set
 * NUXT_PUBLIC_USING_GITHUB_AUTH (or similar) the deployment will treat every
 * caller as admin and return every user's row — a silent GDPR regression.
 *
 * This plugin logs a loud warning at boot when that combination is detected.
 * It does NOT throw — operators may have legitimate reasons (e.g. an OAuth
 * app provisioned but the dashboard intentionally running in PAT-mode for a
 * migration window).
 */

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const pub = (config.public ?? {}) as Record<string, unknown>

  const authConfigured = !!(
    pub.requireAuth || pub.usingGithubAuth || pub.isPublicApp || pub.authProviders
  )

  // OAuth credentials may live under config.oauth.github.* (nuxt-auth-utils
  // convention) or be picked up directly from NUXT_OAUTH_GITHUB_* env vars.
  const oauthSection = (config as Record<string, unknown>).oauth as
    | Record<string, { clientId?: string; clientSecret?: string }>
    | undefined
  const githubOauth = oauthSection?.github
  const oauthLooksConfigured = !!(githubOauth?.clientId || githubOauth?.clientSecret
    || process.env.NUXT_OAUTH_GITHUB_CLIENT_ID
    || process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET)

  if (oauthLooksConfigured && !authConfigured) {
    console.warn(
      '[auth-config-check] OAuth credentials appear to be configured ' +
      '(NUXT_OAUTH_GITHUB_CLIENT_ID/SECRET) but none of ' +
      'NUXT_PUBLIC_USING_GITHUB_AUTH / NUXT_PUBLIC_REQUIRE_AUTH / ' +
      'NUXT_PUBLIC_IS_PUBLIC_APP / NUXT_PUBLIC_AUTH_PROVIDERS is set. ' +
      'The deployment will run in PAT-mode: NUXT_USAGE_ADMINS gating is ' +
      'BYPASSED and every caller will be treated as admin. If this is ' +
      'intentional (single-tenant deployment), ignore this warning. ' +
      'Otherwise set NUXT_PUBLIC_USING_GITHUB_AUTH=true to enable the ' +
      'issue-#398 user-data restriction.'
    )
  }
})
