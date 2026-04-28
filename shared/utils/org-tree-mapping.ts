import type { OrgTreeNode } from '../types/org-tree'
import type { UserTotals } from '../../server/services/github-copilot-usage-api'

/**
 * Normalize a string for login matching:
 * lowercase, strip dots, hyphens, underscores
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[.\-_]/g, '')
}

/**
 * Extract username prefix from an email address
 */
function emailPrefix(email: string | null | undefined): string {
  if (!email) return ''
  return email.split('@')[0] ?? ''
}

/**
 * Find the best-match GitHub login for an Entra user.
 * Strategy: compare normalized email prefix vs normalized GitHub login.
 */
function findGithubLogin(node: OrgTreeNode, userTotals: UserTotals[]): string | null {
  const prefixFromMail = normalize(emailPrefix(node.mail))
  const prefixFromUpn  = normalize(emailPrefix(node.userPrincipalName))

  for (const u of userTotals) {
    const normLogin = normalize(u.login)
    if (
      (prefixFromMail && normLogin === prefixFromMail) ||
      (prefixFromUpn  && normLogin === prefixFromUpn)
    ) {
      return u.login
    }
  }
  return null
}

/**
 * Walk the tree and enrich each node with matched Copilot data.
 * Mutates the tree in place and returns it.
 */
export function mapCopilotDataToTree(node: OrgTreeNode, userTotals: UserTotals[]): OrgTreeNode {
  const login = findGithubLogin(node, userTotals)
  node.githubLogin = login
  node.copilotData = login ? (userTotals.find(u => u.login === login) ?? null) : null

  for (const child of node.directReports) {
    mapCopilotDataToTree(child, userTotals)
  }

  return node
}

/**
 * Collect all GitHub logins from a subtree (only nodes with a matched login).
 */
export function getSubtreeLogins(node: OrgTreeNode): string[] {
  const logins: string[] = []
  if (node.githubLogin) logins.push(node.githubLogin)
  for (const child of node.directReports) {
    logins.push(...getSubtreeLogins(child))
  }
  return logins
}
