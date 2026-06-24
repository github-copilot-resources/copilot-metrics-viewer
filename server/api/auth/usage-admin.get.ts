/**
 * GET /api/auth/usage-admin
 *
 * Returns `{ isUsageAdmin: boolean }` for the current session.
 *
 * Implemented as a dedicated endpoint (rather than baked into setUserSession
 * at OAuth time) so:
 *   1. Admin status reflects live changes to NUXT_USAGE_ADMINS without
 *      requiring users to log out / back in.
 *   2. No per-OAuth-provider boilerplate is needed across the 5 handlers.
 *   3. The check is centralised in server/utils/usage-admin.ts.
 *
 * Returns `{ isUsageAdmin: false }` for unauthenticated callers — never
 * throws — so the client UI can decide whether to render the Billing tab
 * without needing to handle errors here.
 */

import { isUsageAdminForEvent } from '../../utils/usage-admin'

export default defineEventHandler(async (event) => {
  const isUsageAdmin = await isUsageAdminForEvent(event)
  return { isUsageAdmin }
})
