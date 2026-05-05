import { searchUsersWithToken } from '../services/microsoft-graph-service'
import type { OrgSearchResult } from '../../shared/types/org-tree'

// Mock search data matching the entra-org-tree.json
const MOCK_USERS: OrgSearchResult[] = [
  { id: '00000000-0000-0000-0000-000000000001', displayName: 'Monalisa Octocat', mail: 'monalisa@octodemo.com', userPrincipalName: 'monalisa@octodemo.com', jobTitle: 'VP of Engineering' },
  { id: '00000000-0000-0000-0000-000000000002', displayName: 'Defunkt Jones', mail: 'defunkt@octodemo.com', userPrincipalName: 'defunkt@octodemo.com', jobTitle: 'Engineering Manager' },
  { id: '00000000-0000-0000-0000-000000000003', displayName: 'Codertocat Rivera', mail: 'codertocat@octodemo.com', userPrincipalName: 'codertocat@octodemo.com', jobTitle: 'Engineering Manager' },
  { id: '00000000-0000-0000-0000-000000000004', displayName: 'Octocat Smith', mail: 'octocat@octodemo.com', userPrincipalName: 'octocat@octodemo.com', jobTitle: 'Senior Software Engineer' },
  { id: '00000000-0000-0000-0000-000000000005', displayName: 'Octokitten Lee', mail: 'octokitten@octodemo.com', userPrincipalName: 'octokitten@octodemo.com', jobTitle: 'Software Engineer' },
  { id: '00000000-0000-0000-0000-000000000006', displayName: 'Alice Chen', mail: 'alice.chen@octodemo.com', userPrincipalName: 'alice.chen@octodemo.com', jobTitle: 'Senior Software Engineer' },
  { id: '00000000-0000-0000-0000-000000000007', displayName: 'Bob Martinez', mail: 'bob.martinez@octodemo.com', userPrincipalName: 'bob.martinez@octodemo.com', jobTitle: 'Software Engineer' },
  { id: '00000000-0000-0000-0000-000000000008', displayName: 'Hubot Robot', mail: 'hubot@octodemo.com', userPrincipalName: 'hubot@octodemo.com', jobTitle: 'Software Engineer' },
]

export default defineEventHandler(async (event): Promise<OrgSearchResult[]> => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const q = (query.q as string | undefined ?? '').trim()

  if (q.length < 2) {
    return []
  }

  if (config.public.isDataMocked || query.mock === 'true') {
    const lower = q.toLowerCase()
    return MOCK_USERS.filter(u =>
      u.displayName.toLowerCase().includes(lower) ||
      (u.mail ?? '').toLowerCase().includes(lower)
    )
  }

  // Delegated token path — token obtained via MSAL browser popup
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return searchUsersWithToken(token, q)
  }

  throw createError({ statusCode: 503, statusMessage: 'Entra ID is not configured on this server' })
})
