/**
 * Unit tests for the user-metrics-aggregator service.
 *
 * Validates that per-user records are correctly filtered by team membership
 * and aggregated into an OrgReport that matches expected totals.
 */

import { describe, it, expect } from 'vitest';
import { aggregateTeamMetrics } from '../server/services/user-metrics-aggregator';
import type { UserDayRecord } from '../server/services/github-copilot-usage-api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(
  login: string,
  id: number,
  day: string,
  overrides: Partial<UserDayRecord> = {}
): UserDayRecord {
  return {
    user_id: id,
    user_login: login,
    day,
    report_start_day: day,
    report_end_day: day,
    organization_id: 'org-1',
    enterprise_id: 'ent-1',
    user_initiated_interaction_count: 10,
    code_generation_activity_count: 40,
    code_acceptance_activity_count: 10,
    loc_suggested_to_add_sum: 200,
    loc_suggested_to_delete_sum: 0,
    loc_added_sum: 80,
    loc_deleted_sum: 5,
    totals_by_ide: [
      {
        ide: 'vscode',
        user_initiated_interaction_count: 10,
        code_generation_activity_count: 40,
        code_acceptance_activity_count: 10,
        loc_suggested_to_add_sum: 200,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 80,
        loc_deleted_sum: 5,
      },
    ],
    totals_by_feature: [
      {
        feature: 'code_completion',
        user_initiated_interaction_count: 0,
        code_generation_activity_count: 30,
        code_acceptance_activity_count: 10,
        loc_suggested_to_add_sum: 100,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 50,
        loc_deleted_sum: 0,
      },
      {
        feature: 'chat_panel_ask_mode',
        user_initiated_interaction_count: 10,
        code_generation_activity_count: 10,
        code_acceptance_activity_count: 0,
        loc_suggested_to_add_sum: 100,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 30,
        loc_deleted_sum: 5,
      },
    ],
    totals_by_language_feature: [
      {
        language: 'typescript',
        feature: 'code_completion',
        code_generation_activity_count: 20,
        code_acceptance_activity_count: 5,
        loc_suggested_to_add_sum: 50,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 20,
        loc_deleted_sum: 0,
      },
      {
        language: 'python',
        feature: 'code_completion',
        code_generation_activity_count: 10,
        code_acceptance_activity_count: 5,
        loc_suggested_to_add_sum: 50,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 30,
        loc_deleted_sum: 0,
      },
    ],
    totals_by_model_feature: [
      {
        model: 'gpt-5.3-codex',
        feature: 'code_completion',
        user_initiated_interaction_count: 0,
        code_generation_activity_count: 30,
        code_acceptance_activity_count: 10,
        loc_suggested_to_add_sum: 100,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 50,
        loc_deleted_sum: 0,
      },
    ],
    totals_by_language_model: [],
    used_agent: false,
    used_chat: false,
    used_cli: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aggregateTeamMetrics', () => {
  it('returns an empty OrgReport when no team members match', () => {
    const records = [makeUser('alice', 1, '2026-02-10'), makeUser('bob', 2, '2026-02-10')];
    const result = aggregateTeamMetrics(records, new Set(['charlie']));

    expect(result.day_totals).toHaveLength(0);
    expect(result.report_start_day).toBe('');
    expect(result.report_end_day).toBe('');
  });

  it('filters records to only team members', () => {
    const records = [
      makeUser('alice', 1, '2026-02-10'),
      makeUser('bob', 2, '2026-02-10'),
      makeUser('charlie', 3, '2026-02-10'),
    ];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'charlie']));

    expect(result.day_totals).toHaveLength(1);
    // 2 team members active on 2026-02-10
    expect(result.day_totals[0]!.daily_active_users).toBe(2);
  });

  it('sums scalar counts across team members for the same day', () => {
    const records = [
      makeUser('alice', 1, '2026-02-10'),
      makeUser('bob', 2, '2026-02-10'),
    ];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));

    const day = result.day_totals[0]!;
    expect(day.code_generation_activity_count).toBe(80);  // 40 + 40
    expect(day.code_acceptance_activity_count).toBe(20);  // 10 + 10
    expect(day.loc_suggested_to_add_sum).toBe(400);        // 200 + 200
    expect(day.loc_added_sum).toBe(160);                   // 80 + 80
    expect(day.user_initiated_interaction_count).toBe(20); // 10 + 10
  });

  it('groups records by day and sorts chronologically', () => {
    const records = [
      makeUser('alice', 1, '2026-02-12'),
      makeUser('alice', 1, '2026-02-10'),
      makeUser('bob', 2, '2026-02-10'),
      makeUser('bob', 2, '2026-02-11'),
    ];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));

    expect(result.day_totals).toHaveLength(3);
    expect(result.day_totals[0]!.day).toBe('2026-02-10');
    expect(result.day_totals[1]!.day).toBe('2026-02-11');
    expect(result.day_totals[2]!.day).toBe('2026-02-12');
  });

  it('sets report_start_day and report_end_day from day range', () => {
    const records = [
      makeUser('alice', 1, '2026-02-10'),
      makeUser('alice', 1, '2026-02-14'),
      makeUser('bob', 2, '2026-02-12'),
    ];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));

    expect(result.report_start_day).toBe('2026-02-10');
    expect(result.report_end_day).toBe('2026-02-14');
  });

  it('merges IDE totals by ide name across users', () => {
    const records = [
      makeUser('alice', 1, '2026-02-10'),
      makeUser('bob', 2, '2026-02-10', {
        totals_by_ide: [
          {
            ide: 'vscode',
            user_initiated_interaction_count: 5,
            code_generation_activity_count: 20,
            code_acceptance_activity_count: 5,
            loc_suggested_to_add_sum: 100,
            loc_suggested_to_delete_sum: 0,
            loc_added_sum: 40,
            loc_deleted_sum: 2,
          },
          {
            ide: 'visualstudio',
            user_initiated_interaction_count: 3,
            code_generation_activity_count: 10,
            code_acceptance_activity_count: 2,
            loc_suggested_to_add_sum: 50,
            loc_suggested_to_delete_sum: 0,
            loc_added_sum: 20,
            loc_deleted_sum: 0,
          },
        ],
      }),
    ];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));
    const day = result.day_totals[0]!;

    const vscode = day.totals_by_ide.find(i => i.ide === 'vscode');
    const vs = day.totals_by_ide.find(i => i.ide === 'visualstudio');

    expect(vscode).toBeDefined();
    expect(vs).toBeDefined();
    // alice vscode: 40 gen + bob vscode: 20 gen = 60
    expect(vscode!.code_generation_activity_count).toBe(60);
    // bob only: 10
    expect(vs!.code_generation_activity_count).toBe(10);
  });

  it('merges feature totals by feature name', () => {
    const records = [makeUser('alice', 1, '2026-02-10'), makeUser('bob', 2, '2026-02-10')];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));
    const day = result.day_totals[0]!;

    const completion = day.totals_by_feature.find(f => f.feature === 'code_completion');
    const chat = day.totals_by_feature.find(f => f.feature === 'chat_panel_ask_mode');

    expect(completion).toBeDefined();
    expect(chat).toBeDefined();
    // 2 users × 30 = 60
    expect(completion!.code_generation_activity_count).toBe(60);
    // 2 users × 10 = 20
    expect(chat!.user_initiated_interaction_count).toBe(20);
  });

  it('merges language-feature totals by language+feature key', () => {
    const records = [makeUser('alice', 1, '2026-02-10'), makeUser('bob', 2, '2026-02-10')];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));
    const day = result.day_totals[0]!;

    const tsCompletion = day.totals_by_language_feature.find(
      lf => lf.language === 'typescript' && lf.feature === 'code_completion'
    );
    const pyCompletion = day.totals_by_language_feature.find(
      lf => lf.language === 'python' && lf.feature === 'code_completion'
    );

    expect(tsCompletion).toBeDefined();
    expect(pyCompletion).toBeDefined();
    // 2 users × 20 = 40
    expect(tsCompletion!.code_generation_activity_count).toBe(40);
    // 2 users × 10 = 20
    expect(pyCompletion!.code_generation_activity_count).toBe(20);
  });

  it('merges model-feature totals by model+feature key', () => {
    const records = [makeUser('alice', 1, '2026-02-10'), makeUser('bob', 2, '2026-02-10')];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));
    const day = result.day_totals[0]!;

    const model = day.totals_by_model_feature.find(
      mf => mf.model === 'gpt-5.3-codex' && mf.feature === 'code_completion'
    );
    expect(model).toBeDefined();
    // 2 users × 30 = 60
    expect(model!.code_generation_activity_count).toBe(60);
  });

  it('counts chat and agent users from used_chat/used_agent flags', () => {
    const records = [
      makeUser('alice', 1, '2026-02-10', { used_chat: true, used_agent: true }),
      makeUser('bob', 2, '2026-02-10', { used_chat: false, used_agent: false }),
      makeUser('charlie', 3, '2026-02-10', { used_chat: true, used_agent: false }),
    ];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob', 'charlie']));
    const day = result.day_totals[0]!;

    expect(day.monthly_active_chat_users).toBe(2);
    expect(day.monthly_active_agent_users).toBe(1);
    expect(day.daily_active_users).toBe(3);
  });

  it('preserves organization_id and enterprise_id from first record', () => {
    const records = [makeUser('alice', 1, '2026-02-10')];
    const result = aggregateTeamMetrics(records, new Set(['alice']));

    expect(result.organization_id).toBe('org-1');
    expect(result.enterprise_id).toBe('ent-1');
  });

  it('handles a single user with multiple days', () => {
    const records = [
      makeUser('alice', 1, '2026-02-10'),
      makeUser('alice', 1, '2026-02-11'),
      makeUser('alice', 1, '2026-02-12'),
    ];
    const result = aggregateTeamMetrics(records, new Set(['alice']));

    expect(result.day_totals).toHaveLength(3);
    result.day_totals.forEach(day => {
      expect(day.daily_active_users).toBe(1);
      expect(day.code_generation_activity_count).toBe(40);
    });
  });

  it('returns separate days when different users are active on different days', () => {
    // alice only on day 1, bob only on day 2
    const records = [
      makeUser('alice', 1, '2026-02-10'),
      makeUser('bob', 2, '2026-02-11'),
    ];
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));

    expect(result.day_totals).toHaveLength(2);
    expect(result.day_totals[0]!.daily_active_users).toBe(1);
    expect(result.day_totals[1]!.daily_active_users).toBe(1);
  });

  it('matches team members case-insensitively', () => {
    const records = [
      makeUser('Alice', 1, '2026-02-10'),
      makeUser('BOB', 2, '2026-02-10'),
      makeUser('charlie', 3, '2026-02-10'),
    ];
    // Team logins in different casing than user records
    const result = aggregateTeamMetrics(records, new Set(['alice', 'bob']));

    expect(result.day_totals).toHaveLength(1);
    expect(result.day_totals[0]!.daily_active_users).toBe(2);
  });
});
