import { describe, it } from 'vitest'

describe('org-login-matching', () => {
  it('matching is now server-side via SAML identities in /api/org-reports', () => {
    // matchEmailsToLogins has been removed.
    // GitHub login resolution is done server-side using SAML external identities
    // (organization.samlIdentityProvider.externalIdentities via GraphQL).
    // See server/services/github-saml-service.ts and server/api/org-reports.ts.
  })
})

