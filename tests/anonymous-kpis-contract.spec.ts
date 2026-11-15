import { describe, expect, it } from 'vitest';
import { parseSeatsSummary, parseUserSummaryHeader } from '../shared/utils/anonymous-kpis';
import { summarizeSeats } from '../server/utils/anonymous-kpis';
import { Seat } from '../app/model/Seat';
import { currentKpiResponse, kpiRequestKey, kpiResponseKey } from '../app/utils/anonymousKpis';

describe('bounded anonymous summary contract', () => {
  it('distinguishes missing and partial summaries from real zero counts', () => {
    expect(parseUserSummaryHeader(null)).toBeNull();
    expect(parseSeatsSummary(undefined)).toBeNull();
    expect(parseSeatsSummary({ assigned: 100, never_used: null, inactive_7: null, inactive_30: null }))
      .toEqual({ assigned: 100, never_used: null, inactive_7: null, inactive_30: null });
    expect(parseUserSummaryHeader('{"total_users":0,"active_users":0,"generated":0,"accepted":0}')?.total_users).toBe(0);
  });
  it('rejects malformed, non-finite, negative, inconsistent and identity-bearing summaries', () => {
    for (const header of [
      '', '{}', '[]', 'null',
      '{"total_users":1e999,"active_users":0,"generated":0,"accepted":0}',
      '{"total_users":-1,"active_users":0,"generated":0,"accepted":0}',
      '{"total_users":1,"active_users":2,"generated":0,"accepted":0}',
      '{"total_users":1,"active_users":0,"generated":0,"accepted":0,"login":"synthetic-other"}',
    ]) expect(() => parseUserSummaryHeader(header)).toThrow('Invalid anonymous user summary');
    for (const summary of [
      { assigned: NaN, never_used: null, inactive_7: null, inactive_30: null },
      { assigned: 1, never_used: 2, inactive_7: null, inactive_30: null },
      { assigned: 1, never_used: 0, inactive_7: 0.1, inactive_30: 0 },
      { assigned: 1, never_used: 0, inactive_7: 0, inactive_30: 0, users: [] },
    ]) expect(() => parseSeatsSummary(summary)).toThrow('Invalid anonymous seat summary');
  });
  it('preserves strict inactivity thresholds and excludes no-shows from inactivity', () => {
    const now = new Date('2026-11-14T12:00:00Z');
    const seats = [null, '2026-11-07T12:00:00Z', '2026-11-07T11:59:59Z', '2026-10-14T11:59:59Z']
      .map((activity, index) => new Seat({
        assignee: { login: `synthetic-${index}`, id: index + 1 }, last_activity_at: activity,
      }));
    expect(summarizeSeats(seats, now)).toEqual({ assigned: 4, never_used: 1, inactive_7: 2, inactive_30: 1 });
  });
  it('hides old aggregates/detail during reloads, errors, cancelled or newer scope/date/page requests', () => {
    const query = { scope: 'organization', githubOrg: 'synthetic-org', since: '2026-01-01', page: '1' };
    const response = { requestKey: kpiRequestKey(query), summary: { assigned: 901 } };
    expect(kpiResponseKey('/api/seats?scope=organization&githubOrg=synthetic-org&since=2026-01-01&page=1')).toBe(response.requestKey);
    expect(currentKpiResponse(response, 'success', query)).toBe(response);
    for (const status of ['pending', 'error', 'idle']) {
      expect(currentKpiResponse(response, status, query)).toBeNull();
    }
    for (const changed of [
      { githubOrg: 'synthetic-other-org' }, { since: '2026-02-01' }, { page: '2' },
      { githubTeam: 'synthetic-team' }, { scope: 'enterprise' },
    ]) expect(currentKpiResponse(response, 'success', { ...query, ...changed })).toBeNull();
  });
});
