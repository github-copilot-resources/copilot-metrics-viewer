/**
 * Fetches GitHub organization SAML external identities via GraphQL.
 * Maps SAML nameId (e.g. Entra UPN) → GitHub login for reliable cross-system matching.
 * Results are cached per-org for 1 hour to avoid repeated GraphQL calls.
 */

interface SamlCache {
  map: Map<string, string>
  expiry: number
}

const samlCache = new Map<string, SamlCache>()
const TTL_MS = 60 * 60 * 1000 // 1 hour

const SAML_QUERY = `
  query FetchSamlIdentities($org: String!, $after: String) {
    organization(login: $org) {
      samlIdentityProvider {
        externalIdentities(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            samlIdentity {
              nameId
            }
            user {
              login
            }
          }
        }
      }
    }
  }
`

interface GraphQLResponse {
  data?: {
    organization?: {
      samlIdentityProvider?: {
        externalIdentities?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null }
          nodes: Array<{
            samlIdentity: { nameId: string } | null
            user: { login: string } | null
          }>
        }
      }
    }
  }
  errors?: Array<{ message: string }>
}

/**
 * Fetch all SAML external identities for a GitHub org.
 * Returns a map of normalized nameId (lowercase) → GitHub login.
 * Returns an empty map if SAML is not configured, the token lacks permission,
 * or any network/API error occurs.
 */
export async function fetchSamlIdentities(
  org: string,
  githubToken: string,
  apiBaseUrl = 'https://api.github.com'
): Promise<Map<string, string>> {
  const cacheKey = `${org}`
  const cached = samlCache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) return cached.map

  const nameIdToLogin = new Map<string, string>()
  let after: string | null = null

  try {
    do {
      const resp = await fetch(`${apiBaseUrl}/graphql`, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${githubToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: SAML_QUERY, variables: { org, after } }),
      })

      if (!resp.ok) break

      const json = await resp.json() as GraphQLResponse

      if (json.errors?.length) {
        console.warn(`[saml-service] GraphQL errors for org "${org}":`, json.errors.map(e => e.message))
        break
      }

      const ext = json.data?.organization?.samlIdentityProvider?.externalIdentities
      if (!ext) break // org has no SAML IdP configured

      for (const node of ext.nodes) {
        if (node.samlIdentity?.nameId && node.user?.login) {
          nameIdToLogin.set(node.samlIdentity.nameId.toLowerCase(), node.user.login)
        }
      }

      after = ext.pageInfo.hasNextPage ? ext.pageInfo.endCursor : null
    } while (after)
  } catch (err) {
    console.warn(`[saml-service] Failed to fetch SAML identities for org "${org}":`, err)
  }

  samlCache.set(cacheKey, { map: nameIdToLogin, expiry: Date.now() + TTL_MS })
  return nameIdToLogin
}

/** Clear the in-memory cache (useful in tests). */
export function clearSamlCache(): void {
  samlCache.clear()
}
