import { normalizeBaseURL } from '#shared/utils/base-url'

/**
 * Returns the application base URL, always ending with a trailing slash.
 * Reads from the Nuxt runtime config's app.baseURL which can be set via
 * the NUXT_APP_BASE_URL environment variable for sub-path deployments.
 *
 * Examples:
 *   NUXT_APP_BASE_URL not set        → '/'
 *   NUXT_APP_BASE_URL=/sub/          → '/sub/'
 *   NUXT_APP_BASE_URL=/sub           → '/sub/'
 */
export function useAppBaseURL(): string {
  return normalizeBaseURL(useRuntimeConfig().app.baseURL)
}
