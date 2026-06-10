/**
 * Nitro-aware wrappers around the pure helpers in `shared/utils/base-url.ts`.
 *
 * These read the application base URL from the Nuxt runtime config and are
 * intended for use inside Nitro server handlers (OAuth callbacks, redirects,
 * etc.). The pure helpers `normalizeBaseURL` and `joinBaseURL` live in
 * `shared/utils/base-url.ts` and are auto-imported via Nuxt's shared layer.
 *
 * Usage in Nitro server handlers:
 *   return sendRedirect(event, appURL('/', event))           // → /copilot-metrics-viewer/
 *   return sendRedirect(event, appURL('/select-org', event)) // → /copilot-metrics-viewer/select-org
 */

import { normalizeBaseURL, joinBaseURL } from '#shared/utils/base-url'

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
