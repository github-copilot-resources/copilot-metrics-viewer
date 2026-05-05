import type { EntraUser } from '../../shared/types/org-tree'

const USER_SELECT = '$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation'
const MEMBER_SELECT = '$select=id,mail,userPrincipalName'
const MAX_PAGES = 10

export interface TransitiveReportMember {
  id: string
  mail: string | null
  userPrincipalName: string
}

/** Fetch a single user by UPN or object ID using a delegated token. */
export async function getUserWithToken(token: string, upn: string): Promise<EntraUser | null> {
  try {
    return await $fetch<EntraUser>(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}?${USER_SELECT}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  } catch {
    return null
  }
}

/**
 * Fetch all transitive reports for a user using a delegated token.
 *
 * Tries /transitiveReports first (single call, requires AAD P1/P2).
 * Falls back to recursive /directReports BFS (works in all tenants)
 * when the tenant returns Request_UnsupportedQuery.
 */
export async function getTransitiveReportsWithToken(
  token: string,
  upn: string
): Promise<TransitiveReportMember[]> {
  const headers = { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' }

  // Attempt 1: transitiveReports (efficient single-round-trip)
  try {
    const results: TransitiveReportMember[] = []
    let url: string | null =
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}/transitiveReports/microsoft.graph.user?${MEMBER_SELECT}&$count=true`
    let pages = 0
    while (url && pages < MAX_PAGES) {
      const res = await $fetch<{ value: any[]; '@odata.nextLink'?: string }>(url, { headers })
      for (const m of res.value ?? []) {
        if (m.id && m.userPrincipalName) {
          results.push({ id: m.id, mail: m.mail ?? null, userPrincipalName: m.userPrincipalName })
        }
      }
      url = res['@odata.nextLink'] ?? null
      pages++
    }
    return results
  } catch (err: any) {
    const status: number = err?.status ?? err?.statusCode ?? 0
    const code: string = err?.data?.error?.code ?? ''
    // Fall back to directReports on any 400 (transitiveReports requires AAD P1/P2)
    const isUnsupported = status === 400 || code === 'Request_UnsupportedQuery'
    if (!isUnsupported) throw err
  }

  // Attempt 2: recursive directReports BFS (no P1/P2 required)
  const fallbackHeaders = { Authorization: `Bearer ${token}` }
  const results: TransitiveReportMember[] = []
  const visited = new Set<string>()
  const MAX_DEPTH = 6

  async function fetchDirectReports(userId: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || visited.has(userId)) return
    visited.add(userId)
    let url: string | null =
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/directReports/microsoft.graph.user?${MEMBER_SELECT}`
    let pages = 0
    while (url && pages < MAX_PAGES) {
      const res = await $fetch<{ value: any[]; '@odata.nextLink'?: string }>(url, { headers: fallbackHeaders })
      const batch = (res.value ?? []).filter((m: any) => m.id && m.userPrincipalName)
      for (const m of batch) {
        results.push({ id: m.id, mail: m.mail ?? null, userPrincipalName: m.userPrincipalName })
      }
      await Promise.all(batch.map((m: any) => fetchDirectReports(m.id, depth + 1)))
      url = res['@odata.nextLink'] ?? null
      pages++
    }
  }

  await fetchDirectReports(upn, 0)
  return results
}

/** Search users using a delegated access token obtained via MSAL browser popup. */
export async function searchUsersWithToken(token: string, query: string): Promise<EntraUser[]> {
  try {
    // Note: $orderby is incompatible with $search on Microsoft Graph — results are sorted by relevance
    const res = await $fetch<{ value: EntraUser[] }>(
      `https://graph.microsoft.com/v1.0/users?$search="displayName:${query}"&$select=id,displayName,mail,userPrincipalName,jobTitle&$top=15`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ConsistencyLevel: 'eventual',
        },
      }
    )
    return res.value ?? []
  } catch {
    return []
  }
}
