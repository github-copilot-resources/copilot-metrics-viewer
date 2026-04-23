import type FetchError from 'ofetch';

export default defineOAuthGitHubEventHandler({
  config: {
    scope: process.env.NUXT_OAUTH_GITHUB_CLIENT_SCOPE ? process.env.NUXT_OAUTH_GITHUB_CLIENT_SCOPE.split(',') : undefined,
  },
  async onSuccess(event, { user, tokens }) {
    const config = useRuntimeConfig(event);
    const logger = console;

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

    // Decide where to redirect. When no default org is configured, call /user/installations
    // to find which orgs the user can access and redirect accordingly.
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    if (!defaultOrg) {
      try {
        const installationsResponse = await $fetch('https://api.github.com/user/installations', {
          headers: {
            Authorization: `token ${tokens.access_token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }) as { installations: Array<{ account: { login: string } }> }

        const organizations = installationsResponse.installations.map(i => i.account.login)

        if (organizations.length === 0) {
          return sendRedirect(event, '/?error=No+organizations+found.+Install+the+GitHub+App+on+your+org+first.')
        }
        if (organizations.length === 1) {
          return sendRedirect(event, `/orgs/${organizations[0]}`)
        }
        return sendRedirect(event, '/select-org')
      } catch (error: FetchError) {
        logger.error('Error fetching installations:', error)
      }
    }

    return sendRedirect(event, '/')
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error('GitHub OAuth error:', error)
    return sendRedirect(event, '/')
  },
})