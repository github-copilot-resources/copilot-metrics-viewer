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
 * Follows @odata.nextLink pagination up to MAX_PAGES.
 */
export async function getTransitiveReportsWithToken(
  token: string,
  upn: string
): Promise<TransitiveReportMember[]> {
  const results: TransitiveReportMember[] = []
  // transitiveReports is an "advanced query" — requires ConsistencyLevel + $count=true
  let url: string | null =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}/transitiveReports?${MEMBER_SELECT}&$count=true`
  let pages = 0

  while (url && pages < MAX_PAGES) {
    const res = await $fetch<{ value: any[]; '@odata.nextLink'?: string }>(url, {
      headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
    })
    for (const m of res.value ?? []) {
      if (m.id && m.userPrincipalName) {
        results.push({ id: m.id, mail: m.mail ?? null, userPrincipalName: m.userPrincipalName })
      }
    }
    url = res['@odata.nextLink'] ?? null
    pages++
  }

  return results
}

/** Search users using a delegated access token obtained via MSAL browser popup. */
export async function searchUsersWithToken(token: string, query: string): Promise<EntraUser[]> {
  try {
    const res = await $fetch<{ value: EntraUser[] }>(
      `https://graph.microsoft.com/v1.0/users?$search="displayName:${query}"&$select=id,displayName,mail,userPrincipalName,jobTitle&$top=15&$orderby=displayName`,
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
