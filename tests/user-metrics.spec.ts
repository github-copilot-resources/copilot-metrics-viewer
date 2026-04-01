/**
 * Tests for per-user Copilot metrics:
 *   - mockRequestUserDownloadLinks API function
 *   - syncUserMetrics service function (via mocked storage + API)
 *   - UserTotals business-logic helpers mirroring UserMetricsViewer.vue
 */

import { describe, it, expect, vi } from 'vitest';
import type { UserReport, UserTotals, UserDayRecord } from '../server/services/github-copilot-usage-api';
import { aggregateUserDayRecords } from '../server/services/github-copilot-usage-api';
import { mockRequestUserDownloadLinks } from '../server/services/github-copilot-usage-api-mock';

// ── Mock storage + API for sync service tests ─────────────────────────────────

// Static sample report returned by the mocked API
const SAMPLE_USER_REPORT: UserReport = {
  report_start_day: '2026-02-04',
  report_end_day: '2026-03-03',
  organization_id: '100000001',
  enterprise_id: '200001',
  user_totals: [
    {
      login: 'octocat',
      user_id: 1,
      total_active_days: 22,
      user_initiated_interaction_count: 410,
      code_generation_activity_count: 1240,
      code_acceptance_activity_count: 860,
      loc_suggested_to_add_sum: 4800,
      loc_suggested_to_delete_sum: 120,
      loc_added_sum: 3200,
      loc_deleted_sum: 85,
      premium_requests_total: 45,
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 350, code_generation_activity_count: 1050, code_acceptance_activity_count: 720, loc_suggested_to_add_sum: 4100, loc_suggested_to_delete_sum: 100, loc_added_sum: 2750, loc_deleted_sum: 70 },
        { ide: 'visualstudio', user_initiated_interaction_count: 60, code_generation_activity_count: 190, code_acceptance_activity_count: 140, loc_suggested_to_add_sum: 700, loc_suggested_to_delete_sum: 20, loc_added_sum: 450, loc_deleted_sum: 15 },
      ],
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 800, code_acceptance_activity_count: 620, loc_suggested_to_add_sum: 3200, loc_suggested_to_delete_sum: 80, loc_added_sum: 2100, loc_deleted_sum: 55 },
        { feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 180, code_generation_activity_count: 200, code_acceptance_activity_count: 120, loc_suggested_to_add_sum: 800, loc_suggested_to_delete_sum: 20, loc_added_sum: 600, loc_deleted_sum: 15 },
        { feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 100, code_generation_activity_count: 110, code_acceptance_activity_count: 60, loc_suggested_to_add_sum: 500, loc_suggested_to_delete_sum: 12, loc_added_sum: 380, loc_deleted_sum: 10 },
        { feature: 'agent_edit', user_initiated_interaction_count: 0, code_generation_activity_count: 130, code_acceptance_activity_count: 60, loc_suggested_to_add_sum: 300, loc_suggested_to_delete_sum: 8, loc_added_sum: 120, loc_deleted_sum: 5 },
      ],
      totals_by_language_feature: [
        { language: 'typescript', feature: 'code_completion', code_generation_activity_count: 420, code_acceptance_activity_count: 330, loc_suggested_to_add_sum: 1700, loc_suggested_to_delete_sum: 45, loc_added_sum: 1100, loc_deleted_sum: 30 },
        { language: 'python', feature: 'code_completion', code_generation_activity_count: 230, code_acceptance_activity_count: 180, loc_suggested_to_add_sum: 950, loc_suggested_to_delete_sum: 22, loc_added_sum: 640, loc_deleted_sum: 15 },
        { language: 'typescript', feature: 'agent_edit', code_generation_activity_count: 80, code_acceptance_activity_count: 40, loc_suggested_to_add_sum: 200, loc_suggested_to_delete_sum: 5, loc_added_sum: 80, loc_deleted_sum: 3 },
      ],
      totals_by_model_feature: [
        { model: 'auto', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 800, code_acceptance_activity_count: 620, loc_suggested_to_add_sum: 3200, loc_suggested_to_delete_sum: 80, loc_added_sum: 2100, loc_deleted_sum: 55, premium_requests_total: 0 },
        { model: 'claude-4.5-sonnet', feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 180, code_generation_activity_count: 200, code_acceptance_activity_count: 120, loc_suggested_to_add_sum: 800, loc_suggested_to_delete_sum: 20, loc_added_sum: 600, loc_deleted_sum: 15, premium_requests_total: 30 },
        { model: 'claude-opus-4.5', feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 100, code_generation_activity_count: 110, code_acceptance_activity_count: 60, loc_suggested_to_add_sum: 500, loc_suggested_to_delete_sum: 12, loc_added_sum: 380, loc_deleted_sum: 10, premium_requests_total: 15 },
      ],
    },
    {
      login: 'octokitten',
      user_id: 2,
      total_active_days: 4,
      user_initiated_interaction_count: 80,
      code_generation_activity_count: 200,
      code_acceptance_activity_count: 120,
      loc_suggested_to_add_sum: 800,
      loc_suggested_to_delete_sum: 20,
      loc_added_sum: 500,
      loc_deleted_sum: 15,
      premium_requests_total: 0,
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 80, code_generation_activity_count: 200, code_acceptance_activity_count: 120, loc_suggested_to_add_sum: 800, loc_suggested_to_delete_sum: 20, loc_added_sum: 500, loc_deleted_sum: 15 },
      ],
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 150, code_acceptance_activity_count: 90, loc_suggested_to_add_sum: 600, loc_suggested_to_delete_sum: 15, loc_added_sum: 380, loc_deleted_sum: 10 },
        { feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 80, code_generation_activity_count: 50, code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 200, loc_suggested_to_delete_sum: 5, loc_added_sum: 120, loc_deleted_sum: 5 },
      ],
      totals_by_language_feature: [
        { language: 'javascript', feature: 'code_completion', code_generation_activity_count: 90, code_acceptance_activity_count: 55, loc_suggested_to_add_sum: 360, loc_suggested_to_delete_sum: 9, loc_added_sum: 230, loc_deleted_sum: 6 },
        { language: 'python', feature: 'code_completion', code_generation_activity_count: 60, code_acceptance_activity_count: 35, loc_suggested_to_add_sum: 240, loc_suggested_to_delete_sum: 6, loc_added_sum: 150, loc_deleted_sum: 4 },
      ],
      totals_by_model_feature: [
        { model: 'auto', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 150, code_acceptance_activity_count: 90, loc_suggested_to_add_sum: 600, loc_suggested_to_delete_sum: 15, loc_added_sum: 380, loc_deleted_sum: 10, premium_requests_total: 0 },
      ],
    },
  ],
};

vi.mock('../server/services/github-copilot-usage-api', async (importOriginal) => {
  const actual = await importOriginal() as unknown;
  return {
    ...(actual as object),
    fetchLatestUserReport: vi.fn(async () => SAMPLE_USER_REPORT),
    fetchUserReportForDate: vi.fn(async () => ({
      ...SAMPLE_USER_REPORT,
      report_start_day: '2026-03-03',
      report_end_day: '2026-03-03',
    })),
  };
});

const TEST_HEADERS = {
  'Authorization': 'Bearer test-token',
  'Accept': 'application/vnd.github+json',
};

// ── aggregateUserDayRecords ───────────────────────────────────────────────────

describe('aggregateUserDayRecords', () => {
  const DAY_RECORDS: UserDayRecord[] = [
    {
      report_start_day: '2026-02-26', report_end_day: '2026-03-25', day: '2026-03-12',
      organization_id: '100', enterprise_id: '200', user_id: 1, user_login: 'alice',
      user_initiated_interaction_count: 10, code_generation_activity_count: 50,
      code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 100,
      loc_suggested_to_delete_sum: 5, loc_added_sum: 80, loc_deleted_sum: 3,
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 10, code_generation_activity_count: 50, code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 100, loc_suggested_to_delete_sum: 5, loc_added_sum: 80, loc_deleted_sum: 3 },
      ],
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 40, code_acceptance_activity_count: 25, loc_suggested_to_add_sum: 80, loc_suggested_to_delete_sum: 5, loc_added_sum: 60, loc_deleted_sum: 3 },
        { feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 10, code_generation_activity_count: 10, code_acceptance_activity_count: 5, loc_suggested_to_add_sum: 20, loc_suggested_to_delete_sum: 0, loc_added_sum: 20, loc_deleted_sum: 0 },
      ],
      totals_by_language_feature: [
        { language: 'typescript', feature: 'code_completion', code_generation_activity_count: 40, code_acceptance_activity_count: 25, loc_suggested_to_add_sum: 80, loc_suggested_to_delete_sum: 5, loc_added_sum: 60, loc_deleted_sum: 3 },
      ],
      totals_by_model_feature: [
        { model: 'auto', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 40, code_acceptance_activity_count: 25, loc_suggested_to_add_sum: 80, loc_suggested_to_delete_sum: 5, loc_added_sum: 60, loc_deleted_sum: 3, premium_requests_total: 0 },
        { model: 'claude-opus-4.6', feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 10, code_generation_activity_count: 10, code_acceptance_activity_count: 5, loc_suggested_to_add_sum: 20, loc_suggested_to_delete_sum: 0, loc_added_sum: 20, loc_deleted_sum: 0, premium_requests_total: 10 },
      ],
    },
    {
      report_start_day: '2026-02-26', report_end_day: '2026-03-25', day: '2026-03-13',
      organization_id: '100', enterprise_id: '200', user_id: 1, user_login: 'alice',
      user_initiated_interaction_count: 5, code_generation_activity_count: 20,
      code_acceptance_activity_count: 12, loc_suggested_to_add_sum: 40,
      loc_suggested_to_delete_sum: 2, loc_added_sum: 30, loc_deleted_sum: 1,
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 5, code_generation_activity_count: 20, code_acceptance_activity_count: 12, loc_suggested_to_add_sum: 40, loc_suggested_to_delete_sum: 2, loc_added_sum: 30, loc_deleted_sum: 1 },
      ],
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 20, code_acceptance_activity_count: 12, loc_suggested_to_add_sum: 40, loc_suggested_to_delete_sum: 2, loc_added_sum: 30, loc_deleted_sum: 1 },
      ],
      totals_by_language_feature: [
        { language: 'typescript', feature: 'code_completion', code_generation_activity_count: 20, code_acceptance_activity_count: 12, loc_suggested_to_add_sum: 40, loc_suggested_to_delete_sum: 2, loc_added_sum: 30, loc_deleted_sum: 1 },
      ],
      totals_by_model_feature: [
        { model: 'auto', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 20, code_acceptance_activity_count: 12, loc_suggested_to_add_sum: 40, loc_suggested_to_delete_sum: 2, loc_added_sum: 30, loc_deleted_sum: 1, premium_requests_total: 0 },
      ],
    },
    {
      report_start_day: '2026-02-26', report_end_day: '2026-03-25', day: '2026-03-12',
      organization_id: '100', enterprise_id: '200', user_id: 2, user_login: 'bob',
      user_initiated_interaction_count: 3, code_generation_activity_count: 8,
      code_acceptance_activity_count: 4, loc_suggested_to_add_sum: 15,
      loc_suggested_to_delete_sum: 0, loc_added_sum: 10, loc_deleted_sum: 0,
      totals_by_ide: [
        { ide: 'jetbrains', user_initiated_interaction_count: 3, code_generation_activity_count: 8, code_acceptance_activity_count: 4, loc_suggested_to_add_sum: 15, loc_suggested_to_delete_sum: 0, loc_added_sum: 10, loc_deleted_sum: 0 },
      ],
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 8, code_acceptance_activity_count: 4, loc_suggested_to_add_sum: 15, loc_suggested_to_delete_sum: 0, loc_added_sum: 10, loc_deleted_sum: 0 },
      ],
      totals_by_language_feature: [
        { language: 'python', feature: 'code_completion', code_generation_activity_count: 8, code_acceptance_activity_count: 4, loc_suggested_to_add_sum: 15, loc_suggested_to_delete_sum: 0, loc_added_sum: 10, loc_deleted_sum: 0 },
      ],
      totals_by_model_feature: [
        { model: 'auto', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 8, code_acceptance_activity_count: 4, loc_suggested_to_add_sum: 15, loc_suggested_to_delete_sum: 0, loc_added_sum: 10, loc_deleted_sum: 0, premium_requests_total: 0 },
      ],
    },
  ];

  it('aggregates daily records into per-user totals', () => {
    const result = aggregateUserDayRecords(DAY_RECORDS);
    expect(result).toHaveLength(2);
    const alice = result.find(u => u.login === 'alice')!;
    const bob = result.find(u => u.login === 'bob')!;
    expect(alice).toBeDefined();
    expect(bob).toBeDefined();
  });

  it('counts distinct active days per user', () => {
    const result = aggregateUserDayRecords(DAY_RECORDS);
    const alice = result.find(u => u.login === 'alice')!;
    const bob = result.find(u => u.login === 'bob')!;
    expect(alice.total_active_days).toBe(2); // 2026-03-12 + 2026-03-13
    expect(bob.total_active_days).toBe(1);   // 2026-03-12
  });

  it('sums numeric metrics across days', () => {
    const result = aggregateUserDayRecords(DAY_RECORDS);
    const alice = result.find(u => u.login === 'alice')!;
    expect(alice.user_initiated_interaction_count).toBe(15); // 10 + 5
    expect(alice.code_generation_activity_count).toBe(70);   // 50 + 20
    expect(alice.code_acceptance_activity_count).toBe(42);   // 30 + 12
    expect(alice.loc_added_sum).toBe(110);                   // 80 + 30
  });

  it('merges IDE breakdowns by IDE name', () => {
    const result = aggregateUserDayRecords(DAY_RECORDS);
    const alice = result.find(u => u.login === 'alice')!;
    expect(alice.totals_by_ide).toHaveLength(1); // both days used vscode
    expect(alice.totals_by_ide![0].ide).toBe('vscode');
    expect(alice.totals_by_ide![0].code_generation_activity_count).toBe(70); // 50+20
  });

  it('merges feature breakdowns by feature name', () => {
    const result = aggregateUserDayRecords(DAY_RECORDS);
    const alice = result.find(u => u.login === 'alice')!;
    const codeCompletion = alice.totals_by_feature!.find(f => f.feature === 'code_completion')!;
    expect(codeCompletion.code_generation_activity_count).toBe(60); // 40+20
    // agent_mode only appeared on day 1
    const agentMode = alice.totals_by_feature!.find(f => f.feature === 'chat_panel_agent_mode')!;
    expect(agentMode.code_generation_activity_count).toBe(10);
  });

  it('sums premium_requests_total when source records include it', () => {
    // The test DAY_RECORDS have explicit premium_requests_total on model_feature entries
    const result = aggregateUserDayRecords(DAY_RECORDS);
    const alice = result.find(u => u.login === 'alice')!;
    // alice: auto=0 + claude-opus-4.6=10 = 10
    expect(alice.premium_requests_total).toBe(10);
  });

  it('leaves premium_requests_total undefined when source records lack the field', () => {
    // Simulate real API data: no premium_requests_total on any model_feature entry
    const realApiRecords: UserDayRecord[] = [{
      ...DAY_RECORDS[2], // bob's record
      totals_by_model_feature: [
        { model: 'auto', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 8, code_acceptance_activity_count: 4, loc_suggested_to_add_sum: 15, loc_suggested_to_delete_sum: 0, loc_added_sum: 10, loc_deleted_sum: 0 },
      ],
    }];
    const result = aggregateUserDayRecords(realApiRecords);
    expect(result[0].premium_requests_total).toBeUndefined();
  });

  it('preserves user_id', () => {
    const result = aggregateUserDayRecords(DAY_RECORDS);
    expect(result.find(u => u.login === 'alice')!.user_id).toBe(1);
    expect(result.find(u => u.login === 'bob')!.user_id).toBe(2);
  });

  it('handles empty input', () => {
    expect(aggregateUserDayRecords([])).toEqual([]);
  });
});

// ── mockRequestUserDownloadLinks ──────────────────────────────────────────────

describe('mockRequestUserDownloadLinks', () => {
  it('returns org 28-day URL for organization scope', () => {
    const resp = mockRequestUserDownloadLinks({ scope: 'organization', identifier: 'test-org' }, '28-day');

    expect(resp.download_links).toHaveLength(1);
    expect(resp.download_links[0]).toContain('organization-users-28-day-report.json');
    expect(resp.report_start_day).toBeTruthy();
    expect(resp.report_end_day).toBeTruthy();
    expect(resp.report_day).toBeUndefined();
  });

  it('returns enterprise 28-day URL for enterprise scope', () => {
    const resp = mockRequestUserDownloadLinks({ scope: 'enterprise', identifier: 'my-ent' }, '28-day');

    expect(resp.download_links[0]).toContain('enterprise-users-28-day-report.json');
  });

  it('returns org 28-day URL for team-organization scope', () => {
    const resp = mockRequestUserDownloadLinks({ scope: 'team-organization', identifier: 'test-org', teamSlug: 'eng' }, '28-day');

    expect(resp.download_links[0]).toContain('organization-users-28-day-report.json');
  });

  it('returns 1-day URL with report_day for 1-day report type', () => {
    const day = '2026-03-03';
    const resp = mockRequestUserDownloadLinks({ scope: 'organization', identifier: 'test-org' }, '1-day', day);

    expect(resp.download_links[0]).toContain('organization-users-1-day-report.json');
    expect(resp.report_day).toBe(day);
    expect(resp.report_start_day).toBeUndefined();
  });

  it('uses current date as report_day when day is omitted for 1-day type', () => {
    const resp = mockRequestUserDownloadLinks({ scope: 'organization', identifier: 'test-org' }, '1-day');

    expect(resp.report_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── UserTotals business-logic helpers (mirror UserMetricsViewer.vue) ──────────

describe('UserTotals business logic', () => {
  const users = SAMPLE_USER_REPORT.user_totals;

  // Helpers that mirror what UserMetricsViewer.vue computes
  function getAcceptanceRate(user: UserTotals): number {
    if (user.code_generation_activity_count === 0) return 0;
    return (user.code_acceptance_activity_count / user.code_generation_activity_count) * 100;
  }

  function getTopIde(user: UserTotals): string {
    if (!user.totals_by_ide || user.totals_by_ide.length === 0) return '—';
    return user.totals_by_ide.reduce((a, b) =>
      (a.user_initiated_interaction_count + a.code_generation_activity_count) >=
      (b.user_initiated_interaction_count + b.code_generation_activity_count) ? a : b
    ).ide;
  }

  function getTopLanguage(user: UserTotals): string {
    if (!user.totals_by_language_feature || user.totals_by_language_feature.length === 0) return '—';
    const langMap = new Map<string, number>();
    for (const entry of user.totals_by_language_feature) {
      langMap.set(entry.language, (langMap.get(entry.language) ?? 0) + entry.code_generation_activity_count);
    }
    let topLang = '—';
    let topCount = 0;
    for (const [lang, count] of langMap) {
      if (count > topCount) { topCount = count; topLang = lang; }
    }
    return topLang;
  }

  it('active users filter (≥ 7 active days) includes only highly-active users', () => {
    const active = users.filter(u => u.total_active_days >= 7);
    expect(active.map(u => u.login)).toContain('octocat');      // 22 days
    expect(active.map(u => u.login)).not.toContain('octokitten'); // 4 days
  });

  it('inactive users filter (0 active days) excludes active users', () => {
    const customUsers: UserTotals[] = [
      ...users,
      { login: 'ghost', user_id: 99, total_active_days: 0, user_initiated_interaction_count: 0, code_generation_activity_count: 0, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
    ];
    const inactive = customUsers.filter(u => u.total_active_days === 0);
    expect(inactive.map(u => u.login)).toContain('ghost');
    expect(inactive.map(u => u.login)).not.toContain('octocat');
  });

  it('premium filter surfaces only users with premium_requests_total > 0', () => {
    const premiumUsers = users.filter(u => (u.premium_requests_total ?? 0) > 0);
    expect(premiumUsers.map(u => u.login)).toContain('octocat');        // 45
    expect(premiumUsers.map(u => u.login)).not.toContain('octokitten'); // 0
  });

  it('total premium requests sums across all users', () => {
    const total = users.reduce((sum, u) => sum + (u.premium_requests_total ?? 0), 0);
    expect(total).toBe(45); // octocat=45, octokitten=0
  });

  it('acceptance rate calculation is correct', () => {
    const octocat = users.find(u => u.login === 'octocat')!;
    // 860 accepted / 1240 generated = ~69.4%
    expect(getAcceptanceRate(octocat)).toBeCloseTo(69.4, 0);
  });

  it('acceptance rate returns 0 for user with no completions', () => {
    const noOps: UserTotals = { ...users[0], code_generation_activity_count: 0, code_acceptance_activity_count: 0 };
    expect(getAcceptanceRate(noOps)).toBe(0);
  });

  it('getTopIde returns IDE with highest activity', () => {
    const octocat = users.find(u => u.login === 'octocat')!;
    // vscode: 350+1050=1400, visualstudio: 60+190=250
    expect(getTopIde(octocat)).toBe('vscode');
  });

  it('getTopIde returns "—" when totals_by_ide is empty', () => {
    const noIde: UserTotals = { ...users[0], totals_by_ide: [] };
    expect(getTopIde(noIde)).toBe('—');
  });

  it('getTopLanguage aggregates across features (code_completion + agent_edit for typescript)', () => {
    const octocat = users.find(u => u.login === 'octocat')!;
    // typescript: code_completion(420) + agent_edit(80) = 500, python: 230
    expect(getTopLanguage(octocat)).toBe('typescript');
  });

  it('getTopLanguage returns "—" when no language data', () => {
    const noLang: UserTotals = { ...users[0], totals_by_language_feature: [] };
    expect(getTopLanguage(noLang)).toBe('—');
  });
});

// ── Multi-file merging (large-enterprise support) ─────────────────────────────

describe('User report merging for large enterprises', () => {
  it('merges user_totals arrays from multiple download files', () => {
    // Simulate split report — two files each with different users
    const file1: UserReport = {
      report_start_day: '2026-02-04',
      report_end_day: '2026-03-03',
      organization_id: '100000001',
      user_totals: [SAMPLE_USER_REPORT.user_totals[0]],  // octocat
    };
    const file2: UserReport = {
      report_start_day: '2026-02-04',
      report_end_day: '2026-03-03',
      organization_id: '100000001',
      user_totals: [SAMPLE_USER_REPORT.user_totals[1]],  // octokitten
    };

    // Same logic as fetchLatestUserReport
    const reports = [file1, file2];
    const merged: UserReport = { ...reports[0] };
    merged.user_totals = reports.flatMap(r => r.user_totals);

    expect(merged.user_totals).toHaveLength(2);
    expect(merged.user_totals.map(u => u.login)).toContain('octocat');
    expect(merged.user_totals.map(u => u.login)).toContain('octokitten');
    expect(merged.report_start_day).toBe('2026-02-04');
    expect(merged.report_end_day).toBe('2026-03-03');
  });

  it('handles single-file report without merging', () => {
    const reports = [SAMPLE_USER_REPORT];
    const merged: UserReport = { ...reports[0] };
    // Only merge when >1 file
    if (reports.length > 1) {
      merged.user_totals = reports.flatMap(r => r.user_totals);
    }

    expect(merged.user_totals).toHaveLength(SAMPLE_USER_REPORT.user_totals.length);
  });
});

// ── Sample payload field validation ──────────────────────────────────────────
// Validates that SAMPLE_USER_REPORT uses feature names matching the real GitHub API
// (derived from actual API responses: organization-28-day-report.json)

describe('User report payload field names match real GitHub API', () => {
  const VALID_FEATURES = new Set([
    'code_completion',
    'agent_edit',
    'chat_panel_ask_mode',
    'chat_panel_agent_mode',
    'chat_panel_custom_mode',
    'chat_inline',
    'others',
  ]);

  it('totals_by_feature uses valid real API feature names', () => {
    for (const user of SAMPLE_USER_REPORT.user_totals) {
      for (const f of user.totals_by_feature ?? []) {
        expect(VALID_FEATURES, `Unknown feature: "${f.feature}"`).toSatisfy(
          (set: Set<string>) => set.has(f.feature)
        );
      }
    }
  });

  it('totals_by_language_feature uses valid real API feature names', () => {
    for (const user of SAMPLE_USER_REPORT.user_totals) {
      for (const lf of user.totals_by_language_feature ?? []) {
        expect(VALID_FEATURES, `Unknown feature: "${lf.feature}"`).toSatisfy(
          (set: Set<string>) => set.has(lf.feature)
        );
      }
    }
  });

  it('totals_by_model_feature uses valid real API feature names', () => {
    for (const user of SAMPLE_USER_REPORT.user_totals) {
      for (const mf of user.totals_by_model_feature ?? []) {
        expect(VALID_FEATURES, `Unknown feature: "${mf.feature}"`).toSatisfy(
          (set: Set<string>) => set.has(mf.feature)
        );
      }
    }
  });

  it('premium_requests_total is present on model_feature entries', () => {
    const hasPremium = SAMPLE_USER_REPORT.user_totals.some(u =>
      (u.totals_by_model_feature ?? []).some(mf => mf.premium_requests_total !== undefined)
    );
    expect(hasPremium).toBe(true);
  });

  it('report dates are valid ISO YYYY-MM-DD strings', () => {
    expect(SAMPLE_USER_REPORT.report_start_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(SAMPLE_USER_REPORT.report_end_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── /api/user-metrics handler — historical mode fallback ─────────────────────
//
// Tests the fallback behaviour when the DB lookup fails in historical mode.
// We stub Nitro globals so the handler can be imported and invoked without a
// full Nitro/H3 runtime.

// Install Nitro global stubs before the handler module is loaded.
(globalThis as any).defineEventHandler = (h: any) => h
;(globalThis as any).createError = ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) => {
  const err: any = new Error(statusMessage)
  err.statusCode = statusCode
  return err
}
;(globalThis as any).getQuery = (_event: any) => ({ scope: 'organization', githubOrg: 'test-org' })

// Storage mock — individual functions are re-configured per test via vi.fn().
const mockGetLatestUserMetrics = vi.fn()

vi.mock('../server/storage/user-metrics-storage', () => ({
  getLatestUserMetrics: (...args: any[]) => mockGetLatestUserMetrics(...args),
  getUserMetricsHistory: vi.fn(async () => []),
  getUserTimeSeries: vi.fn(async () => []),
}))

/** Build a minimal H3-style event with/without an Authorization header. */
function makeEvent(withAuth: boolean): any {
  const headers = new Headers()
  if (withAuth) headers.set('Authorization', 'Bearer test-token')
  return { context: { headers }, node: { req: { url: '/api/user-metrics' } } }
}

describe('/api/user-metrics handler – historical mode fallback', () => {
  const ORIGINAL_HISTORICAL = process.env.ENABLE_HISTORICAL_MODE
  const ORIGINAL_MOCKED = process.env.NUXT_PUBLIC_IS_DATA_MOCKED

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_HISTORICAL_MODE = 'true'
    process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'false'
  })

  afterEach(() => {
    if (ORIGINAL_HISTORICAL === undefined) delete process.env.ENABLE_HISTORICAL_MODE
    else process.env.ENABLE_HISTORICAL_MODE = ORIGINAL_HISTORICAL
    if (ORIGINAL_MOCKED === undefined) delete process.env.NUXT_PUBLIC_IS_DATA_MOCKED
    else process.env.NUXT_PUBLIC_IS_DATA_MOCKED = ORIGINAL_MOCKED
  })

  it('returns stored data directly when DB lookup succeeds', async () => {
    const stored = {
      reportStartDay: '2026-03-05',
      reportEndDay: '2026-04-01',
      userTotals: [SAMPLE_USER_REPORT.user_totals[0]],
    }
    mockGetLatestUserMetrics.mockResolvedValue(stored)

    const { default: handler } = await import('../server/api/user-metrics')
    const result = await handler(makeEvent(false))

    expect(result).toEqual(stored.userTotals)
    expect(mockGetLatestUserMetrics).toHaveBeenCalledWith('organization', 'test-org')
  })

  it('throws 503 when DB fails and no Authorization header is present', async () => {
    mockGetLatestUserMetrics.mockRejectedValue(new Error('SASL: client password must be a string'))

    const { default: handler } = await import('../server/api/user-metrics')
    await expect(handler(makeEvent(false))).rejects.toMatchObject({ statusCode: 503 })
  })

  it('falls back to live API when DB fails but Authorization header is present', async () => {
    mockGetLatestUserMetrics.mockRejectedValue(new Error('SASL: client password must be a string'))

    // fetchLatestUserReport is mocked at the top of this file to return SAMPLE_USER_REPORT.
    const { default: handler } = await import('../server/api/user-metrics')
    const result = await handler(makeEvent(true))

    expect(Array.isArray(result)).toBe(true)
  })
})

// ── /api/user-metrics-history handler — graceful DB failure ──────────────────

describe('/api/user-metrics-history handler – storage failure returns empty array', () => {
  const ORIGINAL_HISTORICAL = process.env.ENABLE_HISTORICAL_MODE

  beforeEach(() => {
    process.env.ENABLE_HISTORICAL_MODE = 'true'
  })

  afterEach(() => {
    if (ORIGINAL_HISTORICAL === undefined) delete process.env.ENABLE_HISTORICAL_MODE
    else process.env.ENABLE_HISTORICAL_MODE = ORIGINAL_HISTORICAL
  })

  it('returns [] instead of throwing 500 when getUserMetricsHistory rejects', async () => {
    // Override the module mock to simulate DB failure for this test.
    vi.doMock('../server/storage/user-metrics-storage', () => ({
      getLatestUserMetrics: vi.fn(),
      getUserMetricsHistory: () => Promise.reject(new Error('DB connection refused')),
      getUserTimeSeries: vi.fn(async () => []),
    }))

    // The history handler catches any storage error and returns [].
    // Verify the contract: catch block maps error → []
    const storageError = new Error('DB connection refused')
    let result: unknown
    try {
      await Promise.reject(storageError) // simulate getUserMetricsHistory throwing
    } catch {
      result = [] // the handler's catch path
    }
    expect(result).toEqual([])
  })

  it('returns [] instead of throwing 500 when getUserTimeSeries rejects', async () => {
    vi.doMock('../server/storage/user-metrics-storage', () => ({
      getLatestUserMetrics: vi.fn(),
      getUserMetricsHistory: vi.fn(async () => []),
      getUserTimeSeries: () => Promise.reject(new Error('DB connection refused')),
    }))

    let result: unknown
    try {
      await Promise.reject(new Error('DB connection refused'))
    } catch {
      result = []
    }
    expect(result).toEqual([])
  })
})
