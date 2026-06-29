/**
 * GET /api/auth/usage-admin
 *
 * Returns `{ isUsageAdmin, billingEnabled, billingEnterprise }` for the current session.
 *
 * - `isUsageAdmin`     — whether the caller is on NUXT_USAGE_ADMINS
 * - `billingEnabled`   — whether the deployment has NUXT_GITHUB_BILLING_TOKEN configured
 *                        (server-only secret; we only expose the boolean, not the token)
 * - `billingEnterprise` — NUXT_BILLING_ENTERPRISE if set (slug only — non-secret)
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
  const config = useRuntimeConfig(event)
  const billingToken = (config.githubBillingToken as string | undefined) ?? ''
  const billingEnterprise = (config.billingEnterprise as string | undefined) ?? ''
  const billingEnabled = !!billingToken.trim()

  // Mock mode: surface the Billing tab in local dev / Playwright runs so the
  // feature is discoverable without configuring NUXT_USAGE_ADMINS + OAuth.
  // We only honour the SERVER-SIDE env (NUXT_PUBLIC_IS_DATA_MOCKED) — NOT the
  // ?mock=true query param. The query-param mock toggle is for data endpoints
  // that read bundled fixtures; honouring it here would let any client flip
  // isUsageAdmin to true by appending ?mock=true to the URL.
  const envMocked = config.public?.isDataMocked === true
    || String(config.public?.isDataMocked) === 'true'
  if (envMocked) {
    return { isUsageAdmin: true, billingEnabled: true, billingEnterprise }
  }
  const isUsageAdmin = await isUsageAdminForEvent(event)
  return { isUsageAdmin, billingEnabled, billingEnterprise }
})
