export default defineOAuthMicrosoftEventHandler({
  async onSuccess(event, { user }) {
    const email: string = user.mail || user.userPrincipalName || ''
    if (!isUserAuthorized(event, { email })) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    await setUserSession(event, {
      user: {
        login: email,
        name: user.displayName,
        avatarUrl: ''
      }
    })

    const config = useRuntimeConfig(event)
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    return sendRedirect(event, defaultOrg ? '/' : '/select-org')
  },
  onError(event, error) {
    console.error('Microsoft OAuth error:', error)
    return sendRedirect(event, '/')
  }
})
