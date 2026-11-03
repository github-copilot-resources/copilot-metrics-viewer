import type { H3Event } from 'h3'
import { userTokenFromSecure, BILLING_DENIED_STATUSES } from './billing-token'

/**
 * Seats fallback to the signed-in user's GitHub OAuth token.
 *
 * GitHub's enterprise seats endpoint (/enterprises/{ent}/copilot/billing/seats)
 * does not accept GitHub App installation tokens — there is no enterprise
 * "seats" permission. With NUXT_SEATS_USE_USER_TOKEN=true, a 401/403/404 on
 * the central credential (GitHub App / PAT) is retried once with the caller's
 * own OAuth token, so enterprise owners / billing managers still get the Seat
 * Analysis tab while everyone else gets a `seats-no-access` 403.
 */

/** Reason attached to the 403 when neither credential may read seats. */
export const SEATS_NO_ACCESS_REASON = 'seats-no-access'

/** True when NUXT_SEATS_USE_USER_TOKEN is enabled (boolean or "true"). */
export function isSeatsUserTokenEnabled(config: Record<string, unknown>): boolean {
  const v = config.seatsUseUserToken
  return v === true || String(v).trim().toLowerCase() === 'true'
}

export function errorStatus(error: unknown): number {
  const e = error as { statusCode?: number, status?: number } | null
  return e?.statusCode ?? e?.status ?? 0
}

export type SeatsFetcher = <T>(url: string, params: Record<string, unknown>) => Promise<T>

export interface SeatsFetcherState {
  /** True once the fetcher switched to the caller's own token. */
  usedUserToken: boolean
  /** True when the user-token fallback is enabled AND the caller has a GitHub token. */
  fallbackAvailable: boolean
}

/**
 * Returns a fetch function for the seats endpoint that starts with
 * `centralHeaders` and — when enabled — switches to the caller's OAuth token
 * after the first 401/403/404. Once switched, later pages reuse the user token.
 */
export async function createSeatsFetcher(
  event: H3Event,
  centralHeaders: HeadersInit | undefined,
): Promise<{ fetchSeats: SeatsFetcher, state: SeatsFetcherState }> {
  const config = useRuntimeConfig(event) as Record<string, unknown>

  let userToken = ''
  if (isSeatsUserTokenEnabled(config)) {
    try {
      const session = await getUserSession(event)
      userToken = userTokenFromSecure((session as { secure?: unknown })?.secure)
    } catch {
      userToken = ''
    }
  }

  // Already using the user's own token centrally (no App / PAT configured):
  // retrying with the same credential would be pointless.
  const centralAuth = new Headers(centralHeaders ?? {}).get('Authorization') || ''
  const fallbackAvailable = !!userToken && centralAuth !== `token ${userToken}`

  const state: SeatsFetcherState = { usedUserToken: false, fallbackAvailable }
  let headers: HeadersInit | undefined = centralHeaders

  const fetchSeats: SeatsFetcher = async <T>(url: string, params: Record<string, unknown>) => {
    try {
      return await $fetch<T>(url, { headers, params })
    } catch (error: unknown) {
      if (!state.usedUserToken && fallbackAvailable && BILLING_DENIED_STATUSES.has(errorStatus(error))) {
        state.usedUserToken = true
        headers = new Headers({
          Authorization: `token ${userToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        })
        return await $fetch<T>(url, { headers, params })
      }
      throw error
    }
  }

  return { fetchSeats, state }
}

/**
 * Builds the h3 error for a failed seats fetch. With the user-token fallback
 * enabled, a GitHub denial means "this caller has no seat access" and is
 * tagged so the UI can hide the tab instead of showing an error.
 */
export function seatsFetchError(error: unknown, event: H3Event) {
  const status = errorStatus(error) || 500
  const config = useRuntimeConfig(event) as Record<string, unknown>
  const noAccess = isSeatsUserTokenEnabled(config) && BILLING_DENIED_STATUSES.has(status)
  return createError({
    statusCode: noAccess ? 403 : status,
    statusMessage: 'Error fetching seats data. Error: ' + String(error),
    data: noAccess ? { reason: SEATS_NO_ACCESS_REASON } : undefined,
  })
}
