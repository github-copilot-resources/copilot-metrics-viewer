import { getUserWithToken, getTransitiveReportsWithToken } from '../services/microsoft-graph-service'
import type { OrgReportsResponse } from '../../shared/types/org-tree'
import { findNodeInTree, collectDescendants } from '../utils/entra-mock-tree'
import type { MockTreeNode } from '../utils/entra-mock-tree'

export default defineEventHandler(async (event): Promise<OrgReportsResponse> => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const userUpn = query.userUpn as string | undefined

  if (!userUpn) {
    throw createError({ statusCode: 400, statusMessage: 'userUpn query parameter is required' })
  }

  if (config.public.isDataMocked || query.mock === 'true') {
    const mockData = await import('../../public/mock-data/entra-org-tree.json')
    const root = mockData.default as unknown as MockTreeNode
    const node = findNodeInTree(root, userUpn)
    if (!node) {
      throw createError({ statusCode: 404, statusMessage: `User not found: ${userUpn}` })
    }
    const members = collectDescendants(node)
    return {
      rootUser: {
        id: node.id,
        displayName: node.displayName,
        mail: node.mail,
        userPrincipalName: node.userPrincipalName,
        jobTitle: node.jobTitle,
        department: node.department,
        officeLocation: node.officeLocation,
      },
      members,
      count: members.length,
      truncated: false,
    }
  }

  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 503, statusMessage: 'Entra ID is not configured on this server' })
  }
  const token = authHeader.slice(7)

  const [rootUser, reports] = await Promise.all([
    getUserWithToken(token, userUpn),
    getTransitiveReportsWithToken(token, userUpn),
  ])

  if (!rootUser) {
    throw createError({ statusCode: 404, statusMessage: `User not found: ${userUpn}` })
  }

  return {
    rootUser,
    members: reports.map(r => ({ mail: r.mail, userPrincipalName: r.userPrincipalName })),
    count: reports.length,
    truncated: reports.length >= 9990,
  }
})
