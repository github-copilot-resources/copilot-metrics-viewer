/**
 * Utilities for building app-root-relative URLs that respect the
 * NUXT_APP_BASE_URL environment variable (set when the app is deployed
 * under a sub-path such as /copilot-metrics-viewer/).
 *
 * Usage in Nitro server handlers:
 *   return sendRedirect(event, appURL('/', event))           // → /copilot-metrics-viewer/
 *   return sendRedirect(event, appURL('/select-org', event)) // → /copilot-metrics-viewer/select-org
 */

/**
 * Normalizes a base URL path to always end with a trailing slash.
 * This is a pure function, usable in both server and client contexts.
 *
 * Examples:
 *   normalizeBaseURL('/')                   → '/'
 *   normalizeBaseURL('/copilot-metrics-viewer')  → '/copilot-metrics-viewer/'
 *   normalizeBaseURL('/copilot-metrics-viewer/') → '/copilot-metrics-viewer/'
 */
export function normalizeBaseURL(base: string): string {
  if (!base) return '/'
  return base.endsWith('/') ? base : base + '/'
}

/**
 * Prepends a base URL to the given path, avoiding double slashes.
 * This is a pure function, usable in both server and client contexts.
 *
 * Examples (base = '/copilot-metrics-viewer/'):
 *   joinBaseURL('/copilot-metrics-viewer/', '/')           → '/copilot-metrics-viewer/'
 *   joinBaseURL('/copilot-metrics-viewer/', '/select-org') → '/copilot-metrics-viewer/select-org'
 *   joinBaseURL('/copilot-metrics-viewer/', '')            → '/copilot-metrics-viewer/'
 */
export function joinBaseURL(base: string, path: string): string {
  const normalizedBase = normalizeBaseURL(base)
  const cleanPath = path.replace(/^\/+/, '')
  if (!cleanPath) return normalizedBase
  return `${normalizedBase}${cleanPath}`
}

/**
 * Returns the application base URL path, always with a trailing slash.
 * Reads from the Nuxt runtime config's app.baseURL which is set via the
 * NUXT_APP_BASE_URL environment variable for sub-path deployments.
 */
export function getAppBaseURL(event: Parameters<typeof useRuntimeConfig>[0]): string {
  return normalizeBaseURL(useRuntimeConfig(event).app.baseURL || '/')
}

/**
 * Prepends the application base URL to the given path.
 * Removes leading slashes from the path to avoid double slashes.
 *
 * Examples (when NUXT_APP_BASE_URL=/copilot-metrics-viewer/):
 *   appURL('/', event)           → '/copilot-metrics-viewer/'
 *   appURL('/select-org', event) → '/copilot-metrics-viewer/select-org'
 */
export function appURL(path: string, event: Parameters<typeof useRuntimeConfig>[0]): string {
  return joinBaseURL(getAppBaseURL(event), path)
}
