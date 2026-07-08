/**
 * Aggregates per-user Copilot metrics for a specific team.
 *
 * The new Copilot Metrics API does not offer team-level endpoints. Instead,
 * team metrics are derived by:
 *   1. Fetching the per-user report (users-28-day/latest)
 *   2. Filtering records to only team members (by login)
 *   3. Grouping the filtered records by day
 *   4. Summing each day's values across all team members
 *
 * The resulting OrgReport has the same structure as a standard aggregated
 * report and can flow through the existing transform pipeline unchanged.
 */

import type {
  UserDayRecord,
  OrgReport,
  ReportDayTotals,
  ReportIdeTotals,
  ReportFeatureTotals,
  ReportLanguageFeatureTotals,
  ReportLanguageModelTotals,
  ReportModelFeatureTotals,
  UserIdeTotals,
  UserFeatureTotals,
  UserLanguageFeatureTotals,
  UserModelFeatureTotals,
} from './github-copilot-usage-api';
import { COMPLETION_FEATURES } from '../../shared/utils/feature-classification';

/**
 * Build an OrgReport for a team by filtering and aggregating per-user records.
 *
 * @param userRecords  Flat array of per-user daily records from the users-28-day endpoint
 * @param teamLogins   Set of GitHub logins belonging to the team
 * @returns OrgReport  Aggregated metrics for the team (same shape as a standard org report)
 */
export function aggregateTeamMetrics(
  userRecords: UserDayRecord[],
  teamLogins: Set<string>
): OrgReport {
  // Build case-insensitive login set for robust matching
  const normalizedLogins = new Set(Array.from(teamLogins).map(l => l.toLowerCase()));

  // Filter to only records for team members (case-insensitive login match)
  const teamRecords = userRecords.filter(r =>
    r.user_login && normalizedLogins.has(r.user_login.toLowerCase())
  );

  // Group by day
  const byDay = new Map<string, UserDayRecord[]>();
  for (const record of teamRecords) {
    const existing = byDay.get(record.day) ?? [];
    existing.push(record);
    byDay.set(record.day, existing);
  }

  const sortedDays = Array.from(byDay.keys()).sort();

  // Pre-compute rolling window distinct-user sets per day so the day-level
  // aggregator can reflect proper 7-day / 28-day windows (bug #410).
  const rollingCounts = computeRollingWindowCounts(sortedDays, byDay);

  // Aggregate each day
  const day_totals: ReportDayTotals[] = sortedDays.map(day =>
    aggregateDayRecords(day, byDay.get(day)!, rollingCounts.get(day)!)
  );

  const allDays = day_totals.map(d => d.day);
  const report_start_day = allDays.length > 0 ? allDays[0]! : '';
  const report_end_day = allDays.length > 0 ? allDays[allDays.length - 1]! : '';

  return {
    report_start_day,
    report_end_day,
    // When teamRecords is empty the IDs default to empty strings.
    // Callers should check day_totals.length before using the report.
    organization_id: teamRecords[0]?.organization_id ?? '',
    enterprise_id: teamRecords[0]?.enterprise_id ?? '',
    created_at: new Date().toISOString(),
    day_totals,
  };
}

/**
 * Aggregate a set of per-user records for a single day into one ReportDayTotals.
 *
 * Rolling-window active-user counts (weekly / monthly) are pre-computed at the
 * team level in {@link computeRollingWindowCounts} and passed in via `rolling`,
 * because a single day's records do not have visibility into other days.
 */
function aggregateDayRecords(
  day: string,
  records: UserDayRecord[],
  rolling: RollingWindowCounts,
): ReportDayTotals {
  const activeUsers = records.length;

  return {
    day,
    organization_id: records[0]?.organization_id ?? '',
    enterprise_id: records[0]?.enterprise_id ?? '',
    daily_active_users: activeUsers,
    weekly_active_users: rolling.weekly_active_users,
    monthly_active_users: rolling.monthly_active_users,
    monthly_active_chat_users: rolling.monthly_active_chat_users,
    monthly_active_agent_users: rolling.monthly_active_agent_users,
    user_initiated_interaction_count: sum(records, r => r.user_initiated_interaction_count),
    code_generation_activity_count: sum(records, r => r.code_generation_activity_count),
    code_acceptance_activity_count: sum(records, r => r.code_acceptance_activity_count),
    loc_suggested_to_add_sum: sum(records, r => r.loc_suggested_to_add_sum),
    loc_suggested_to_delete_sum: sum(records, r => r.loc_suggested_to_delete_sum),
    loc_added_sum: sum(records, r => r.loc_added_sum),
    loc_deleted_sum: sum(records, r => r.loc_deleted_sum),
    totals_by_ide: mergeIdeTotals(records.flatMap(r => r.totals_by_ide ?? [])),
    totals_by_feature: mergeFeatureTotals(records.flatMap(r => r.totals_by_feature ?? [])),
    totals_by_language_feature: mergeLanguageFeatureTotals(records.flatMap(r => r.totals_by_language_feature ?? [])),
    totals_by_language_model: buildLanguageModelTotals(records),
    totals_by_model_feature: mergeModelFeatureTotals(records.flatMap(r => r.totals_by_model_feature ?? [])),
  };
}

// --- Rolling active-user window counts (bug #410) ---

const WEEKLY_WINDOW_DAYS = 7;
const MONTHLY_WINDOW_DAYS = 28;

interface RollingWindowCounts {
  weekly_active_users: number;
  monthly_active_users: number;
  monthly_active_chat_users: number;
  monthly_active_agent_users: number;
}

/**
 * For each day, compute distinct-user counts over the trailing 7-day and
 * 28-day windows (including that day itself). Mirrors how GitHub computes
 * `weekly_active_users` / `monthly_active_users` at the org level.
 *
 * Users are keyed case-insensitively by `user_login` (matching the login
 * normalization used to filter team members).
 */
function computeRollingWindowCounts(
  sortedDays: string[],
  byDay: Map<string, UserDayRecord[]>,
): Map<string, RollingWindowCounts> {
  const result = new Map<string, RollingWindowCounts>();

  for (const day of sortedDays) {
    const weeklyCutoff = getDateNDaysAgo(day, WEEKLY_WINDOW_DAYS - 1);
    const monthlyCutoff = getDateNDaysAgo(day, MONTHLY_WINDOW_DAYS - 1);

    const weeklyUsers = new Set<string>();
    const monthlyUsers = new Set<string>();
    const monthlyChatUsers = new Set<string>();
    const monthlyAgentUsers = new Set<string>();

    for (const otherDay of sortedDays) {
      if (otherDay > day || otherDay < monthlyCutoff) continue;
      const records = byDay.get(otherDay) ?? [];
      const inWeeklyWindow = otherDay >= weeklyCutoff;

      for (const r of records) {
        const login = r.user_login?.toLowerCase();
        if (!login) continue;
        monthlyUsers.add(login);
        if (r.used_chat) monthlyChatUsers.add(login);
        if (r.used_agent) monthlyAgentUsers.add(login);
        if (inWeeklyWindow) weeklyUsers.add(login);
      }
    }

    result.set(day, {
      weekly_active_users: weeklyUsers.size,
      monthly_active_users: monthlyUsers.size,
      monthly_active_chat_users: monthlyChatUsers.size,
      monthly_active_agent_users: monthlyAgentUsers.size,
    });
  }

  return result;
}

/**
 * Return the ISO date string N days before `dateStr` (UTC). Used to compute
 * inclusive rolling-window cutoffs — e.g. `getDateNDaysAgo(d, 6)` gives the
 * 7-day window start when combined with `d` itself.
 */
function getDateNDaysAgo(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0]!;
}

// --- Merge helpers ---

function sum<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((acc, item) => acc + (fn(item) || 0), 0);
}

function mergeIdeTotals(items: UserIdeTotals[]): ReportIdeTotals[] {
  const byIde = new Map<string, ReportIdeTotals>();
  for (const item of items) {
    const existing = byIde.get(item.ide);
    if (!existing) {
      byIde.set(item.ide, { ...item });
    } else {
      existing.user_initiated_interaction_count += item.user_initiated_interaction_count;
      existing.code_generation_activity_count += item.code_generation_activity_count;
      existing.code_acceptance_activity_count += item.code_acceptance_activity_count;
      existing.loc_suggested_to_add_sum += item.loc_suggested_to_add_sum;
      existing.loc_suggested_to_delete_sum += item.loc_suggested_to_delete_sum;
      existing.loc_added_sum += item.loc_added_sum;
      existing.loc_deleted_sum += item.loc_deleted_sum;
    }
  }
  return Array.from(byIde.values());
}

function mergeFeatureTotals(items: UserFeatureTotals[]): ReportFeatureTotals[] {
  const byFeature = new Map<string, ReportFeatureTotals>();
  for (const item of items) {
    const existing = byFeature.get(item.feature);
    if (!existing) {
      byFeature.set(item.feature, { ...item });
    } else {
      existing.user_initiated_interaction_count += item.user_initiated_interaction_count;
      existing.code_generation_activity_count += item.code_generation_activity_count;
      existing.code_acceptance_activity_count += item.code_acceptance_activity_count;
      existing.loc_suggested_to_add_sum += item.loc_suggested_to_add_sum;
      existing.loc_suggested_to_delete_sum += item.loc_suggested_to_delete_sum;
      existing.loc_added_sum += item.loc_added_sum;
      existing.loc_deleted_sum += item.loc_deleted_sum;
    }
  }
  return Array.from(byFeature.values());
}

function mergeLanguageFeatureTotals(items: UserLanguageFeatureTotals[]): ReportLanguageFeatureTotals[] {
  const byKey = new Map<string, ReportLanguageFeatureTotals>();
  for (const item of items) {
    const key = `${item.language}::${item.feature}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item });
    } else {
      existing.code_generation_activity_count += item.code_generation_activity_count;
      existing.code_acceptance_activity_count += item.code_acceptance_activity_count;
      existing.loc_suggested_to_add_sum += item.loc_suggested_to_add_sum;
      existing.loc_suggested_to_delete_sum += item.loc_suggested_to_delete_sum;
      existing.loc_added_sum += item.loc_added_sum;
      existing.loc_deleted_sum += item.loc_deleted_sum;
    }
  }
  return Array.from(byKey.values());
}

function mergeModelFeatureTotals(items: UserModelFeatureTotals[]): ReportModelFeatureTotals[] {
  const byKey = new Map<string, ReportModelFeatureTotals>();
  for (const item of items) {
    const key = `${item.model}::${item.feature}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item });
    } else {
      existing.user_initiated_interaction_count += item.user_initiated_interaction_count;
      existing.code_generation_activity_count += item.code_generation_activity_count;
      existing.code_acceptance_activity_count += item.code_acceptance_activity_count;
      existing.loc_suggested_to_add_sum += item.loc_suggested_to_add_sum;
      existing.loc_suggested_to_delete_sum += item.loc_suggested_to_delete_sum;
      existing.loc_added_sum += item.loc_added_sum;
      existing.loc_deleted_sum += item.loc_deleted_sum;
    }
  }
  return Array.from(byKey.values());
}

/**
 * Approximate totals_by_language_model from per-user language+feature and model+feature data.
 *
 * The per-user records don't carry a language×model cross-product, so we distribute
 * each model's completion activity proportionally across languages based on each
 * language's share of total completion activity. This is an approximation suited for
 * visualization (the "Model usage per language" stacked-bar chart).
 */
function buildLanguageModelTotals(records: UserDayRecord[]): ReportLanguageModelTotals[] {
  // Aggregate per-language completion stats across all users for this day
  const langMap = new Map<string, { gen: number; accept: number; locSug: number; locSugDel: number; locAdd: number; locDel: number }>();
  for (const r of records) {
    for (const lf of (r.totals_by_language_feature ?? [])) {
      if (COMPLETION_FEATURES.includes(lf.feature)) {
        const e = langMap.get(lf.language) ?? { gen: 0, accept: 0, locSug: 0, locSugDel: 0, locAdd: 0, locDel: 0 };
        e.gen    += lf.code_generation_activity_count;
        e.accept += lf.code_acceptance_activity_count;
        e.locSug    += lf.loc_suggested_to_add_sum;
        e.locSugDel += lf.loc_suggested_to_delete_sum;
        e.locAdd    += lf.loc_added_sum;
        e.locDel    += lf.loc_deleted_sum;
        langMap.set(lf.language, e);
      }
    }
  }
  const totalGen = Array.from(langMap.values()).reduce((a, b) => a + b.gen, 0);
  if (totalGen === 0 || langMap.size === 0) return [];

  // Aggregate per-model completion stats across all users for this day
  const modelMap = new Map<string, { gen: number; accept: number; locSug: number; locSugDel: number; locAdd: number; locDel: number }>();
  for (const r of records) {
    for (const mf of (r.totals_by_model_feature ?? [])) {
      if (COMPLETION_FEATURES.includes(mf.feature)) {
        const e = modelMap.get(mf.model) ?? { gen: 0, accept: 0, locSug: 0, locSugDel: 0, locAdd: 0, locDel: 0 };
        e.gen    += mf.code_generation_activity_count;
        e.accept += mf.code_acceptance_activity_count;
        e.locSug    += mf.loc_suggested_to_add_sum;
        e.locSugDel += mf.loc_suggested_to_delete_sum;
        e.locAdd    += mf.loc_added_sum;
        e.locDel    += mf.loc_deleted_sum;
        modelMap.set(mf.model, e);
      }
    }
  }
  if (modelMap.size === 0) return [];

  // Distribute each model's totals proportionally across languages
  const result: ReportLanguageModelTotals[] = [];
  for (const [model, mt] of modelMap) {
    for (const [language, lt] of langMap) {
      const ratio = lt.gen / totalGen;
      result.push({
        language,
        model,
        code_generation_activity_count: Math.round(mt.gen    * ratio),
        code_acceptance_activity_count: Math.round(mt.accept * ratio),
        loc_suggested_to_add_sum:       Math.round(mt.locSug    * ratio),
        loc_suggested_to_delete_sum:    Math.round(mt.locSugDel * ratio),
        loc_added_sum:                  Math.round(mt.locAdd    * ratio),
        loc_deleted_sum:                Math.round(mt.locDel    * ratio),
      });
    }
  }
  return result;
}
