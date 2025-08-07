import { requireAuthorization } from '~/server/modules/authorization'

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user, tokens }) {
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

    // Check authorization after setting user session
    await requireAuthorization(event)

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/?error=Google authentication failed')
  },
})