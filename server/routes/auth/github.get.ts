export default defineOAuthGitHubEventHandler({
  config: {
    // Default scopes: read:user for profile, read:org for org membership (used by org picker).
    // Override via NUXT_OAUTH_GITHUB_CLIENT_SCOPE (comma-separated) when needed.
    scope: process.env.NUXT_OAUTH_GITHUB_CLIENT_SCOPE
      ? process.env.NUXT_OAUTH_GITHUB_CLIENT_SCOPE.split(',')
      : ['read:user'],
  },
  async onSuccess(event, { user, tokens }) {
    const config = useRuntimeConfig(event);
    const apiBaseUrl = config.githubApiBaseUrl || 'https://api.github.com';

    // Authorize before creating a session
    if (!isUserAuthorized(event, { login: user.login, email: user.email })) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    await setUserSession(event, {
      user: {
        login: user.login,
        githubId: user.id,
        name: user.name,
        avatarUrl: user.avatar_url,
        email: user.email ?? undefined,
      },
      secure: {
        tokens,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000)
      }
    })

    // If a default org/ent is pinned via env var, go straight to the home page.
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    if (defaultOrg) {
      return sendRedirect(event, '/')
    }

    // Public app: enumerate this user's accessible installations using the fresh token.
    // /user/installations is scoped to the specific GitHub App (matched by client ID),
    // so it only returns orgs where THIS app is installed AND the user has access.
    if (config.public.isPublicApp) {
      try {
        const data = await $fetch<{ installations: Array<{ account: { login: string; type: string } }> }>(
          `${apiBaseUrl}/user/installations?per_page=100`,
          {
            headers: {
              Authorization: `token ${tokens.access_token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          }
        )
        const organizations = (data.installations || []).map(i => ({
          login: i.account.login,
          type: i.account.type
        }))

        // Store in session so select-org page can read it without another API call.
        await setUserSession(event, { organizations })

        // Single org: skip the picker, go straight to the dashboard.
        if (organizations.length === 1) {
          return sendRedirect(event, `/orgs/${organizations[0]!.login}`)
        }
      } catch (err) {
        console.error('Error fetching installations:', err)
        // Fall through to /select-org which shows a text input fallback.
      }
    }

    return sendRedirect(event, '/select-org')
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error('GitHub OAuth error:', error)
    return sendRedirect(event, '/')
  },
})