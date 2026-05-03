import { getUserWithToken, getTransitiveReportsWithToken } from '../services/microsoft-graph-service'
import type { OrgReportsResponse, OrgReportsMember } from '../../shared/types/org-tree'

interface MockTreeNode {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  jobTitle: string | null
  department: string | null
  officeLocation: string | null
  directReports: MockTreeNode[]
}

function findNodeInTree(node: MockTreeNode, upn: string): MockTreeNode | null {
  const norm = upn.toLowerCase()
  if (node.userPrincipalName.toLowerCase() === norm || (node.mail ?? '').toLowerCase() === norm) {
    return node
  }
  for (const child of node.directReports) {
    const found = findNodeInTree(child, upn)
    if (found) return found
  }
  return null
}

function collectDescendants(node: MockTreeNode): OrgReportsMember[] {
  const result: OrgReportsMember[] = []
  for (const child of node.directReports) {
    result.push({ mail: child.mail, userPrincipalName: child.userPrincipalName })
    result.push(...collectDescendants(child))
  }
  return result
}

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
