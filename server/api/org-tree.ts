import { getSubtree, getSubtreeWithToken } from '../services/microsoft-graph-service'
import type { OrgTreeNode, OrgTreeResponse } from '../../shared/types/org-tree'

function countNodes(node: OrgTreeNode): number {
  return 1 + node.directReports.reduce((sum, r) => sum + countNodes(r), 0)
}

function countMatched(node: OrgTreeNode): number {
  const mine = node.copilotData ? 1 : 0
  return mine + node.directReports.reduce((sum, r) => sum + countMatched(r), 0)
}

export default defineEventHandler(async (event): Promise<OrgTreeResponse> => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const userEmail = query.userEmail as string | undefined
  const maxDepth = Math.min(Number(query.maxDepth ?? 3), 6)

  if (!userEmail) {
    throw createError({ statusCode: 400, statusMessage: 'userEmail query parameter is required' })
  }

  let root: OrgTreeNode

  if (config.public.isDataMocked) {
    // Load mock tree and find the requested root node
    const mockTree = await import('../../public/mock-data/entra-org-tree.json')
    const normalised = mockTree.default as unknown as OrgTreeNode

    function findNode(node: OrgTreeNode, email: string): OrgTreeNode | null {
      if (
        (node.mail ?? '').toLowerCase() === email.toLowerCase() ||
        node.userPrincipalName.toLowerCase() === email.toLowerCase()
      ) {
        return node
      }
      for (const r of node.directReports) {
        const found = findNode(r, email)
        if (found) return found
      }
      return null
    }

    const found = findNode(normalised, userEmail)
    root = found ?? normalised
  } else {
    // Delegated token path — token obtained via MSAL browser popup
    const authHeader = getRequestHeader(event, 'authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      root = await getSubtreeWithToken(token, userEmail, maxDepth)
    } else {
      // Service principal path — server-side app credentials
      const tenantId = config.entraTenantId
      const clientId = config.entraClientId
      const clientSecret = config.entraClientSecret

      if (!tenantId || !clientId || !clientSecret) {
        throw createError({ statusCode: 503, statusMessage: 'Entra ID is not configured on this server' })
      }

      root = await getSubtree(tenantId, clientId, clientSecret, userEmail, maxDepth)
    }
  }

  return {
    root,
    totalNodes: countNodes(root),
    copilotMatchCount: countMatched(root),
  }
})
