export default defineOAuthAuth0EventHandler({
  async onSuccess(event, { user }) {
    const email: string = user.email || ''
    if (!isUserAuthorized(event, { login: user.nickname, email })) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    await setUserSession(event, {
      user: {
        login: user.nickname || email,
        name: user.name,
        avatarUrl: user.picture
      }
    })

    const config = useRuntimeConfig(event)
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    return sendRedirect(event, defaultOrg ? '/' : '/select-org')
  },
  onError(event, error) {
    console.error('Auth0 OAuth error:', error)
    return sendRedirect(event, '/')
  }
})
