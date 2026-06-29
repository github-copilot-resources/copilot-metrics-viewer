// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildDataSourceBadge, formatSyncedAt } from '../shared/utils/data-source-badge';

const FIXED_NOW = Date.parse('2026-06-29T10:00:00Z');

describe('formatSyncedAt', () => {
  it('returns null for null input', () => {
    expect(formatSyncedAt(null, FIXED_NOW)).toBeNull();
  });
  it('returns null for unparseable timestamps', () => {
    expect(formatSyncedAt('not-a-date', FIXED_NOW)).toBeNull();
  });
  it('renders just-now for <1 minute', () => {
    expect(formatSyncedAt('2026-06-29T09:59:30Z', FIXED_NOW)).toBe('synced just now');
  });
  it('renders minutes for <1 hour', () => {
    expect(formatSyncedAt('2026-06-29T09:45:00Z', FIXED_NOW)).toBe('synced 15m ago');
  });
  it('renders hours for <1 day', () => {
    expect(formatSyncedAt('2026-06-29T03:00:00Z', FIXED_NOW)).toBe('synced 7h ago');
  });
  it('renders days for >=1 day', () => {
    expect(formatSyncedAt('2026-06-27T10:00:00Z', FIXED_NOW)).toBe('synced 2d ago');
  });
  it('renders "just now" for future timestamps (clock skew)', () => {
    expect(formatSyncedAt('2026-06-29T10:05:00Z', FIXED_NOW)).toBe('synced just now');
  });
});

describe('buildDataSourceBadge', () => {
  it('returns null when no source header was observed', () => {
    expect(buildDataSourceBadge({ source: null, syncedAt: null, reason: null })).toBeNull();
  });

  it('returns a green DB chip with sync freshness', () => {
    const b = buildDataSourceBadge(
      { source: 'db', syncedAt: '2026-06-29T08:00:00Z', reason: 'covered by job #7' },
      FIXED_NOW,
    );
    expect(b).not.toBeNull();
    expect(b!.color).toBe('success');
    expect(b!.icon).toBe('mdi-database-check');
    expect(b!.label).toBe('From DB · synced 2h ago');
    expect(b!.tooltip).toContain('local CSV-ingest database');
    expect(b!.tooltip).toContain('covered by job #7');
  });

  it('returns bare "From DB" label when syncedAt is absent', () => {
    const b = buildDataSourceBadge(
      { source: 'db', syncedAt: null, reason: 'ok' },
      FIXED_NOW,
    );
    expect(b!.label).toBe('From DB');
  });

  it('returns a blue Live chip', () => {
    const b = buildDataSourceBadge(
      { source: 'live', syncedAt: null, reason: 'no completed ingest job covers window' },
      FIXED_NOW,
    );
    expect(b).not.toBeNull();
    expect(b!.color).toBe('info');
    expect(b!.icon).toBe('mdi-cloud-download');
    expect(b!.label).toBe('Live');
    expect(b!.tooltip).toContain('Fetched live from GitHub');
    expect(b!.tooltip).toContain('no completed ingest job covers window');
  });

  it('omits reason from tooltip when not provided', () => {
    const b = buildDataSourceBadge(
      { source: 'live', syncedAt: null, reason: null },
      FIXED_NOW,
    );
    expect(b!.tooltip).toBe("Fetched live from GitHub's billing API.");
  });
});
