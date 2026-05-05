/**
 * Entra → GitHub login matching utilities.
 *
 * Matching is now done server-side in /api/org-reports using SAML external identities
 * (organization.samlIdentityProvider.externalIdentities via GraphQL).
 * The resolved GitHub logins are returned directly in OrgReportsResponse.resolvedLogins.
 *
 * This file is kept for any future shared matching utilities.
 */
