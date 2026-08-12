import { emitAuditEvent } from '../../utils/audit'

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

    await emitAuditEvent('auth.login.success', {
      action: 'login',
      outcome: 'allow',
      target: user.nickname || email,
      detail: { provider: 'auth0' },
    }, event)

    const config = useRuntimeConfig(event)
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    return sendRedirect(event, defaultOrg ? getAppBaseURL(event) : appURL('/select-org', event))
  },
  onError(event, error) {
    console.error('Auth0 OAuth error:', error)
    return sendRedirect(event, getAppBaseURL(event))
  }
})
