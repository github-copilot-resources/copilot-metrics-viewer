/**
 * Minimal Copilot usage totals needed for org-tree enrichment.
 * Kept in shared/ to avoid importing server-only code from client components.
 */
export interface UserTotals {
  login: string
  user_id: number
  total_active_days: number
  user_initiated_interaction_count: number
  code_generation_activity_count: number
  code_acceptance_activity_count: number
  loc_suggested_to_add_sum: number
  loc_suggested_to_delete_sum: number
  loc_added_sum: number
  loc_deleted_sum: number
}

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
