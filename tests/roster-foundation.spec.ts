import { describe, expect, it, vi } from 'vitest';
import { parseUsagePart, usageReportWindow, syncTeamMembership } from '../server/services/roster-foundation-sync';
import { getMembershipPage } from '../server/storage/roster-foundation-storage';
import { getPool } from '../server/storage/db';

vi.mock('../server/storage/db', () => ({ getPool: vi.fn() }));

describe('complete usage source validation', () => {
  const day = '2026-11-13';
  const row = { day, user_login: 'Synthetic', user_id: 1 };
  it('accepts raw per-day NDJSON and verified empty content, not preaggregated or malformed data', () => {
    expect(parseUsagePart(`${JSON.stringify(row)}\n${JSON.stringify({ ...row, user_login: 'Another' })}`, day, day)).toHaveLength(2);
    expect(parseUsagePart('', day, day)).toEqual([]);
    expect(parseUsagePart('[]', day, day)).toEqual([]);
    for (const value of ['null', '{}', '{"user_totals":[]}', '[{"login":"synthetic"}]', `${JSON.stringify(row)}\n{`, JSON.stringify([{ ...row, day: '2026-11-14' }]), JSON.stringify([{ ...row, user_login: '' }]), JSON.stringify([{ ...row, totals_by_cli: { token_usage: { prompt_tokens_sum: -1, output_tokens_sum: 0 } } }])]) {
      expect(() => parseUsagePart(value, day, day)).toThrow();
    }
  });
  it('requires authoritative report-window metadata, not record minima, requested dates or missing links', () => {
    expect(usageReportWindow({ download_links: ['synthetic:part'], report_day: day }, day)).toEqual({ since: day, until: day });
    expect(usageReportWindow({ download_links: ['synthetic:part'], report_start_day: day, report_end_day: '2026-11-14' })).toEqual({ since: day, until: '2026-11-14' });
    for (const response of [
      { download_links: [] }, { download_links: ['synthetic:part'] },
      { download_links: ['synthetic:part'], report_day: '2026-02-30' },
      { download_links: ['synthetic:part'], report_start_day: '2026-11-14', report_end_day: day },
      { download_links: ['synthetic:part'], report_day: '2026-11-12' },
    ]) expect(() => usageReportWindow(response, day)).toThrow();
  });

  it('does not expose malformed report content through sync error messages', () => {
    expect(() => parseUsagePart('synthetic-malformed-private-payload', day, day)).toThrow('Malformed user report record');
  });

  it('rejects virtual client lists before any data access', async () => {
    const key = {
      scope: 'organization', identifier: 'synthetic', teamKind: 'reports-to', teamKey: 'reports-to:synthetic',
      reportToLogins: ['synthetic-unverified-outsider'],
    } as const;
    expect(await syncTeamMembership(key, new Headers())).toEqual({ available: false, reason: 'membership-unavailable' });
    expect(await getMembershipPage(key, new Date('2026-11-15'), { limit: 25 })).toEqual({ available: false, reason: 'membership-unavailable' });
    expect(getPool).not.toHaveBeenCalled();
  });
});
