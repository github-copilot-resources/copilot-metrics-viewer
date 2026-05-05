import { getUserWithToken, getTransitiveReportsWithToken } from '../services/microsoft-graph-service'
import { fetchSamlIdentities } from '../services/github-saml-service'
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
    // In mock mode, githubLogin is explicit in the tree — no heuristic needed
    const resolvedLogins = members
      .map(m => m.githubLogin)
      .filter((l): l is string => !!l)
    const uniqueResolved = [...new Set(resolvedLogins)]
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
      resolvedLogins: uniqueResolved,
      unresolvedCount: members.length - uniqueResolved.length,
    }
  }

  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 503, statusMessage: 'Entra ID is not configured on this server' })
  }
  const token = authHeader.slice(7)

  // githubOrg is needed to look up SAML identities; fall back to runtime config default
  const githubOrg = (query.githubOrg as string | undefined) ?? config.public.githubOrg as string
  const githubToken = config.githubToken as string

  const [rootUser, reports] = await Promise.all([
    getUserWithToken(token, userUpn),
    getTransitiveReportsWithToken(token, userUpn),
  ])

  if (!rootUser) {
    throw createError({ statusCode: 404, statusMessage: `User not found: ${userUpn}` })
  }

  // Build SAML map: nameId (Entra UPN/email, lowercase) → GitHub login
  let samlMap = new Map<string, string>()
  if (githubOrg && githubToken) {
    samlMap = await fetchSamlIdentities(githubOrg, githubToken, config.apiBaseUrl as string)
  }

  const resolvedSet = new Set<string>()
  for (const member of reports) {
    const mail = (member.mail ?? '').toLowerCase()
    const upn = member.userPrincipalName.toLowerCase()
    const login = samlMap.get(mail) ?? samlMap.get(upn)
    if (login) resolvedSet.add(login)
  }

  return {
    rootUser,
    members: reports.map(r => ({ mail: r.mail, userPrincipalName: r.userPrincipalName })),
    count: reports.length,
    truncated: reports.length >= 9990,
    resolvedLogins: [...resolvedSet],
    unresolvedCount: reports.length - resolvedSet.size,
  }
})

