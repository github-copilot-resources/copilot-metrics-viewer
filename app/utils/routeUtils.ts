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
