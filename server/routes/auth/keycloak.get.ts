import { emitAuditEvent } from '../../utils/audit'

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
        avatarUrl: ''
      }
    })

    await emitAuditEvent('auth.login.success', {
      action: 'login',
      outcome: 'allow',
      target: user.preferred_username || email,
      detail: { provider: 'keycloak' },
    }, event)

    const config = useRuntimeConfig(event)
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    return sendRedirect(event, defaultOrg ? getAppBaseURL(event) : appURL('/select-org', event))
  },
  onError(event, error) {
    console.error('Keycloak OAuth error:', error)
    return sendRedirect(event, getAppBaseURL(event))
  }
})
