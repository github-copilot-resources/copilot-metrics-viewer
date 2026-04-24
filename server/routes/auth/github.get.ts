export default defineOAuthGitHubEventHandler({
  config: {
    // Default to read:user so the authorize URL is never built with an empty scope= param (GitHub returns 404).
    // Override via NUXT_OAUTH_GITHUB_CLIENT_SCOPE (comma-separated) when additional scopes are needed.
    scope: process.env.NUXT_OAUTH_GITHUB_CLIENT_SCOPE
      ? process.env.NUXT_OAUTH_GITHUB_CLIENT_SCOPE.split(',')
      : ['read:user'],
  },
  async onSuccess(event, { user, tokens }) {
    const config = useRuntimeConfig(event);

    // Authorize before creating a session
    if (!isUserAuthorized(event, { login: user.login, email: user.email })) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    await setUserSession(event, {
      user: {
        login: user.login,
        githubId: user.id,
        name: user.name,
        avatarUrl: user.avatar_url
      },
      secure: {
        tokens,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000)
      }
    })

    // If a default org/ent is pinned via env var, go straight to the home page.
    // Otherwise go to the org picker — /api/installations will use the App JWT (private app)
    // or the user's token (public app) to build the correct list, regardless of whether the
    // logged-in GitHub user is personally a member of the org.
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    return sendRedirect(event, defaultOrg ? '/' : '/select-org')
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error('GitHub OAuth error:', error)
    return sendRedirect(event, '/')
  },
})