import { requireAuthorization } from '~/server/modules/authorization'

export default defineOAuthMicrosoftEventHandler({
  async onSuccess(event, { user, tokens }) {
    await setUserSession(event, {
      user: {
        microsoftId: user.id,
        name: user.displayName,
        email: user.mail || user.userPrincipalName,
        avatarUrl: user.photo
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
    console.error('Microsoft OAuth error:', error)
    return sendRedirect(event, '/?error=Microsoft authentication failed')
  },
})