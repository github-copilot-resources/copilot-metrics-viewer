import type { UserTotals } from '../../server/services/github-copilot-usage-api'

/** A user record from Microsoft Entra / Graph API */
export interface EntraUser {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  jobTitle: string | null
  department: string | null
  officeLocation: string | null
}

/** A node in the org tree, may be enriched with Copilot data */
export interface OrgTreeNode extends EntraUser {
  directReports: OrgTreeNode[]
  /** Matched Copilot totals for this user (if any) */
  copilotData: UserTotals | null
  /** GitHub login derived from email prefix matching */
  githubLogin: string | null
}

/** Response shape for /api/org-tree */
export interface OrgTreeResponse {
  root: OrgTreeNode
  totalNodes: number
  copilotMatchCount: number
}

/** A flat user item returned by /api/org-search */
export interface OrgSearchResult {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  jobTitle: string | null
}
