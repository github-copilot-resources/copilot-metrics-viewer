/**
 * Pure helper for the BillingCreditsViewer "From DB" / "Live" chip.
 *
 * Lives in shared/ so unit tests can exercise it without booting a Vue
 * render harness. Inputs come from the HTTP response headers set by
 * server/api/billing-credits.get.ts.
 */

export interface DataSourceHeaders {
  source: 'db' | 'live' | null;
  syncedAt: string | null;
  reason: string | null;
}

export interface DataSourceBadge {
  label: string;
  color: 'success' | 'info';
  icon: string;
  tooltip: string;
}

/**
 * Format the freshness of an ingest timestamp as a human-readable suffix
 * (e.g. "synced 2h ago"). Returns null when no timestamp is available, so
 * callers can fall back to the bare "From DB" label without "·".
 *
 * `now` is injected for testability.
 */
export function formatSyncedAt(syncedAtIso: string | null, now: number = Date.now()): string | null {
  if (!syncedAtIso) return null;
  const t = Date.parse(syncedAtIso);
  if (Number.isNaN(t)) return null;
  const mins = Math.floor((now - t) / 60000);
  if (mins < 0) return 'synced just now'; // clock skew defence
  if (mins < 1) return 'synced just now';
  if (mins < 60) return `synced ${mins}m ago`;
  if (mins < 60 * 24) return `synced ${Math.floor(mins / 60)}h ago`;
  return `synced ${Math.floor(mins / (60 * 24))}d ago`;
}

/**
 * Build the chip descriptor. Returns null when no `X-Data-Source` header
 * was observed (e.g. legacy server, mock mode, error response) — caller
 * hides the chip in that case rather than render a stale label.
 */
export function buildDataSourceBadge(
  headers: DataSourceHeaders,
  now: number = Date.now(),
): DataSourceBadge | null {
  if (!headers.source) return null;

  if (headers.source === 'db') {
    const suffix = formatSyncedAt(headers.syncedAt, now);
    const label = suffix ? `From DB · ${suffix}` : 'From DB';
    return {
      label,
      color: 'success',
      icon: 'mdi-database-check',
      tooltip: `Served from the local CSV-ingest database. ${headers.reason || ''}`.trim(),
    };
  }

  return {
    label: 'Live',
    color: 'info',
    icon: 'mdi-cloud-download',
    tooltip: `Fetched live from GitHub's billing API. ${headers.reason || ''}`.trim(),
  };
}
