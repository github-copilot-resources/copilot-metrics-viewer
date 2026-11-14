import { emitAuditEvent } from '../../utils/audit'

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

    await emitAuditEvent('auth.login.success', {
      action: 'login',
      outcome: 'allow',
      target: email,
      detail: { provider: 'microsoft' },
    }, event)

    const config = useRuntimeConfig(event)
    const defaultOrg = config.public.githubOrg || config.public.githubEnt
    return sendRedirect(event, defaultOrg ? getAppBaseURL(event) : appURL('/select-org', event))
  },
  onError(event, error) {
    console.error('Microsoft OAuth error:', error)
    return sendRedirect(event, getAppBaseURL(event))
  }
})
