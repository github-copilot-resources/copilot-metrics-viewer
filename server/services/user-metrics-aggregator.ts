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
  ReportModelFeatureTotals,
  UserIdeTotals,
  UserFeatureTotals,
  UserLanguageFeatureTotals,
  UserModelFeatureTotals,
} from './github-copilot-usage-api';

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

  // Aggregate each day
  const day_totals: ReportDayTotals[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, records]) => aggregateDayRecords(day, records));

  const allDays = day_totals.map(d => d.day);
  const report_start_day = allDays.length > 0 ? allDays[0] : '';
  const report_end_day = allDays.length > 0 ? allDays[allDays.length - 1] : '';

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
 */
function aggregateDayRecords(day: string, records: UserDayRecord[]): ReportDayTotals {
  const activeUsers = records.length;

  return {
    day,
    organization_id: records[0]?.organization_id ?? '',
    enterprise_id: records[0]?.enterprise_id ?? '',
    daily_active_users: activeUsers,
    weekly_active_users: activeUsers,
    monthly_active_users: activeUsers,
    monthly_active_chat_users: records.filter(r => r.used_chat).length,
    monthly_active_agent_users: records.filter(r => r.used_agent).length,
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
    totals_by_language_model: [],
    totals_by_model_feature: mergeModelFeatureTotals(records.flatMap(r => r.totals_by_model_feature ?? [])),
  };
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
