import type { EntraUser, OrgTreeNode } from '../../shared/types/org-tree'

interface TokenResponse {
  access_token: string
  expires_in: number
}

interface CacheEntry {
  node: OrgTreeNode
  expiresAt: number
}

let _tokenCache: { token: string; expiresAt: number } | null = null

const subtreeCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now()
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.token
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await $fetch<TokenResponse>(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      body: body.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  )

  _tokenCache = { token: res.access_token, expiresAt: now + res.expires_in * 1000 }
  return _tokenCache.token
}

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

export async function searchUsers(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  query: string
): Promise<EntraUser[]> {
  const token = await getAccessToken(tenantId, clientId, clientSecret)
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

export async function getSubtree(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  userEmail: string,
  maxDepth = 3
): Promise<OrgTreeNode> {
  const cacheKey = `${userEmail}:${maxDepth}`
  const cached = subtreeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.node
  }

  const token = await getAccessToken(tenantId, clientId, clientSecret)
  const node = await buildSubtree(token, userEmail, 0, maxDepth)

  subtreeCache.set(cacheKey, { node, expiresAt: Date.now() + CACHE_TTL_MS })
  return node
}
