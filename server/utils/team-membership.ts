/**
 * Team-membership gating for non-admin callers (issue #398, Policy C).
 *
 * Background: aggregate team metrics (interactions, accepted lines, etc.)
 * are derived from individual contributors. On small teams (2-3 people) a
 * non-member can back-calculate a coworker's numbers via simple subtraction.
 * Under Austrian / EU compliance (BetrVG §96a, GDPR), an employee's
 * productivity data must not be exposed to people who are not their direct
 * collaborators.
 *
 * Policy:
 *   - Usage admins (NUXT_USAGE_ADMINS) — unchanged, see all teams.
 *   - PAT-mode deployments (no OAuth provider) — bypassed, no session
 *     identity to gate on. Operators are expected to lock these down at the
 *     network layer.
 *   - Non-admin OAuth callers in organization scope — allowed iff they are
 *     a confirmed member of the requested team.
 *   - Non-admin OAuth callers in enterprise scope — blocked entirely when
 *     `?githubTeam=` is set. The /enterprises/{ent}/teams/{team}/memberships
 *     endpoint does not exist, so we cannot cheaply verify membership.
 *
 * The check piggybacks on the GitHub session token already attached to the
 * event by the auth middleware — we call /orgs/{org}/teams/{team}/memberships/{login}
 * which returns 200 (active/pending) or 404 (not a member).
 */

import type { H3Event, EventHandlerRequest } from 'h3'
import { isUsageAdminForEvent, getSessionLoginForFilter } from './usage-admin'

type Scope = 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise'

/**
 * Gate a team-filtered request. No-ops (returns) for:
 *   - admins
 *   - PAT-mode (no OAuth)
 *   - requests without a team filter
 *
 * Throws 403 otherwise when the caller is not a member of the requested team.
 * Throws 403 for enterprise-scope team queries unconditionally (non-admin).
 */
export async function requireTeamMembershipOrAdmin(
  event: H3Event<EventHandlerRequest>,
  scope: Scope,
  org: string | undefined,
  teamSlug: string | undefined,
): Promise<void> {
  if (!teamSlug) return

  // Admins (and PAT-mode operators) bypass the check — both return true.
  if (await isUsageAdminForEvent(event)) return

  // Virtual "reports-to:<upn>" teams are resolved server-side from a roster
  // (not GitHub teams) and are already scoped to the caller's reports.
  // Don't probe GitHub for them.
  if (teamSlug.toLowerCase().startsWith('reports-to:')) return

  // Enterprise-scope team queries have no membership endpoint — block.
  const isEnterprise = scope === 'enterprise' || scope === 'team-enterprise'
  if (isEnterprise) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Forbidden: non-admins cannot query enterprise-scope team metrics. ' +
        'Ask your admin to add you to NUXT_USAGE_ADMINS, or scope the query to an organization team.',
    })
  }

  if (!org) {
    throw createError({
      statusCode: 400,
      statusMessage: 'githubOrg is required when filtering by team',
    })
  }

  const login = await getSessionLoginForFilter(event)
  if (!login) {
    // OAuth mode but no session — should have been caught by middleware,
    // but defensive: 401 not 403.
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const headers = event.context.headers as Headers | undefined
  if (!headers || !headers.has('Authorization')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const config = useRuntimeConfig(event)
  const baseUrl = config.githubApiBaseUrl || 'https://api.github.com'
  const url = `${baseUrl}/orgs/${encodeURIComponent(org)}/teams/${encodeURIComponent(teamSlug)}/memberships/${encodeURIComponent(login)}`

  let status = 0
  let role: string | undefined
  let state: string | undefined
  try {
    const res = await $fetch.raw<{ role?: string; state?: string }>(url, {
      headers: Object.fromEntries(headers.entries()),
      ignoreResponseError: true,
    })
    status = res.status
    role = res._data?.role
    state = res._data?.state
  } catch {
    // network / unknown — treat as denied
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: unable to verify membership in team "${teamSlug}".`,
    })
  }

  if (status === 200 && state === 'active' && (role === 'member' || role === 'maintainer')) {
    return
  }

  throw createError({
    statusCode: 403,
    statusMessage:
      `Forbidden: you are not a member of team "${teamSlug}". ` +
      'Per-team metrics are restricted to team members (or admins on NUXT_USAGE_ADMINS).',
  })
}
