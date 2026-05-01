/**
 * Minimal Copilot usage totals needed for org filter enrichment.
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

/** A flat user item returned by /api/org-search */
export interface OrgSearchResult {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  jobTitle: string | null
}

/** A member entry in the transitive reports list */
export interface OrgReportsMember {
  mail: string | null
  userPrincipalName: string
}

/** Response shape for /api/org-reports */
export interface OrgReportsResponse {
  rootUser: EntraUser
  members: OrgReportsMember[]
  count: number
  truncated: boolean
}
