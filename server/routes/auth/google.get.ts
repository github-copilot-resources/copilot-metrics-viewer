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

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/')
  }
})
