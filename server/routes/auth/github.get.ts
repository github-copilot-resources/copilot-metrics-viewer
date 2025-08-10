import type { FetchError } from 'ofetch'

export default defineOAuthGitHubEventHandler({
  config: {
    scope: process.env.NUXT_OAUTH_GITHUB_CLIENT_SCOPE ? process.env.NUXT_OAUTH_GITHUB_CLIENT_SCOPE.split(',') : undefined,
  },
  async onSuccess(event, { user, tokens }) {
    const config = useRuntimeConfig(event);
    const logger = console;

    await setUserSession(event, {
      user: {
        githubId: user.id,
        name: user.name,
        login: user.login,
        avatarUrl: user.avatar_url
      },
      secure: {
        tokens,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000)
      }
    })

    // Check authorization if configured
    if (config.authorizedUsers && config.authorizedUsers.trim() !== '') {
      const { user: sessionUser } = await getUserSession(event)
      
      if (!sessionUser) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Authentication required'
        })
      }

      const username = sessionUser.login || sessionUser.name || sessionUser.githubId?.toString()
      if (!username) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Unable to determine user identity'
        })
      }

      const authorizedUsers = config.authorizedUsers
        .split(',')
        .map(user => user.trim().toLowerCase())
        .filter(user => user.length > 0)

      if (authorizedUsers.length > 0 && !authorizedUsers.includes(username.toLowerCase())) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Access denied. User not authorized to access this application.'
        })
      }
    }

    // need to check if this is public app (no default org/team/ent)
    if (config.public.isPublicApp) {
      try {
        const installationsResponse = await $fetch('https://api.github.com/user/installations', {
          headers: {
            Authorization: `token ${tokens.access_token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }) as { installations: Array<{ account: { login: string } }> };

        const installations = installationsResponse.installations;
        const organizations = installations.map(installation => installation.account.login);

        await setUserSession(event, {
          organizations
        });
        logger.info('User organizations:', organizations);

        if (organizations.length === 0) {
          console.error('No organizations found for the user.');
          return sendRedirect(event, '/?error=No organizations found for the user.');
        }

        return sendRedirect(event, `/orgs/${organizations[0]}`);
      }
      catch (error: unknown) {
        logger.error('Error fetching installations:', error);
      }
    }

    return sendRedirect(event, '/')
  },
  // Optional, will return a json error and 401 status code by default
  onError(event, error) {
    console.error('GitHub OAuth error:', error)
    return sendRedirect(event, '/?error=GitHub authentication failed')
  },
})