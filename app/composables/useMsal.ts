import type { AccountInfo } from '@azure/msal-browser'

const SCOPES = ['User.Read', 'User.ReadBasic.All']

export interface MsalState {
  isConfigured: true
  isSignedIn: import('vue').ComputedRef<boolean>
  activeAccount: import('vue').Ref<AccountInfo | null>
  error: import('vue').Ref<string | null>
  signIn: () => Promise<boolean>
  acquireTokenSilent: () => Promise<string | null>
  signOut: () => Promise<void>
}

export interface MsalUnconfigured {
  isConfigured: false
  isSignedIn: import('vue').ComputedRef<false>
  activeAccount: import('vue').Ref<null>
  error: import('vue').Ref<null>
  signIn: () => Promise<false>
  acquireTokenSilent: () => Promise<null>
  signOut: () => Promise<void>
}

export function useMsal(): MsalState | MsalUnconfigured {
  if (import.meta.server) {
    // Return stub during SSR — MSAL is browser-only
    return {
      isConfigured: false,
      isSignedIn: computed(() => false as const),
      activeAccount: ref(null),
      error: ref(null),
      signIn: () => Promise.resolve(false as const),
      acquireTokenSilent: () => Promise.resolve(null),
      signOut: () => Promise.resolve(),
    }
  }

  const nuxtApp = useNuxtApp()
  const $msal = nuxtApp.$msal as ReturnType<typeof useNuxtApp>['$msal']

  if (!$msal) {
    return {
      isConfigured: false,
      isSignedIn: computed(() => false as const),
      activeAccount: ref(null),
      error: ref(null),
      signIn: () => Promise.resolve(false as const),
      acquireTokenSilent: () => Promise.resolve(null),
      signOut: () => Promise.resolve(),
    }
  }

  const { instance, activeAccount, error } = $msal as {
    instance: import('@azure/msal-browser').PublicClientApplication
    activeAccount: import('vue').Ref<AccountInfo | null>
    error: import('vue').Ref<string | null>
  }

  const isSignedIn = computed(() => activeAccount.value !== null)

  async function signIn(): Promise<boolean> {
    error.value = null
    try {
      const result = await instance.loginPopup({
        scopes: SCOPES,
        redirectUri: `${window.location.origin}/api/msal/callback`,
      })
      activeAccount.value = result.account
      return true
    } catch (err: unknown) {
      const e = err as { errorCode?: string; message?: string }
      if (e?.errorCode === 'user_cancelled' || e?.errorCode === 'access_denied') {
        error.value = 'Sign-in was cancelled'
      } else if (e?.message?.includes('consent_required') || e?.message?.includes('interaction_required')) {
        error.value = 'Admin consent required. Ask your Azure admin to grant User.ReadBasic.All for this app.'
      } else if (e?.errorCode === 'popup_window_error') {
        error.value = 'Pop-up was blocked. Allow pop-ups for this site and try again.'
      } else {
        error.value = 'Sign-in failed. Please try again.'
      }
      return false
    }
  }

  async function acquireTokenSilent(): Promise<string | null> {
    if (!activeAccount.value) return null
    try {
      const result = await instance.acquireTokenSilent({
        scopes: SCOPES,
        account: activeAccount.value,
      })
      return result.accessToken
    } catch {
      // Silent acquisition failed — session likely expired
      activeAccount.value = null
      error.value = 'Session expired. Please sign in again.'
      return null
    }
  }

  async function signOut(): Promise<void> {
    if (!activeAccount.value) return
    await instance.logoutPopup({ account: activeAccount.value, postLogoutRedirectUri: `${window.location.origin}/api/msal/callback` }).catch(() => null)
    activeAccount.value = null
    error.value = null
  }

  return {
    isConfigured: true,
    isSignedIn,
    activeAccount,
    error,
    signIn,
    acquireTokenSilent,
    signOut,
  }
}
