// @vitest-environment nuxt
/**
 * Unit tests for per-user metrics functionality
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { UserReport, UserTotals } from '@/../server/services/github-copilot-usage-api';
import { Options } from '@/model/Options';

// ── Helpers ──────────────────────────────────────────────────────────────────

function readMockReport(filename: string): UserReport {
  const path = resolve(`public/mock-data/new-api/${filename}`);
  return JSON.parse(readFileSync(path, 'utf8')) as UserReport;
}

// ── Mock data validation ──────────────────────────────────────────────────────

describe('User metrics mock data', () => {
  test('organization 28-day report has expected structure', () => {
    const report = readMockReport('organization-users-28-day-report.json');

    expect(report.report_start_day).toBe('2026-02-04');
    expect(report.report_end_day).toBe('2026-03-03');
    expect(report.organization_id).toBeDefined();
    expect(Array.isArray(report.user_totals)).toBe(true);
    expect(report.user_totals.length).toBeGreaterThan(0);
  });

  test('organization 28-day report user totals have required fields', () => {
    const report = readMockReport('organization-users-28-day-report.json');

    for (const user of report.user_totals) {
      expect(user.login).toBeTruthy();
      expect(typeof user.user_id).toBe('number');
      expect(typeof user.total_active_days).toBe('number');
      expect(typeof user.user_initiated_interaction_count).toBe('number');
      expect(typeof user.code_generation_activity_count).toBe('number');
      expect(typeof user.code_acceptance_activity_count).toBe('number');
      expect(typeof user.loc_suggested_to_add_sum).toBe('number');
      expect(typeof user.loc_added_sum).toBe('number');
    }
  });

  test('enterprise mock data exists and is parseable', () => {
    const report = readMockReport('enterprise-users-28-day-report.json');
    expect(report.user_totals.length).toBeGreaterThan(0);
  });

  test('1-day report has correct structure', () => {
    const report = readMockReport('organization-users-1-day-report.json');
    expect(report.user_totals.length).toBeGreaterThan(0);
    const user = report.user_totals[0];
    expect(user.login).toBeTruthy();
  });

  test('premium_requests_total is present on some users', () => {
    const report = readMockReport('organization-users-28-day-report.json');
    const hasPremium = report.user_totals.some(u => (u.premium_requests_total ?? 0) > 0);
    expect(hasPremium).toBe(true);
  });

  test('totals_by_ide breakdown is present', () => {
    const report = readMockReport('organization-users-28-day-report.json');
    const userWithIde = report.user_totals.find(u => u.totals_by_ide && u.totals_by_ide.length > 0);
    expect(userWithIde).toBeDefined();
    const ideEntry = userWithIde!.totals_by_ide![0];
    expect(ideEntry.ide).toBeTruthy();
    expect(typeof ideEntry.code_generation_activity_count).toBe('number');
  });

  test('totals_by_language_feature breakdown is present', () => {
    const report = readMockReport('organization-users-28-day-report.json');
    const userWithLang = report.user_totals.find(u => u.totals_by_language_feature && u.totals_by_language_feature.length > 0);
    expect(userWithLang).toBeDefined();
    const langEntry = userWithLang!.totals_by_language_feature![0];
    expect(langEntry.language).toBeTruthy();
    expect(langEntry.feature).toBeTruthy();
  });
});

// ── Business logic ────────────────────────────────────────────────────────────

describe('User metrics business logic', () => {
  const mockUsers: UserTotals[] = [
    {
      login: 'alice',
      user_id: 1,
      total_active_days: 20,
      user_initiated_interaction_count: 400,
      code_generation_activity_count: 1000,
      code_acceptance_activity_count: 700,
      loc_suggested_to_add_sum: 4000,
      loc_suggested_to_delete_sum: 100,
      loc_added_sum: 2800,
      loc_deleted_sum: 70,
      premium_requests_total: 50
    },
    {
      login: 'bob',
      user_id: 2,
      total_active_days: 4,
      user_initiated_interaction_count: 80,
      code_generation_activity_count: 200,
      code_acceptance_activity_count: 120,
      loc_suggested_to_add_sum: 800,
      loc_suggested_to_delete_sum: 20,
      loc_added_sum: 500,
      loc_deleted_sum: 15,
      premium_requests_total: 0
    },
    {
      login: 'carol',
      user_id: 3,
      total_active_days: 0,
      user_initiated_interaction_count: 0,
      code_generation_activity_count: 0,
      code_acceptance_activity_count: 0,
      loc_suggested_to_add_sum: 0,
      loc_suggested_to_delete_sum: 0,
      loc_added_sum: 0,
      loc_deleted_sum: 0,
      premium_requests_total: 0
    }
  ];

  test('correctly identifies active users (≥ 7 days)', () => {
    const activeUsers = mockUsers.filter(u => u.total_active_days >= 7);
    expect(activeUsers).toHaveLength(1);
    expect(activeUsers[0].login).toBe('alice');
  });

  test('correctly identifies inactive users', () => {
    const inactiveUsers = mockUsers.filter(u => u.total_active_days === 0);
    expect(inactiveUsers).toHaveLength(1);
    expect(inactiveUsers[0].login).toBe('carol');
  });

  test('calculates total premium requests correctly', () => {
    const total = mockUsers.reduce((sum, u) => sum + (u.premium_requests_total ?? 0), 0);
    expect(total).toBe(50);
  });

  test('calculates acceptance rate correctly', () => {
    const alice = mockUsers[0];
    const rate = (alice.code_acceptance_activity_count / alice.code_generation_activity_count) * 100;
    expect(rate).toBeCloseTo(70, 1);
  });

  test('handles zero code generation gracefully', () => {
    const carol = mockUsers[2];
    const rate = carol.code_generation_activity_count === 0
      ? 0
      : (carol.code_acceptance_activity_count / carol.code_generation_activity_count) * 100;
    expect(rate).toBe(0);
  });

  test('filters users by premium requests', () => {
    const premiumUsers = mockUsers.filter(u => (u.premium_requests_total ?? 0) > 0);
    expect(premiumUsers).toHaveLength(1);
    expect(premiumUsers[0].login).toBe('alice');
  });
});

// ── Options.getUserMetricsMockDataPath() ─────────────────────────────────────

describe('Options.getUserMetricsMockDataPath()', () => {
  test('returns org path for organization scope', () => {
    const opts = new Options({ scope: 'organization', githubOrg: 'my-org' });
    expect(opts.getUserMetricsMockDataPath()).toContain('organization-users-28-day-report.json');
  });

  test('returns org path for team-organization scope', () => {
    const opts = new Options({ scope: 'team-organization', githubOrg: 'my-org', githubTeam: 'my-team' });
    expect(opts.getUserMetricsMockDataPath()).toContain('organization-users-28-day-report.json');
  });

  test('returns enterprise path for enterprise scope', () => {
    const opts = new Options({ scope: 'enterprise', githubEnt: 'my-ent' });
    expect(opts.getUserMetricsMockDataPath()).toContain('enterprise-users-28-day-report.json');
  });

  test('returns enterprise path for team-enterprise scope', () => {
    const opts = new Options({ scope: 'team-enterprise', githubEnt: 'my-ent', githubTeam: 'my-team' });
    expect(opts.getUserMetricsMockDataPath()).toContain('enterprise-users-28-day-report.json');
  });

  test('returns org path as default fallback', () => {
    const opts = new Options({});
    expect(opts.getUserMetricsMockDataPath()).toContain('organization-users-28-day-report.json');
  });
});

// ── UserTotals helper functions ───────────────────────────────────────────────

describe('User top-IDE and top-language helpers', () => {
  const userWithMultipleIdes: UserTotals = {
    login: 'dev',
    user_id: 10,
    total_active_days: 10,
    user_initiated_interaction_count: 100,
    code_generation_activity_count: 300,
    code_acceptance_activity_count: 200,
    loc_suggested_to_add_sum: 1000,
    loc_suggested_to_delete_sum: 20,
    loc_added_sum: 700,
    loc_deleted_sum: 10,
    totals_by_ide: [
      {
        ide: 'vscode',
        user_initiated_interaction_count: 80,
        code_generation_activity_count: 240,
        code_acceptance_activity_count: 160,
        loc_suggested_to_add_sum: 800,
        loc_suggested_to_delete_sum: 15,
        loc_added_sum: 560,
        loc_deleted_sum: 8
      },
      {
        ide: 'neovim',
        user_initiated_interaction_count: 20,
        code_generation_activity_count: 60,
        code_acceptance_activity_count: 40,
        loc_suggested_to_add_sum: 200,
        loc_suggested_to_delete_sum: 5,
        loc_added_sum: 140,
        loc_deleted_sum: 2
      }
    ],
    totals_by_language_feature: [
      {
        language: 'typescript',
        feature: 'code_completion',
        code_generation_activity_count: 180,
        code_acceptance_activity_count: 120,
        loc_suggested_to_add_sum: 600,
        loc_suggested_to_delete_sum: 12,
        loc_added_sum: 420,
        loc_deleted_sum: 6
      },
      {
        language: 'python',
        feature: 'code_completion',
        code_generation_activity_count: 90,
        code_acceptance_activity_count: 60,
        loc_suggested_to_add_sum: 300,
        loc_suggested_to_delete_sum: 6,
        loc_added_sum: 210,
        loc_deleted_sum: 3
      },
      {
        language: 'typescript',
        feature: 'copilot_chat_conversation',
        code_generation_activity_count: 30,
        code_acceptance_activity_count: 20,
        loc_suggested_to_add_sum: 100,
        loc_suggested_to_delete_sum: 2,
        loc_added_sum: 70,
        loc_deleted_sum: 1
      }
    ]
  };

  function getTopIde(user: UserTotals): string {
    if (!user.totals_by_ide || user.totals_by_ide.length === 0) return '—';
    const top = user.totals_by_ide.reduce((a, b) =>
      (a.user_initiated_interaction_count + a.code_generation_activity_count) >=
      (b.user_initiated_interaction_count + b.code_generation_activity_count) ? a : b
    );
    return top.ide;
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
      if (count > topCount) {
        topCount = count;
        topLang = lang;
      }
    }
    return topLang;
  }

  test('getTopIde returns IDE with most interactions', () => {
    expect(getTopIde(userWithMultipleIdes)).toBe('vscode');
  });

  test('getTopIde returns "—" for user with no IDE data', () => {
    const noIdeUser: UserTotals = { ...userWithMultipleIdes, totals_by_ide: [] };
    expect(getTopIde(noIdeUser)).toBe('—');
  });

  test('getTopLanguage returns language with most completions (aggregated across features)', () => {
    // typescript: 180 + 30 = 210, python: 90
    expect(getTopLanguage(userWithMultipleIdes)).toBe('typescript');
  });

  test('getTopLanguage returns "—" for user with no language data', () => {
    const noLangUser: UserTotals = { ...userWithMultipleIdes, totals_by_language_feature: [] };
    expect(getTopLanguage(noLangUser)).toBe('—');
  });
});

// ── Merging multiple download files ──────────────────────────────────────────

describe('User report merging (large enterprise multi-file support)', () => {
  test('merges user_totals from multiple report files', () => {
    const report1: UserReport = {
      report_start_day: '2026-02-04',
      report_end_day: '2026-03-03',
      organization_id: '100000001',
      user_totals: [
        { login: 'alice', user_id: 1, total_active_days: 20, user_initiated_interaction_count: 400, code_generation_activity_count: 1000, code_acceptance_activity_count: 700, loc_suggested_to_add_sum: 4000, loc_suggested_to_delete_sum: 100, loc_added_sum: 2800, loc_deleted_sum: 70 }
      ]
    };
    const report2: UserReport = {
      report_start_day: '2026-02-04',
      report_end_day: '2026-03-03',
      organization_id: '100000001',
      user_totals: [
        { login: 'bob', user_id: 2, total_active_days: 10, user_initiated_interaction_count: 200, code_generation_activity_count: 500, code_acceptance_activity_count: 300, loc_suggested_to_add_sum: 2000, loc_suggested_to_delete_sum: 50, loc_added_sum: 1400, loc_deleted_sum: 35 }
      ]
    };

    // Simulate the merging logic in fetchLatestUserReport
    const reports = [report1, report2];
    const merged: UserReport = { ...reports[0] };
    if (reports.length > 1) {
      merged.user_totals = reports.flatMap(r => r.user_totals);
    }

    expect(merged.user_totals).toHaveLength(2);
    expect(merged.user_totals.map(u => u.login)).toContain('alice');
    expect(merged.user_totals.map(u => u.login)).toContain('bob');
    expect(merged.report_start_day).toBe('2026-02-04');
    expect(merged.report_end_day).toBe('2026-03-03');
  });
});
