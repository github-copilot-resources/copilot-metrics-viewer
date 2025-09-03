export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user, tokens }) {
    const config = useRuntimeConfig(event)
    
    await setUserSession(event, {
      user: {
        googleId: user.sub,
        name: user.name,
        email: user.email,
        avatarUrl: user.picture
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

      const username = sessionUser.login || sessionUser.name || sessionUser.email || sessionUser.googleId?.toString()
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

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/?error=Google authentication failed')
  },
})