/**
 * Safely extract a string value from a Vue Router route param.
 * Route params can be `string | string[]` (catch-all routes return an array),
 * so this helper normalises both cases to a plain string.
 *
 * @param params - The `route.params` object
 * @param key    - The param name to extract
 * @returns The string value, or an empty string when absent / empty array
 */
export function routeParamStr(params: Record<string, string | string[]>, key: string): string {
  const v = params[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0] ?? '';
  return '';
}

/**
 * Build the URL for the "reports-to" virtual team dashboard page.
 *
 * @param upn           - The manager's UPN / email (used as the route param)
 * @param logins        - Pre-resolved GitHub logins for the subtree (encoded as ?users=)
 * @param label         - Display name shown in the page header (encoded as ?name=)
 * @param scopeType     - 'organization' | 'enterprise'
 * @param selectedOrg   - When in enterprise scope, an optional org override
 * @param githubOrg     - Runtime-config org (used for organisation scope)
 * @param githubEnt     - Runtime-config enterprise (used for enterprise scope without org override)
 * @param mockParam     - Value of the current ?mock= query param (forwarded as-is)
 * @param encodeLogins  - Encoder for the logins array (defaults to base64url CSV)
 */
export function buildReportsToUrl(
  upn: string,
  logins: string[],
  label: string,
  scopeType: string,
  selectedOrg: string,
  githubOrg: string,
  githubEnt: string,
  mockParam?: string,
  encodeLogins?: (logins: string[]) => string,
): string {
  if (!upn) return '';
  const encodedUpn = encodeURIComponent(upn);
  let base: string;
  if (scopeType === 'enterprise') {
    base = selectedOrg
      ? `/orgs/${selectedOrg}/reportsto/${encodedUpn}`
      : `/enterprises/${githubEnt}/reportsto/${encodedUpn}`;
  } else {
    base = `/orgs/${githubOrg}/reportsto/${encodedUpn}`;
  }
  const query = new URLSearchParams();
  if (mockParam) query.set('mock', mockParam);
  if (logins.length && encodeLogins) query.set('users', encodeLogins(logins));
  if (label) query.set('name', label);
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}
