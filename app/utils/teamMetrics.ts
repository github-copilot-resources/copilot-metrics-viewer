/**
 * Pure derivations for team-level Copilot metrics.
 *
 * Kept out of the Vue components so the arithmetic behind the Teams tab's
 * leaderboard, scorecards and heatmap can be unit tested directly.
 *
 * DENOMINATORS
 * ------------
 * Adoption percentages divide by the team's current member count, not by
 * licensed seats. Per-person figures do the same. A team whose member count
 * is unknown (0) yields `null` rather than a division by zero — callers render
 * that as an em dash.
 *
 * ADOPTION NUMERATORS
 * -------------------
 * Per-day report rows expose active-user *counts*, never identities, so a true
 * "distinct users across an arbitrary range" figure cannot be recomputed on the
 * client (and exposing identities would conflict with the user-level privacy
 * gate). Instead the rolling distinct-user windows the server already computes
 * are read from the last day in range: the 28-day window for ranges longer than
 * a week, the 7-day window otherwise.
 */

import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';

/** Ranges longer than this use the 28-day rolling window for adoption. */
const WEEKLY_WINDOW_MAX_DAYS = 7;

export interface TeamMetricSummary {
  /** Lines of code added by Copilot over the range. */
  aiLoc: number;
  /** {@link aiLoc} per team member; null when the team size is unknown. */
  aiLocPerPerson: number | null;
  /**
   * Share of Copilot-added lines from direct Agent/Edit-mode file edits.
   *
   * NOTE: the denominator is Copilot's own output, NOT all code the team
   * wrote — the Copilot API reports no human-authored line counts.
   */
  agentLocSharePct: number | null;
  /** Weighted code acceptance rate over the range. */
  acceptanceRatePct: number | null;
  /** Active users on the most recent day in range. */
  activeUsers: number;
  activeUsersPct: number | null;
  copilotAdoptionPct: number | null;
  agentAdoptionPct: number | null;
  cliAdoptionPct: number | null;
  vscodeAgentUsers: number;
  vscodeAgentAdoptionPct: number | null;
  /** Distinct CLI users in the rolling window. */
  cliUsers: number;
  cliSessions: number;
  cliRequests: number;
  totalInteractions: number;
  memberCount: number;
}

function sumBy(days: ReportDayTotals[], pick: (day: ReportDayTotals) => number | undefined): number {
  return days.reduce((total, day) => total + (pick(day) || 0), 0);
}

/** Percentage guarded against an unknown or zero denominator. */
export function safePct(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * Share of the team's *current* members, capped at 100%.
 *
 * The rolling active-user windows count everyone who was active during the
 * window, including people who have since left the team, so the raw ratio can
 * exceed the current member count. "More than all of the team adopted Copilot"
 * is not a meaningful statement, so the share saturates at 100%.
 */
export function adoptionPct(activeUsers: number, memberCount: number): number | null {
  const pct = safePct(activeUsers, memberCount);
  return pct === null ? null : Math.min(pct, 100);
}

function lastDay(days: ReportDayTotals[]): ReportDayTotals | undefined {
  if (days.length === 0) return undefined;
  return [...days].sort((a, b) => a.day.localeCompare(b.day)).at(-1);
}

function dateRangeDays(days: ReportDayTotals[], since?: string, until?: string): number {
  const firstDay = since ?? days.reduce<string | undefined>((first, day) => first && first < day.day ? first : day.day, undefined);
  const finalDay = until ?? days.reduce<string | undefined>((last, day) => last && last > day.day ? last : day.day, undefined);
  if (!firstDay || !finalDay || finalDay < firstDay) return days.length;
  const span = Date.parse(`${finalDay}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`);
  return Number.isFinite(span) ? Math.floor(span / 86400000) + 1 : days.length;
}

/**
 * Read a rolling distinct-user count from the last day in range, choosing the
 * 7-day or 28-day window based on how long the range actually is.
 */
function rollingUsers(
  days: ReportDayTotals[],
  weeklyKey: keyof ReportDayTotals,
  monthlyKey: keyof ReportDayTotals,
  rangeDays: number
): number {
  const last = lastDay(days);
  if (!last) return 0;
  const key = rangeDays <= WEEKLY_WINDOW_MAX_DAYS ? weeklyKey : monthlyKey;
  return (last[key] as number | undefined) ?? (last[monthlyKey] as number | undefined) ?? 0;
}

/** Direct Agent/Edit-mode file additions; excludes code blocks copied from chat. */
export function agentLoc(days: ReportDayTotals[]): number {
  return days.reduce((total, day) => {
    const agentFeatures = (day.totals_by_feature ?? []).filter(f => f.feature === 'agent_edit');
    return total + agentFeatures.reduce((sum, f) => sum + (f.loc_added_sum || 0), 0);
  }, 0);
}

export function agentLocSharePct(days: ReportDayTotals[]): number | null {
  return safePct(agentLoc(days), sumBy(days, day => day.loc_added_sum));
}

export function summarizeTeam(
  days: ReportDayTotals[],
  memberCount: number,
  since?: string,
  until?: string
): TeamMetricSummary {
  const aiLoc = sumBy(days, d => d.loc_added_sum);
  const generations = sumBy(days, d => d.code_generation_activity_count);
  const acceptances = sumBy(days, d => d.code_acceptance_activity_count);
  const activeUsers = lastDay(days)?.daily_active_users ?? 0;
  const rangeDays = dateRangeDays(days, since, until);

  const copilotUsers = rollingUsers(days, 'weekly_active_users', 'monthly_active_users', rangeDays);
  const agentUsers = rollingUsers(days, 'weekly_active_agent_users', 'monthly_active_agent_users', rangeDays);
  const cliUsers = rollingUsers(days, 'weekly_active_cli_users', 'monthly_active_cli_users', rangeDays);
  const vscodeAgentUsers = rollingUsers(
    days, 'weekly_active_vscode_agent_users', 'monthly_active_vscode_agent_users', rangeDays
  );

  return {
    aiLoc,
    aiLocPerPerson: memberCount > 0 ? aiLoc / memberCount : null,
    agentLocSharePct: agentLocSharePct(days),
    acceptanceRatePct: safePct(acceptances, generations),
    activeUsers,
    activeUsersPct: adoptionPct(activeUsers, memberCount),
    copilotAdoptionPct: adoptionPct(copilotUsers, memberCount),
    agentAdoptionPct: adoptionPct(agentUsers, memberCount),
    cliAdoptionPct: adoptionPct(cliUsers, memberCount),
    vscodeAgentUsers,
    vscodeAgentAdoptionPct: adoptionPct(vscodeAgentUsers, memberCount),
    cliUsers,
    cliSessions: sumBy(days, d => d.totals_by_cli?.session_count),
    cliRequests: sumBy(days, d => d.totals_by_cli?.request_count),
    totalInteractions: sumBy(days, d => d.user_initiated_interaction_count),
    memberCount,
  };
}

/**
 * Distribute a team's interactions across editors as percentages, so teams of
 * different sizes are comparable. Shares sum to 100 when any activity exists.
 */
export function editorSharePct(days: ReportDayTotals[]): Record<string, number> {
  const byEditor: Record<string, number> = {};
  for (const day of days) {
    for (const ide of day.totals_by_ide ?? []) {
      byEditor[ide.ide] = (byEditor[ide.ide] ?? 0) + (ide.user_initiated_interaction_count || 0);
    }
  }
  return toShares(byEditor);
}

/** As {@link editorSharePct}, but across models. */
export function modelSharePct(days: ReportDayTotals[]): Record<string, number> {
  const byModel: Record<string, number> = {};
  for (const day of days) {
    for (const mf of day.totals_by_model_feature ?? []) {
      byModel[mf.model] = (byModel[mf.model] ?? 0) + (mf.user_initiated_interaction_count || 0);
    }
  }
  return toShares(byModel);
}

function toShares(totals: Record<string, number>): Record<string, number> {
  const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (grandTotal <= 0) return {};
  const shares: Record<string, number> = {};
  for (const [key, value] of Object.entries(totals)) {
    shares[key] = (value / grandTotal) * 100;
  }
  return shares;
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface Trend {
  direction: TrendDirection;
  /** Percentage change against the earlier half; null when it was zero. */
  changePct: number | null;
}

/**
 * Compare the later half of the selected range against the earlier half.
 *
 * Deliberately derived from data already on hand rather than re-fetching a
 * preceding period, which would double every team's API cost. Labelled in the
 * UI as "vs first half of range" so it is not mistaken for a period-over-period
 * comparison.
 */
export function trendWithinRange(
  days: ReportDayTotals[],
  metric: (summary: TeamMetricSummary) => number | null,
  memberCount: number
): Trend {
  if (days.length < 2) return { direction: 'flat', changePct: null };

  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const midpoint = Math.floor(sorted.length / 2);
  const earlier = metric(summarizeTeam(sorted.slice(0, midpoint), memberCount));
  const later = metric(summarizeTeam(sorted.slice(midpoint), memberCount));

  if (earlier === null || later === null) return { direction: 'flat', changePct: null };
  if (earlier === later) return { direction: 'flat', changePct: 0 };
  if (earlier === 0) return { direction: later > 0 ? 'up' : 'flat', changePct: null };

  const changePct = ((later - earlier) / Math.abs(earlier)) * 100;
  return { direction: changePct > 0 ? 'up' : 'down', changePct };
}

/**
 * Group days into calendar weeks (Monday start) and return each week's adoption
 * percentage for the heatmap. Weeks with no data yield null so the grid can
 * show an explicit gap rather than a misleading zero.
 */
export function weeklyAdoption(
  days: ReportDayTotals[],
  metricKey: 'copilot' | 'agent' | 'cli' | 'vscodeAgent',
  memberCount: number
): { weekStart: string; adoptionPct: number | null }[] {
  const weeklyKeys = {
    copilot: 'weekly_active_users',
    agent: 'weekly_active_agent_users',
    cli: 'weekly_active_cli_users',
    vscodeAgent: 'weekly_active_vscode_agent_users',
  } as const;

  const byWeek = new Map<string, ReportDayTotals[]>();
  for (const day of days) {
    const start = weekStartOf(day.day);
    byWeek.set(start, [...(byWeek.get(start) ?? []), day]);
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, weekDays]) => {
      // The last day of the week carries the complete 7-day rolling window.
      const last = lastDay(weekDays);
      const users = (last?.[weeklyKeys[metricKey]] as number | undefined) ?? 0;
      return { weekStart, adoptionPct: adoptionPct(users, memberCount) };
    });
}

export function weekStartOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().split('T')[0]!;
}
