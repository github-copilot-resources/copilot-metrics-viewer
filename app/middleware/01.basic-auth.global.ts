/**
 * Basic Authentication Middleware
 * 
 * This global middleware runs before all pages and implements HTTP Basic Authentication
 * when enabled via environment variables. It provides an additional layer of security
 * for the application before users reach the GitHub authentication flow.
 * 
 * Features:
 * - Conditional activation based on environment configuration
 * - Standard HTTP Basic Authentication with browser dialog
 * - Secure credential validation
 * - SEO-friendly (401 status for unauthorized access)
 * 
 * Security Notes:
 * - Uses secure server-side credential validation
 * - Credentials are stored securely in Azure Key Vault
 * - Basic Auth works over HTTPS (required in production)
 * - This is a simple access control layer, not a replacement for proper authentication
 */

export default defineNuxtRouteMiddleware(async (_to, _from) => {
  const config = useRuntimeConfig()
  
  console.log('Basic auth middleware running:', {
    basicAuthEnabled: config.public.basicAuthEnabled,
    hasUsername: !!config.basicAuthUsername,
    hasPassword: !!config.basicAuthPassword
  })
  
  // Only apply basic auth if enabled
  if (!config.public.basicAuthEnabled) {
    console.log('Basic auth not enabled, skipping middleware')
    return
  }

  console.log('Basic auth enabled, checking authentication...')

  // Only run on client side
  if (import.meta.server) return

  // Check if we already have valid basic auth in session storage (client-side cache)
  const hasValidClientAuth = import.meta.client && sessionStorage.getItem('basicAuthValid') === 'true'
  
  if (!hasValidClientAuth) {
    // Check server-side session or redirect to basic auth check
    try {
      const response = await $fetch('/api/auth/session-check') as { success: boolean; data: { basicAuthValid: boolean } }
      if (!response.data?.basicAuthValid) {
        await navigateTo('/api/auth/basic-auth-check', { external: true })
        return
      } else {
        // Valid session exists, cache it client-side
        if (import.meta.client) {
          sessionStorage.setItem('basicAuthValid', 'true')
        }
      }
    } catch {
      // Session check failed, require authentication
      await navigateTo('/api/auth/basic-auth-check', { external: true })
      return
    }
  }
})
