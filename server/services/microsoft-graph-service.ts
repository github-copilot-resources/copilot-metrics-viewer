import type { EntraUser, OrgTreeNode } from '../../shared/types/org-tree'

async function fetchUser(token: string, idOrEmail: string): Promise<EntraUser | null> {
  try {
    const user = await $fetch<EntraUser>(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(idOrEmail)}?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    return user
  } catch {
    return null
  }
}

async function fetchDirectReports(token: string, userId: string): Promise<EntraUser[]> {
  try {
    const res = await $fetch<{ value: EntraUser[] }>(
      `https://graph.microsoft.com/v1.0/users/${userId}/directReports?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation&$top=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    return res.value ?? []
  } catch {
    return []
  }
}

async function buildSubtree(token: string, userId: string, depth: number, maxDepth: number): Promise<OrgTreeNode> {
  const user = await fetchUser(token, userId)
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  const node: OrgTreeNode = {
    ...user,
    directReports: [],
    copilotData: null,
    githubLogin: null,
  }

  if (depth < maxDepth) {
    const reports = await fetchDirectReports(token, user.id)
    node.directReports = await Promise.all(
      reports.map(r => buildSubtree(token, r.id, depth + 1, maxDepth))
    )
  }

  return node
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

/**
 * Build org subtree using a delegated access token obtained via MSAL browser popup.
 * Does NOT use the shared subtreeCache to avoid cross-user/cross-tenant pollution.
 */
export async function getSubtreeWithToken(
  token: string,
  userEmail: string,
  maxDepth = 3
): Promise<OrgTreeNode> {
  return buildSubtree(token, userEmail, 0, maxDepth)
}
