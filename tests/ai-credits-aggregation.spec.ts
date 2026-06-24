/**
 * Tests for the ai_credits_used field on UserTotals.
 *
 * GitHub started returning ai_credits_used on users-1-day / users-28-day
 * Copilot metrics reports on 2026-06-19. The aggregator must:
 *   1. Sum it across days for a user.
 *   2. Distinguish "no data" (undefined) from "explicit zero" (0) so the UI
 *      can render an em-dash for older reports without billing data.
 *   3. Continue to work when only some day records include the field.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateUserDayRecords,
  type UserDayRecord,
} from '../server/services/github-copilot-usage-api';

function dayRecord(
  login: string,
  day: string,
  ai_credits_used?: number
): UserDayRecord {
  return {
    user_id: 1,
    user_login: login,
    day,
    report_start_day: day,
    report_end_day: day,
    organization_id: 'org-1',
    enterprise_id: 'ent-1',
    user_initiated_interaction_count: 1,
    code_generation_activity_count: 1,
    code_acceptance_activity_count: 1,
    loc_suggested_to_add_sum: 1,
    loc_suggested_to_delete_sum: 0,
    loc_added_sum: 1,
    loc_deleted_sum: 0,
    ...(ai_credits_used !== undefined ? { ai_credits_used } : {}),
  };
}

describe('aggregateUserDayRecords — ai_credits_used', () => {
  it('sums ai_credits_used across days for a single user', () => {
    const result = aggregateUserDayRecords([
      dayRecord('alice', '2026-06-20', 3.5),
      dayRecord('alice', '2026-06-21', 2.5),
      dayRecord('alice', '2026-06-22', 1.0),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.login).toBe('alice');
    expect(result[0]?.ai_credits_used).toBe(7);
  });

  it('leaves ai_credits_used undefined when no day record provides it', () => {
    const result = aggregateUserDayRecords([
      dayRecord('bob', '2026-05-01'),
      dayRecord('bob', '2026-05-02'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.ai_credits_used).toBeUndefined();
  });

  it('treats explicit zero as data (sum of zeros is 0, not undefined)', () => {
    const result = aggregateUserDayRecords([
      dayRecord('carol', '2026-06-20', 0),
      dayRecord('carol', '2026-06-21', 0),
    ]);

    expect(result[0]?.ai_credits_used).toBe(0);
  });

  it('sums only the days that include the field (older + newer mix)', () => {
    const result = aggregateUserDayRecords([
      dayRecord('dave', '2026-06-18'),       // pre-rollout, no field
      dayRecord('dave', '2026-06-19', 1.25), // rollout day
      dayRecord('dave', '2026-06-20', 0.75),
    ]);

    expect(result[0]?.ai_credits_used).toBe(2);
  });

  it('aggregates ai_credits_used per user independently', () => {
    const result = aggregateUserDayRecords([
      { ...dayRecord('eve', '2026-06-20', 5), user_id: 100 },
      { ...dayRecord('frank', '2026-06-20', 8), user_id: 200 },
      { ...dayRecord('eve', '2026-06-21', 2), user_id: 100 },
    ]);

    const eve = result.find(u => u.login === 'eve');
    const frank = result.find(u => u.login === 'frank');
    expect(eve?.ai_credits_used).toBe(7);
    expect(frank?.ai_credits_used).toBe(8);
  });
});
