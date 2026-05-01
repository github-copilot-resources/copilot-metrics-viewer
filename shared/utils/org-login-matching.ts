import type { UserTotals } from '../types/org-tree'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.\-_]/g, '')
}

function emailPrefix(email: string | null | undefined): string {
  if (!email) return ''
  return email.split('@')[0] ?? ''
}

/**
 * Map a list of Entra members to their matching GitHub logins.
 * Compares normalized email/UPN prefix against normalized GitHub logins.
 */
export function matchEmailsToLogins(
  members: Array<{ mail: string | null; userPrincipalName: string }>,
  userMetrics: UserTotals[]
): string[] {
  const loginPool = userMetrics.map(u => ({ login: u.login, norm: normalize(u.login) }))
  const result: string[] = []

  for (const member of members) {
    const p1 = normalize(emailPrefix(member.mail))
    const p2 = normalize(emailPrefix(member.userPrincipalName))
    for (const { login, norm } of loginPool) {
      if ((p1 && norm === p1) || (p2 && norm === p2)) {
        result.push(login)
        break
      }
    }
  }
  return result
}
