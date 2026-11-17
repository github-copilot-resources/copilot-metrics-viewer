import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('raw user-day downloads', () => {
  const fetchMock = vi.fn();
  const records = [
    { user_login: 'octocat', day: '2026-03-01', report_start_day: '2026-03-01', report_end_day: '2026-03-02' },
    { user_login: 'octocat', day: '2026-03-02', report_start_day: '2026-03-01', report_end_day: '2026-03-02' },
  ];
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('$fetch', fetchMock);
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { isDataMocked: false } }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reads the day_totals wrapper used by the organization mock fixture', async () => {
    fetchMock.mockResolvedValue(JSON.stringify({ day_totals: records }));
    const { downloadUserDayRecords } = await import('../server/services/github-copilot-usage-api');
    expect(await downloadUserDayRecords('http://localhost/mock.json')).toEqual(records);
  });

  it('does not shift real report dates', async () => {
    fetchMock.mockResolvedValue(JSON.stringify(records));
    const { downloadUserDayRecords } = await import('../server/services/github-copilot-usage-api');
    expect(await downloadUserDayRecords('https://example.test/report')).toEqual(records);
  });

  it('uses a per-day fixture for enterprise teams and shifts the full fixture together', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    fetchMock.mockResolvedValue(JSON.stringify({ day_totals: records }));
    const { fetchRawUserDayRecords } = await import('../server/services/github-copilot-usage-api');
    const result = await fetchRawUserDayRecords({ scope: 'enterprise', identifier: 'test-ent', isMocked: true }, {});

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/organization-users-28-day-report.json');
    expect(result.map(record => record.day)).toEqual(['2026-10-06', '2026-10-07']);
    expect(result.map(record => [record.report_start_day, record.report_end_day])).toEqual([
      ['2026-10-06', '2026-10-07'],
      ['2026-10-06', '2026-10-07'],
    ]);
  });

  it('anchors mock dates to the selected end date, not a member-specific latest day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    fetchMock.mockResolvedValue(JSON.stringify({ day_totals: [
      records[0],
      { ...records[1], user_login: 'another-team' },
    ] }));
    const { fetchRawUserDayRecords } = await import('../server/services/github-copilot-usage-api');
    const result = await fetchRawUserDayRecords(
      { scope: 'organization', identifier: 'test-org', isMocked: true }, {}, '2026-09-30'
    );
    expect(result.map(record => record.day)).toEqual(['2026-09-29', '2026-09-30']);
  });

  it('keeps real raw report dates unchanged even when an end date is supplied', async () => {
    fetchMock.mockResolvedValueOnce({ download_links: ['https://example.test/report'] })
      .mockResolvedValueOnce(JSON.stringify(records));
    const { fetchRawUserDayRecords } = await import('../server/services/github-copilot-usage-api');
    expect(await fetchRawUserDayRecords(
      { scope: 'enterprise', identifier: 'test-ent' }, { Authorization: 'Bearer test' }, '2026-09-30'
    )).toEqual(records);
  });
});
