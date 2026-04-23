export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    if (!isUserAuthorized(event, { email: user.email })) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    await setUserSession(event, {
      user: {
        login: user.email,
        name: user.name,
        avatarUrl: user.picture
      }
    })

    // If no default org is configured, let the user pick via the org picker
    const config = useRuntimeConfig(event)
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    if (!defaultOrg) {
      return sendRedirect(event, '/select-org')
    }

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/')
  }
})
