/**
 * Shared utilities for traversing the mock Entra org tree.
 * Used by server/api/org-reports.ts and server/api/seats.ts.
 */

export interface MockTreeNode {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  jobTitle: string | null
  department: string | null
  officeLocation: string | null
  directReports: MockTreeNode[]
}

/**
 * Find a node in the tree by UPN or mail (case-insensitive).
 */
export function findNodeInTree(node: MockTreeNode, upn: string): MockTreeNode | null {
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

/**
 * Collect all direct and transitive reports (excludes the node itself).
 */
export function collectDescendants(node: MockTreeNode): Array<{ mail: string | null; userPrincipalName: string }> {
  const result: Array<{ mail: string | null; userPrincipalName: string }> = []
  for (const child of node.directReports) {
    result.push({ mail: child.mail, userPrincipalName: child.userPrincipalName })
    result.push(...collectDescendants(child))
  }
  return result
}

/**
 * Collect the node itself plus all direct and transitive reports.
 * Used when scoping the dashboard to a manager's full org unit.
 */
export function collectNodeAndDescendants(node: MockTreeNode): Array<{ mail: string | null; userPrincipalName: string }> {
  return [
    { mail: node.mail, userPrincipalName: node.userPrincipalName },
    ...collectDescendants(node),
  ]
}

/**
 * Convert an Entra UPN/email to a probable GitHub login by stripping the domain
 * and normalizing dots and dashes (e.g. alice.chen@co.com → alicechen).
 *
 * This mirrors the normalize() function in shared/utils/org-login-matching.ts.
 */
export function normalizeUPNtoLogin(upn: string): string {
  const prefix = upn.split('@')[0] ?? upn
  return prefix.toLowerCase().replace(/[.\-_]/g, '')
}
