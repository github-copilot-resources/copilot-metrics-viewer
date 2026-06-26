/**
 * Coverage for the per-user aggregator extensions:
 *   - totals_by_cli (sessions, requests, prompt/output tokens, latest CLI version)
 *   - ai_adoption_phase (most-recent value across the window)
 *   - totals_by_ide last_known_plugin_version / last_known_ide_version (latest by sampled_at)
 *
 * These fields are added to UserDayRecord / UserTotals so the My Usage and
 * User Metrics tabs can surface tokens, adoption phase, and version drift.
 */

import { describe, it, expect } from 'vitest';
import { aggregateUserDayRecords, type UserDayRecord } from '../server/services/github-copilot-usage-api';

const baseDay = (overrides: Partial<UserDayRecord> = {}): UserDayRecord => ({
  report_start_day: '2026-06-20',
  report_end_day: '2026-06-22',
  day: '2026-06-20',
  organization_id: '1',
  enterprise_id: '1',
  user_id: 100,
  user_login: 'alice',
  user_initiated_interaction_count: 1,
  code_generation_activity_count: 0,
  code_acceptance_activity_count: 0,
  loc_suggested_to_add_sum: 0,
  loc_suggested_to_delete_sum: 0,
  loc_added_sum: 0,
  loc_deleted_sum: 0,
  ...overrides,
});

describe('aggregateUserDayRecords — CLI token aggregation', () => {
  it('sums session/request/prompt counts and prompt/output tokens across days', () => {
    const records: UserDayRecord[] = [
      baseDay({
        day: '2026-06-20',
        totals_by_cli: {
          session_count: 2,
          request_count: 4,
          prompt_count: 1,
          token_usage: { prompt_tokens_sum: 100, output_tokens_sum: 50, avg_tokens_per_request: 37.5 },
          last_known_cli_version: { sampled_at: '2026-06-20T10:00:00Z', cli_version: '0.0.410' },
        },
      }),
      baseDay({
        day: '2026-06-21',
        totals_by_cli: {
          session_count: 3,
          request_count: 6,
          prompt_count: 2,
          token_usage: { prompt_tokens_sum: 200, output_tokens_sum: 100, avg_tokens_per_request: 50 },
          last_known_cli_version: { sampled_at: '2026-06-21T15:00:00Z', cli_version: '0.0.411' },
        },
      }),
    ];

    const [alice] = aggregateUserDayRecords(records);
    expect(alice).toBeDefined();
    expect(alice!.totals_by_cli).toBeDefined();
    expect(alice!.totals_by_cli!.session_count).toBe(5);
    expect(alice!.totals_by_cli!.request_count).toBe(10);
    expect(alice!.totals_by_cli!.prompt_count).toBe(3);
    expect(alice!.totals_by_cli!.token_usage!.prompt_tokens_sum).toBe(300);
    expect(alice!.totals_by_cli!.token_usage!.output_tokens_sum).toBe(150);
    // avg = (prompt + output) / request_count = 450 / 10 = 45
    expect(alice!.totals_by_cli!.token_usage!.avg_tokens_per_request).toBe(45);
    // Latest sampled_at wins
    expect(alice!.totals_by_cli!.last_known_cli_version!.cli_version).toBe('0.0.411');
  });

  it('leaves totals_by_cli undefined when no day had CLI data', () => {
    const records: UserDayRecord[] = [baseDay({})];
    const [alice] = aggregateUserDayRecords(records);
    expect(alice!.totals_by_cli).toBeUndefined();
  });

  it('handles day with CLI but no token_usage gracefully', () => {
    const records: UserDayRecord[] = [
      baseDay({ totals_by_cli: { session_count: 1, request_count: 0, prompt_count: 0 } }),
    ];
    const [alice] = aggregateUserDayRecords(records);
    expect(alice!.totals_by_cli).toBeDefined();
    expect(alice!.totals_by_cli!.token_usage).toBeUndefined();
  });
});

describe('aggregateUserDayRecords — adoption phase', () => {
  it('picks the most recent day\'s ai_adoption_phase', () => {
    const records: UserDayRecord[] = [
      baseDay({ day: '2026-06-20', ai_adoption_phase: { phase_number: 2, phase: 'Phase 2', version: 'v1' } }),
      baseDay({ day: '2026-06-22', ai_adoption_phase: { phase_number: 3, phase: 'Phase 3', version: 'v1' } }),
      baseDay({ day: '2026-06-21', ai_adoption_phase: { phase_number: 2, phase: 'Phase 2', version: 'v1' } }),
    ];
    const [alice] = aggregateUserDayRecords(records);
    expect(alice!.ai_adoption_phase?.phase_number).toBe(3);
  });

  it('leaves ai_adoption_phase undefined when no day reported one', () => {
    const records: UserDayRecord[] = [baseDay({})];
    const [alice] = aggregateUserDayRecords(records);
    expect(alice!.ai_adoption_phase).toBeUndefined();
  });
});

describe('aggregateUserDayRecords — IDE version freshness', () => {
  it('keeps the latest last_known_plugin_version and last_known_ide_version per IDE', () => {
    const records: UserDayRecord[] = [
      baseDay({
        day: '2026-06-20',
        totals_by_ide: [{
          ide: 'vscode',
          user_initiated_interaction_count: 1,
          code_generation_activity_count: 0,
          code_acceptance_activity_count: 0,
          loc_suggested_to_add_sum: 0,
          loc_suggested_to_delete_sum: 0,
          loc_added_sum: 0,
          loc_deleted_sum: 0,
          last_known_plugin_version: { sampled_at: '2026-06-20T10:00:00Z', plugin: 'copilot-chat', plugin_version: '0.53.0' },
          last_known_ide_version: { sampled_at: '2026-06-20T10:00:00Z', ide_version: '1.125.0' },
        }],
      }),
      baseDay({
        day: '2026-06-22',
        totals_by_ide: [{
          ide: 'vscode',
          user_initiated_interaction_count: 1,
          code_generation_activity_count: 0,
          code_acceptance_activity_count: 0,
          loc_suggested_to_add_sum: 0,
          loc_suggested_to_delete_sum: 0,
          loc_added_sum: 0,
          loc_deleted_sum: 0,
          last_known_plugin_version: { sampled_at: '2026-06-22T15:00:00Z', plugin: 'copilot-chat', plugin_version: '0.54.0' },
          last_known_ide_version: { sampled_at: '2026-06-22T15:00:00Z', ide_version: '1.126.0' },
        }],
      }),
    ];
    const [alice] = aggregateUserDayRecords(records);
    const vscode = alice!.totals_by_ide?.find(i => i.ide === 'vscode');
    expect(vscode?.last_known_plugin_version?.plugin_version).toBe('0.54.0');
    expect(vscode?.last_known_ide_version?.ide_version).toBe('1.126.0');
    // Interactions still summed
    expect(vscode?.user_initiated_interaction_count).toBe(2);
  });
});
