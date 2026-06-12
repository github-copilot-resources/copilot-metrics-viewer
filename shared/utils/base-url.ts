/**
 * Pure helpers for assembling app-base-URL-aware paths.
 *
 * These functions are framework-agnostic and safe to import from
 * both client (composables, components) and server (Nitro handlers,
 * utilities) code, as well as from unit tests.
 *
 * For Nitro-aware wrappers that read `useRuntimeConfig().app.baseURL`
 * automatically, see `server/utils/base-url.ts`. For the client-side
 * composable equivalent, see `app/composables/useAppBaseURL.ts`.
 */

/**
 * Normalizes a base URL path to always end with a trailing slash.
 *
 * Examples:
 *   normalizeBaseURL('')                         → '/'
 *   normalizeBaseURL('/')                        → '/'
 *   normalizeBaseURL('/copilot-metrics-viewer')  → '/copilot-metrics-viewer/'
 *   normalizeBaseURL('/copilot-metrics-viewer/') → '/copilot-metrics-viewer/'
 */
export function normalizeBaseURL(base: string | undefined | null): string {
  if (!base) return '/'
  return base.endsWith('/') ? base : base + '/'
}

/**
 * Prepends a base URL to the given path, avoiding double slashes.
 *
 * Examples (base = '/copilot-metrics-viewer/'):
 *   joinBaseURL('/copilot-metrics-viewer/', '/')           → '/copilot-metrics-viewer/'
 *   joinBaseURL('/copilot-metrics-viewer/', '/select-org') → '/copilot-metrics-viewer/select-org'
 *   joinBaseURL('/copilot-metrics-viewer/', '')            → '/copilot-metrics-viewer/'
 */
export function joinBaseURL(base: string, path: string): string {
  const normalizedBase = normalizeBaseURL(base)
  const cleanPath = (path || '').replace(/^\/+/, '')
  if (!cleanPath) return normalizedBase
  return `${normalizedBase}${cleanPath}`
}
