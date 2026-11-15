/** Bind summary and detail to the exact request, including scope, date and page. */
export function kpiRequestKey(query: Record<string, unknown> = {}): string {
  return JSON.stringify(Object.entries(query).filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)));
}

/** ofetch consumes options.query before onResponse; use its final request URL. */
export function kpiResponseKey(request: string | Request): string {
  const url = new URL(typeof request === 'string' ? request : request.url, 'http://localhost');
  return kpiRequestKey(Object.fromEntries(url.searchParams));
}

export function currentKpiResponse<T extends { requestKey: string }>(
  data: T | null | undefined, status: string, query: Record<string, unknown>,
): T | null {
  return status === 'success' && data?.requestKey === kpiRequestKey(query) ? data : null;
}
