export default defineOAuthKeycloakEventHandler({
  async onSuccess(event, { user }) {
    const email: string = user.email || ''
    if (!isUserAuthorized(event, { login: user.preferred_username, email })) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    await setUserSession(event, {
      user: {
        login: user.preferred_username || email,
        name: user.name,
        avatarUrl: undefined
      }
    })

    const config = useRuntimeConfig(event)
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    return sendRedirect(event, defaultOrg ? '/' : '/select-org')
  },
  onError(event, error) {
    console.error('Keycloak OAuth error:', error)
    return sendRedirect(event, '/')
  }
})
