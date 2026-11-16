import { describe, it, expect } from 'vitest';
import {
  summarizeTeam, safePct, adoptionPct, agentLoc, editorSharePct, modelSharePct,
  trendWithinRange, weeklyAdoption, weekStartOf,
} from '../app/utils/teamMetrics';
import type { ReportDayTotals } from '../server/services/github-copilot-usage-api';

function day(date: string, overrides: Partial<ReportDayTotals> = {}): ReportDayTotals {
  return {
    day: date,
    daily_active_users: 0,
    weekly_active_users: 0,
    monthly_active_users: 0,
    user_initiated_interaction_count: 0,
    code_generation_activity_count: 0,
    code_acceptance_activity_count: 0,
    loc_added_sum: 0,
    ...overrides,
  } as ReportDayTotals;
}

describe('safePct', () => {
  it('returns null for an unknown or zero denominator', () => {
    expect(safePct(5, 0)).toBeNull();
    expect(safePct(5, -1)).toBeNull();
  });

  it('computes a percentage otherwise', () => {
    expect(safePct(1, 4)).toBe(25);
  });
});

describe('adoptionPct', () => {
  it('saturates at 100% rather than reporting impossible adoption', () => {
    expect(adoptionPct(12, 8)).toBe(100);
  });

  it('passes through a normal share and an unknown denominator', () => {
    expect(adoptionPct(2, 8)).toBe(25);
    expect(adoptionPct(2, 0)).toBeNull();
  });
});

describe('summarizeTeam', () => {
  it('chooses adoption windows from calendar range, not sparse activity row count', () => {
    const sparse = [
      day('2026-03-01', { daily_active_users: 1 }),
      day('2026-03-28', {
        daily_active_users: 1, weekly_active_users: 1, monthly_active_users: 2,
        weekly_active_agent_users: 1, monthly_active_agent_users: 2,
        weekly_active_cli_users: 1, monthly_active_cli_users: 2,
        weekly_active_vscode_agent_users: 1, monthly_active_vscode_agent_users: 2,
      }),
    ];
    expect(summarizeTeam(sparse, 2).copilotAdoptionPct).toBe(100);
    const range = { since: '2026-03-01', until: '2026-03-28' };
    const summary = summarizeTeam(sparse.slice(1), 2, range);
    expect([summary.copilotAdoptionPct, summary.agentAdoptionPct, summary.cliAdoptionPct, summary.vscodeAgentAdoptionPct])
      .toEqual([100, 100, 100, 100]);
    expect(summarizeTeam(sparse.slice(1), 2, { since: '2026-03-22', until: '2026-03-28' }).copilotAdoptionPct).toBe(50);
    expect(summarizeTeam([], 0, range).copilotAdoptionPct).toBeNull();
  });
  const days = [
    day('2024-05-01', {
      daily_active_users: 3,
      loc_added_sum: 100,
      code_generation_activity_count: 10,
      code_acceptance_activity_count: 4,
      user_initiated_interaction_count: 20,
    }),
    day('2024-05-02', {
      daily_active_users: 5,
      loc_added_sum: 300,
      code_generation_activity_count: 30,
      code_acceptance_activity_count: 11,
      user_initiated_interaction_count: 40,
      weekly_active_users: 8,
      weekly_active_agent_users: 4,
      weekly_active_cli_users: 2,
      weekly_active_vscode_agent_users: 3,
      totals_by_cli: { session_count: 7, request_count: 19 },
    } as Partial<ReportDayTotals>),
  ];

  it('sums lines of code and per-person figures over the range', () => {
    const summary = summarizeTeam(days, 10);
    expect(summary.aiLoc).toBe(400);
    expect(summary.aiLocPerPerson).toBe(40);
  });

  it('weights the acceptance rate by activity rather than averaging daily rates', () => {
    // 15 acceptances / 40 generations, not mean(40%, 36.6%).
    expect(summarizeTeam(days, 10).acceptanceRatePct).toBeCloseTo(37.5, 5);
  });

  it('reads active users from the latest day in range', () => {
    const summary = summarizeTeam(days, 10);
    expect(summary.activeUsers).toBe(5);
    expect(summary.activeUsersPct).toBe(50);
  });

  it('uses the 7-day rolling window for short ranges', () => {
    const summary = summarizeTeam(days, 10);
    expect(summary.copilotAdoptionPct).toBe(80);
    expect(summary.agentAdoptionPct).toBe(40);
    expect(summary.cliAdoptionPct).toBe(20);
    expect(summary.vscodeAgentAdoptionPct).toBe(30);
  });

  it('prefers the 28-day window once the range exceeds a week', () => {
    const longRange = Array.from({ length: 10 }, (_, i) =>
      day(`2024-05-${String(i + 1).padStart(2, '0')}`)
    );
    longRange[9] = day('2024-05-10', {
      weekly_active_agent_users: 1,
      monthly_active_agent_users: 6,
    } as Partial<ReportDayTotals>);

    expect(summarizeTeam(longRange, 12).agentAdoptionPct).toBe(50);
  });

  it('caps adoption at 100% when the rolling window includes former members', () => {
    const shrunk = summarizeTeam(days, 4); // 8 weekly active users, only 4 current members
    expect(shrunk.copilotAdoptionPct).toBe(100);
    expect(shrunk.activeUsersPct).toBe(100);
    // Non-adoption metrics are not capped.
    expect(shrunk.aiLocPerPerson).toBe(100);
  });

  it('returns null percentages when the member count is unknown', () => {
    const summary = summarizeTeam(days, 0);
    expect(summary.aiLocPerPerson).toBeNull();
    expect(summary.activeUsersPct).toBeNull();
    expect(summary.copilotAdoptionPct).toBeNull();
    expect(summary.agentAdoptionPct).toBeNull();
    expect(summary.cliAdoptionPct).toBeNull();
  });

  it('aggregates CLI session and request totals', () => {
    const summary = summarizeTeam(days, 10);
    expect(summary.cliSessions).toBe(7);
    expect(summary.cliRequests).toBe(19);
  });

  it('handles an empty range without dividing by zero', () => {
    const summary = summarizeTeam([], 10);
    expect(summary.aiLoc).toBe(0);
    expect(summary.activeUsers).toBe(0);
    expect(summary.acceptanceRatePct).toBeNull();
    expect(summary.agentLocSharePct).toBeNull();
  });
});

describe('agentLoc', () => {
  it('counts only direct file edits, not copied code blocks from agent chat', () => {
    const days = [
      day('2024-05-01', {
        loc_added_sum: 500,
        totals_by_feature: [
          { feature: 'agent_edit', loc_added_sum: 150 },
          { feature: 'chat_panel_agent_mode', loc_added_sum: 50 },
          { feature: 'code_completion', loc_added_sum: 200 },
          { feature: 'chat_inline', loc_added_sum: 100 },
        ],
      } as Partial<ReportDayTotals>),
    ];
    expect(agentLoc(days)).toBe(150);
    expect(summarizeTeam(days, 5).agentLocSharePct).toBe(30);
  });
});

describe('editorSharePct / modelSharePct', () => {
  const days = [
    day('2024-05-01', {
      totals_by_ide: [
        { ide: 'vscode', user_initiated_interaction_count: 30 },
        { ide: 'jetbrains', user_initiated_interaction_count: 10 },
      ],
      totals_by_model_feature: [
        { model: 'gpt-4o', user_initiated_interaction_count: 15 },
        { model: 'claude', user_initiated_interaction_count: 5 },
      ],
    } as Partial<ReportDayTotals>),
  ];

  it('normalizes editor usage to shares that sum to 100', () => {
    const shares = editorSharePct(days);
    expect(shares.vscode).toBe(75);
    expect(shares.jetbrains).toBe(25);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  it('normalizes model usage to shares that sum to 100', () => {
    const shares = modelSharePct(days);
    expect(shares['gpt-4o']).toBe(75);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  it('returns an empty map when there is no activity', () => {
    expect(editorSharePct([day('2024-05-01')])).toEqual({});
    expect(modelSharePct([])).toEqual({});
  });
});

describe('trendWithinRange', () => {
  const locOf = (s: { aiLoc: number }) => s.aiLoc;

  it('reports an upward trend when the later half is larger', () => {
    const days = [
      day('2024-05-01', { loc_added_sum: 10 }),
      day('2024-05-02', { loc_added_sum: 20 }),
    ];
    const trend = trendWithinRange(days, locOf, 5);
    expect(trend.direction).toBe('up');
    expect(trend.changePct).toBe(100);
  });

  it('reports a downward trend when the later half is smaller', () => {
    const days = [
      day('2024-05-01', { loc_added_sum: 20 }),
      day('2024-05-02', { loc_added_sum: 5 }),
    ];
    expect(trendWithinRange(days, locOf, 5).direction).toBe('down');
  });

  it('is flat for equal halves and for a single day', () => {
    const equal = [
      day('2024-05-01', { loc_added_sum: 10 }),
      day('2024-05-02', { loc_added_sum: 10 }),
    ];
    expect(trendWithinRange(equal, locOf, 5)).toEqual({ direction: 'flat', changePct: 0 });
    expect(trendWithinRange([day('2024-05-01')], locOf, 5).direction).toBe('flat');
  });

  it('avoids dividing by a zero baseline', () => {
    const days = [
      day('2024-05-01', { loc_added_sum: 0 }),
      day('2024-05-02', { loc_added_sum: 50 }),
    ];
    const trend = trendWithinRange(days, locOf, 5);
    expect(trend.direction).toBe('up');
    expect(trend.changePct).toBeNull();
  });

  it('sorts unordered days before splitting the range', () => {
    const unordered = [
      day('2024-05-02', { loc_added_sum: 40 }),
      day('2024-05-01', { loc_added_sum: 10 }),
    ];
    expect(trendWithinRange(unordered, locOf, 5).direction).toBe('up');
  });
});

describe('weekStartOf', () => {
  it('snaps any day back to the Monday of its week', () => {
    expect(weekStartOf('2024-05-01')).toBe('2024-04-29'); // Wednesday
    expect(weekStartOf('2024-04-29')).toBe('2024-04-29'); // Monday
    expect(weekStartOf('2024-05-05')).toBe('2024-04-29'); // Sunday
  });
});

describe('weeklyAdoption', () => {
  it('buckets days into weeks and reads the rolling window from each week end', () => {
    const days = [
      day('2024-04-29', { weekly_active_agent_users: 1 } as Partial<ReportDayTotals>),
      day('2024-05-05', { weekly_active_agent_users: 4 } as Partial<ReportDayTotals>),
      day('2024-05-06', { weekly_active_agent_users: 6 } as Partial<ReportDayTotals>),
    ];
    const weeks = weeklyAdoption(days, 'agent', 10);
    expect(weeks).toEqual([
      { weekStart: '2024-04-29', adoptionPct: 40 },
      { weekStart: '2024-05-06', adoptionPct: 60 },
    ]);
  });

  it('yields null rather than a misleading zero when the team size is unknown', () => {
    const weeks = weeklyAdoption([day('2024-05-01')], 'cli', 0);
    expect(weeks).toEqual([{ weekStart: '2024-04-29', adoptionPct: null }]);
  });

  it('returns nothing for an empty range', () => {
    expect(weeklyAdoption([], 'copilot', 10)).toEqual([]);
  });
});
