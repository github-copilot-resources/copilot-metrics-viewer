import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const clientId = config.public.entraClientId as string

  if (!clientId) {
    return { provide: { msal: null } }
  }

  const tenantId = (config.public.entraTenantId as string) || 'common'

  const instance = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    cache: { cacheLocation: 'sessionStorage' },
  })

  await instance.initialize()

  // Handle redirect responses (in case popup is not supported and redirect is used)
  await instance.handleRedirectPromise().catch(() => null)

  // Restore existing account from MSAL cache
  const accounts = instance.getAllAccounts()

  return {
    provide: {
      msal: {
        instance,
        activeAccount: ref<AccountInfo | null>(accounts[0] ?? null),
        error: ref<string | null>(null),
      },
    },
  }
})
