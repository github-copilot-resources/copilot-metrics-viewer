/**
 * Pure date-range helpers extracted from server/api/data-range.ts.
 *
 * These functions are free of Nuxt auto-imports and can be unit-tested
 * directly without any Nuxt environment setup.
 */

import { baseScope } from '../storage/user-day-metrics-storage';

/** Format a Date as YYYY-MM-DD (UTC). */
export function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO YYYY-MM-DD for yesterday (UTC). Shared between live and historical modes. */
export function yesterdayIso(): string {
  const now = new Date();
  return toIsoDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

/** Live-mode default window: the 28 days ending yesterday. */
export function liveWindow(): { earliest: string; latest: string } {
  const latestIso = yesterdayIso();
  const latest = new Date(`${latestIso}T00:00:00Z`);
  // 28 days inclusive ending yesterday → start = latest - 27d
  const earliest = new Date(latest.getTime() - 27 * 24 * 60 * 60 * 1000);
  return { earliest: toIsoDay(earliest), latest: latestIso };
}

/** Extract every `day` (YYYY-MM-DD) field from a mock JSON `day_totals` array. */
export function collectMockDays(mockJson: unknown): string[] {
  const json = mockJson as { day_totals?: Array<{ day?: string }> };
  if (!Array.isArray(json.day_totals)) return [];
  return json.day_totals
    .map(r => r?.day)
    .filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
}

export function mockRange(
  scope: string,
  mockOrgMetrics: unknown,
  mockEntMetrics: unknown,
  mockOrgUsers: unknown,
  mockEntUsers: unknown,
): { earliest: string; latest: string } {
  const isOrg = baseScope(scope || 'organization') === 'organization';
  const days = isOrg
    ? [...collectMockDays(mockOrgMetrics), ...collectMockDays(mockOrgUsers)]
    : [...collectMockDays(mockEntMetrics), ...collectMockDays(mockEntUsers)];

  if (days.length === 0) return liveWindow();
  // YYYY-MM-DD strings sort lexicographically == chronologically
  const sorted = days.slice().sort();
  return { earliest: sorted[0]!, latest: sorted[sorted.length - 1]! };
}
