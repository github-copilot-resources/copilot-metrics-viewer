/**
 * GitHub Copilot Usage Metrics API client
 * Implements the new download-based API for metrics reports
 * See: https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics
 */

import { isMockMode, mockRequestDownloadLinks, mockRequestUserDownloadLinks, generateMockReport } from './github-copilot-usage-api-mock';

// Import $fetch for standalone (non-Nitro) environments
// In Nitro context, $fetch is auto-imported; this is a no-op there
import { $fetch as _ofetch } from 'ofetch';
const _fetch: typeof _ofetch = typeof $fetch !== 'undefined' ? ($fetch as typeof _ofetch) : _ofetch;

// --- API Response Types ---

/** Response from the download links endpoints */
export interface DownloadLinksResponse {
  download_links: string[];
  /** Present for 1-day reports */
  report_day?: string;
  /** Present for 28-day reports */
  report_start_day?: string;
  report_end_day?: string;
}

/** Options for requesting a metrics report */
export interface MetricsReportRequest {
  scope: 'organization' | 'enterprise';
  identifier: string;
  teamSlug?: string;
  /** When true, use mock data regardless of the server-wide NUXT_PUBLIC_IS_DATA_MOCKED env var */
  isMocked?: boolean;
}

// --- Report Data Types (what the downloaded files contain) ---

export interface ReportDayTotals {
  day: string;
  organization_id: string;
  enterprise_id: string;
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
  monthly_active_chat_users?: number;
  monthly_active_agent_users?: number;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  totals_by_ide: ReportIdeTotals[];
  totals_by_feature: ReportFeatureTotals[];
  totals_by_language_feature: ReportLanguageFeatureTotals[];
  totals_by_language_model: ReportLanguageModelTotals[];
  totals_by_model_feature: ReportModelFeatureTotals[];
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
  pull_requests?: ReportPullRequests;
  daily_active_cli_users?: number;
  totals_by_cli?: ReportCliTotals;
}

export interface ReportPullRequests {
  total_created: number;
  total_reviewed: number;
  total_merged: number;
  median_minutes_to_merge?: number;
  total_suggestions: number;
  total_applied_suggestions: number;
  total_created_by_copilot: number;
  total_reviewed_by_copilot: number;
  total_merged_created_by_copilot: number;
  median_minutes_to_merge_copilot_authored?: number;
  total_copilot_suggestions: number;
  total_copilot_applied_suggestions: number;
}

export interface ReportCliTotals {
  session_count: number;
  request_count: number;
  token_usage?: {
    output_tokens_sum: number;
    prompt_tokens_sum: number;
    avg_tokens_per_request: number;
  };
}

export interface ReportIdeTotals {
  ide: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

export interface ReportFeatureTotals {
  feature: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

export interface ReportLanguageFeatureTotals {
  language: string;
  feature: string;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

export interface ReportLanguageModelTotals {
  language: string;
  model: string;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

export interface ReportModelFeatureTotals {
  model: string;
  feature: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

export interface OrgReport {
  report_start_day: string;
  report_end_day: string;
  organization_id: string;
  enterprise_id: string;
  created_at: string;
  day_totals: ReportDayTotals[];
}

// --- User-level Report Data Types ---

/**
 * Raw per-user-per-day record as returned by the GitHub Users Report API (NDJSON).
 * Each line in the downloaded file has this shape — one record per user per active day.
 * Field name is `user_login` (not `login`).
 */
export interface UserDayRecord {
  report_start_day: string;
  report_end_day: string;
  day: string;
  organization_id: string;
  enterprise_id: string;
  user_id: number;
  user_login: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
  /**
   * AI credits consumed by this user on this day. Added by GitHub on
   * 2026-06-19 to the users-1-day / users-28-day Copilot metrics reports.
   * Optional because it is absent on older reports and on enterprises that
   * have not yet enabled premium request billing.
   */
  ai_credits_used?: number;
  used_agent?: boolean;
  used_chat?: boolean;
  used_cli?: boolean;
  totals_by_ide?: UserIdeTotals[];
  totals_by_feature?: UserFeatureTotals[];
  totals_by_language_feature?: UserLanguageFeatureTotals[];
  totals_by_language_model?: ReportLanguageModelTotals[];
  totals_by_model_feature?: UserModelFeatureTotals[];
  /**
   * Per-user CLI usage stats including token_usage and last_known_cli_version.
   * Object (not array) because the GitHub CLI has a single binary identity.
   */
  totals_by_cli?: UserCliTotals;
  /** AI adoption phase observed on this day. */
  ai_adoption_phase?: AiAdoptionPhase;
}

/** Per-user IDE usage totals */
export interface UserIdeTotals {
  ide: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
  /** Most recently observed editor plugin (e.g. github copilot extension) version */
  last_known_plugin_version?: LastKnownPluginVersion;
  /** Most recently observed editor (IDE) version */
  last_known_ide_version?: LastKnownIdeVersion;
}

export interface LastKnownPluginVersion {
  sampled_at: string;
  plugin: string;
  plugin_version: string;
}

export interface LastKnownIdeVersion {
  sampled_at: string;
  ide_version: string;
}

export interface LastKnownCliVersion {
  sampled_at: string;
  cli_version: string;
}

/**
 * Per-user CLI usage totals. Unlike totals_by_ide (an array, one entry per
 * editor), totals_by_cli is a SINGLE object per user-day — the GitHub CLI has
 * exactly one binary identity. Contains token usage (the most authoritative
 * per-user token signal GitHub exposes) and the last observed CLI version.
 */
export interface UserCliTotals {
  session_count: number;
  request_count: number;
  prompt_count: number;
  token_usage?: {
    output_tokens_sum: number;
    prompt_tokens_sum: number;
    avg_tokens_per_request: number;
  };
  last_known_cli_version?: LastKnownCliVersion;
}

/**
 * AI adoption phase reported per user per day on user-level reports. The same
 * user may move between phases over the reporting window, so we keep the most
 * recent value when aggregating.
 *
 * GitHub documents the possible `phase` values as `No Cohort` (the default,
 * `phase_number: 0`), `Phase 1`, `Phase 2`, and `Phase 3`. The docs do not
 * publish the activity criteria GitHub uses to assign each phase — only the
 * labels and an associated numeric ordering. New phases may appear as the
 * model evolves (the `version` field records the classifier version), so
 * downstream code should treat the set of phases as open-ended and render
 * whatever `phase` strings the API returns.
 *
 * See: https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics
 */
export interface AiAdoptionPhase {
  phase_number: number;
  phase: string;
  version: string;
}

/** Per-user feature usage totals */
export interface UserFeatureTotals {
  feature: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

/** Per-user language + feature usage totals */
export interface UserLanguageFeatureTotals {
  language: string;
  feature: string;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

/** Per-user model + feature usage totals */
export interface UserModelFeatureTotals {
  model: string;
  feature: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

/** Aggregated metrics for a single user over a time period */
export interface UserTotals {
  /** GitHub login / username */
  login: string;
  /** GitHub user ID */
  user_id: number;
  /** Number of days the user was active in the period */
  total_active_days: number;
  /** Total user-initiated interactions (chat, completions, etc.) */
  user_initiated_interaction_count: number;
  /** Total code generation events */
  code_generation_activity_count: number;
  /** Total code acceptance events */
  code_acceptance_activity_count: number;
  /** Total lines of code suggested */
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  /** Total lines of code accepted (added) */
  loc_added_sum: number;
  loc_deleted_sum: number;
  /**
   * Sum of AI credits consumed by this user across the period. Optional —
   * populated only when GitHub returns `ai_credits_used` on the underlying
   * day records (rolled out 2026-06-19). Undefined means "data not
   * available" rather than zero.
   */
  ai_credits_used?: number;
  /** Breakdown by IDE */
  totals_by_ide?: UserIdeTotals[];
  /** Breakdown by feature */
  totals_by_feature?: UserFeatureTotals[];
  /** Breakdown by language + feature */
  totals_by_language_feature?: UserLanguageFeatureTotals[];
  /** Breakdown by model + feature */
  totals_by_model_feature?: UserModelFeatureTotals[];
  /**
   * Aggregated CLI usage including total tokens. Optional — only present when
   * the user used the GitHub CLI at least once in the period.
   */
  totals_by_cli?: UserCliTotals;
  /**
   * Most recent AI adoption phase observed for this user in the reporting
   * window. Phase can change day-to-day; we surface the latest value so it
   * reflects the user's current state.
   */
  ai_adoption_phase?: AiAdoptionPhase;
}

/** A user-level usage metrics report covering a date range */
export interface UserReport {
  report_start_day: string;
  report_end_day: string;
  organization_id?: string;
  enterprise_id?: string;
  created_at?: string;
  user_totals: UserTotals[];
  /**
   * Per-user per-day rows. Present in the 28-day report file even though the
   * outer endpoint is pre-aggregated — GitHub bundles the daily breakdown so
   * consumers don't have to make N follow-up 1-day calls.
   */
  day_totals?: UserDayRecord[];
}

// --- Helper: merge breakdown arrays by key ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeBreakdown<T>(
  existing: T[] | undefined,
  incoming: T[] | undefined,
  keyFn: (item: T) => string,
  sumFields: string[]
): T[] {
  const map = new Map<string, T>();
  for (const item of existing ?? []) {
    map.set(keyFn(item), { ...item });
  }
  for (const item of incoming ?? []) {
    const key = keyFn(item);
    const prev = map.get(key);
    if (prev) {
      for (const f of sumFields) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prev as any)[f] = (((prev as any)[f] as number) || 0) + (((item as any)[f] as number) || 0);
      }
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

const METRIC_FIELDS = [
  'user_initiated_interaction_count',
  'code_generation_activity_count',
  'code_acceptance_activity_count',
  'loc_suggested_to_add_sum',
  'loc_suggested_to_delete_sum',
  'loc_added_sum',
  'loc_deleted_sum',
];

const METRIC_FIELDS_NO_INTERACTION = METRIC_FIELDS.filter(f => f !== 'user_initiated_interaction_count');

/**
 * Specialised IDE-breakdown merger that ALSO preserves last_known_plugin_version
 * and last_known_ide_version, picking the most recent (by sampled_at) when
 * combining records. Falls back to the generic mergeBreakdown for the numeric
 * fields.
 */
function mergeIdeBreakdown(
  existing: UserIdeTotals[],
  incoming: UserIdeTotals[] | undefined
): UserIdeTotals[] {
  const merged = mergeBreakdown(existing, incoming, (i) => i.ide, METRIC_FIELDS);
  // Now walk incoming again to keep the latest version objects (mergeBreakdown's
  // generic field-summing path overwrites version fields when entries collide).
  const byIde = new Map<string, UserIdeTotals>();
  for (const item of merged) byIde.set(item.ide, item);
  for (const item of incoming ?? []) {
    const cur = byIde.get(item.ide);
    if (!cur) continue;
    if (item.last_known_plugin_version) {
      const prev = cur.last_known_plugin_version;
      if (!prev || (item.last_known_plugin_version.sampled_at || '') > (prev.sampled_at || '')) {
        cur.last_known_plugin_version = item.last_known_plugin_version;
      }
    }
    if (item.last_known_ide_version) {
      const prev = cur.last_known_ide_version;
      if (!prev || (item.last_known_ide_version.sampled_at || '') > (prev.sampled_at || '')) {
        cur.last_known_ide_version = item.last_known_ide_version;
      }
    }
  }
  return merged;
}

/**
 * Aggregate an array of per-user-per-day records (from the real GitHub API)
 * into per-user totals matching the UserTotals interface.
 */
export function aggregateUserDayRecords(records: UserDayRecord[]): UserTotals[] {
  const byUser = new Map<string, {
    user_id: number;
    days: Set<string>;
    user_initiated_interaction_count: number;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
    loc_suggested_to_add_sum: number;
    loc_suggested_to_delete_sum: number;
    loc_added_sum: number;
    loc_deleted_sum: number;
    /** undefined until we see at least one day with the field; then a number */
    ai_credits_used: number | undefined;
    totals_by_ide: UserIdeTotals[];
    totals_by_feature: UserFeatureTotals[];
    totals_by_language_feature: UserLanguageFeatureTotals[];
    totals_by_model_feature: UserModelFeatureTotals[];
    /** Summed CLI totals across days; undefined until we see CLI data */
    cli: UserCliTotals | undefined;
    /** Track latest day we saw for adoption phase (string compare is safe for ISO dates) */
    latestPhaseDay: string;
    ai_adoption_phase: AiAdoptionPhase | undefined;
  }>();

  for (const rec of records) {
    const login = rec.user_login;
    let agg = byUser.get(login);
    if (!agg) {
      agg = {
        user_id: rec.user_id,
        days: new Set(),
        user_initiated_interaction_count: 0,
        code_generation_activity_count: 0,
        code_acceptance_activity_count: 0,
        loc_suggested_to_add_sum: 0,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 0,
        loc_deleted_sum: 0,
        ai_credits_used: undefined,
        totals_by_ide: [],
        totals_by_feature: [],
        totals_by_language_feature: [],
        totals_by_model_feature: [],
        cli: undefined,
        latestPhaseDay: '',
        ai_adoption_phase: undefined,
      };
      byUser.set(login, agg);
    }

    agg.days.add(rec.day);
    agg.user_initiated_interaction_count += rec.user_initiated_interaction_count || 0;
    agg.code_generation_activity_count += rec.code_generation_activity_count || 0;
    agg.code_acceptance_activity_count += rec.code_acceptance_activity_count || 0;
    agg.loc_suggested_to_add_sum += rec.loc_suggested_to_add_sum || 0;
    agg.loc_suggested_to_delete_sum += rec.loc_suggested_to_delete_sum || 0;
    agg.loc_added_sum += rec.loc_added_sum || 0;
    agg.loc_deleted_sum += rec.loc_deleted_sum || 0;

    // Only initialise ai_credits_used when the API actually returned it on
    // at least one day record, so callers can distinguish "no data" from
    // "explicit zero".
    if (typeof rec.ai_credits_used === 'number') {
      agg.ai_credits_used = (agg.ai_credits_used ?? 0) + rec.ai_credits_used;
    }

    // Adoption phase: pick the most recent day's value (phase can change over
    // the window — surface the user's current state, not the oldest).
    if (rec.ai_adoption_phase && rec.day >= agg.latestPhaseDay) {
      agg.latestPhaseDay = rec.day;
      agg.ai_adoption_phase = rec.ai_adoption_phase;
    }

    // CLI: sum session/request/prompt counts and token usage. For
    // last_known_cli_version pick the entry with the latest sampled_at.
    if (rec.totals_by_cli) {
      const src = rec.totals_by_cli;
      if (!agg.cli) {
        agg.cli = {
          session_count: 0,
          request_count: 0,
          prompt_count: 0,
        };
      }
      agg.cli.session_count += src.session_count || 0;
      agg.cli.request_count += src.request_count || 0;
      agg.cli.prompt_count += src.prompt_count || 0;
      if (src.token_usage) {
        if (!agg.cli.token_usage) {
          agg.cli.token_usage = { output_tokens_sum: 0, prompt_tokens_sum: 0, avg_tokens_per_request: 0 };
        }
        agg.cli.token_usage.output_tokens_sum += src.token_usage.output_tokens_sum || 0;
        agg.cli.token_usage.prompt_tokens_sum += src.token_usage.prompt_tokens_sum || 0;
      }
      if (src.last_known_cli_version) {
        const cur = agg.cli.last_known_cli_version;
        if (!cur || (src.last_known_cli_version.sampled_at || '') > (cur.sampled_at || '')) {
          agg.cli.last_known_cli_version = src.last_known_cli_version;
        }
      }
    }

    agg.totals_by_ide = mergeIdeBreakdown(agg.totals_by_ide, rec.totals_by_ide);
    agg.totals_by_feature = mergeBreakdown(
      agg.totals_by_feature, rec.totals_by_feature,
      (f) => f.feature, METRIC_FIELDS
    );
    agg.totals_by_language_feature = mergeBreakdown(
      agg.totals_by_language_feature, rec.totals_by_language_feature,
      (lf) => `${lf.language}:${lf.feature}`,
      METRIC_FIELDS_NO_INTERACTION
    );
    agg.totals_by_model_feature = mergeBreakdown(
      agg.totals_by_model_feature, rec.totals_by_model_feature,
      (mf) => `${mf.model}:${mf.feature}`, METRIC_FIELDS
    );
  }

  const result: UserTotals[] = [];
  for (const [login, agg] of byUser) {
    // Compute final avg tokens per request from summed totals.
    if (agg.cli?.token_usage && agg.cli.request_count > 0) {
      agg.cli.token_usage.avg_tokens_per_request =
        (agg.cli.token_usage.prompt_tokens_sum + agg.cli.token_usage.output_tokens_sum) / agg.cli.request_count;
    }
    result.push({
      login,
      user_id: agg.user_id,
      total_active_days: agg.days.size,
      user_initiated_interaction_count: agg.user_initiated_interaction_count,
      code_generation_activity_count: agg.code_generation_activity_count,
      code_acceptance_activity_count: agg.code_acceptance_activity_count,
      loc_suggested_to_add_sum: agg.loc_suggested_to_add_sum,
      loc_suggested_to_delete_sum: agg.loc_suggested_to_delete_sum,
      loc_added_sum: agg.loc_added_sum,
      loc_deleted_sum: agg.loc_deleted_sum,
      ai_credits_used: agg.ai_credits_used,
      totals_by_ide: agg.totals_by_ide,
      totals_by_feature: agg.totals_by_feature,
      totals_by_language_feature: agg.totals_by_language_feature,
      totals_by_model_feature: agg.totals_by_model_feature,
      totals_by_cli: agg.cli,
      ai_adoption_phase: agg.ai_adoption_phase,
    });
  }

  return result;
}

// --- API Functions ---

/** Returns the GitHub API base URL, honouring the NUXT_GITHUB_API_BASE_URL override for GHE.com. */
export function getGitHubApiBaseUrl(): string {
  return process.env.NUXT_GITHUB_API_BASE_URL || 'https://api.github.com';
}

/**
 * Build the report URL for the given scope and report type.
 */
function buildReportUrl(
  request: MetricsReportRequest,
  reportType: '1-day' | '28-day',
  day?: string
): string {
  const { scope, identifier } = request;
  const base = getGitHubApiBaseUrl();
  const isOrg = scope === 'organization';

  if (isOrg) {
    const prefix = reportType === '1-day'
      ? `organization-1-day`
      : `organization-28-day/latest`;
    const url = `${base}/orgs/${identifier}/copilot/metrics/reports/${prefix}`;
    return reportType === '1-day' ? `${url}?day=${day}` : url;
  } else {
    const prefix = reportType === '1-day'
      ? `enterprise-1-day`
      : `enterprise-28-day/latest`;
    const url = `${base}/enterprises/${identifier}/copilot/metrics/reports/${prefix}`;
    return reportType === '1-day' ? `${url}?day=${day}` : url;
  }
}

/**
 * Request download links for a metrics report.
 * Returns signed URLs to download the actual report files.
 */
export async function requestDownloadLinks(
  request: MetricsReportRequest,
  headers: HeadersInit,
  reportType: '1-day' | '28-day' = '28-day',
  day?: string
): Promise<DownloadLinksResponse> {
  if (isMockMode() || request.isMocked) {
    return mockRequestDownloadLinks(request, reportType, day);
  }

  const url = buildReportUrl(request, reportType, day);

  // Build clean headers: start from auth middleware headers, then override API version.
  // Headers.entries() lowercases keys, so we normalize to avoid duplicate version headers.
  const rawHeaders: Record<string, string> = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : { ...(headers as Record<string, string>) };
  // Remove any existing api-version header (lowercase from Headers) before setting the correct one
  delete rawHeaders['x-github-api-version'];
  rawHeaders['X-GitHub-Api-Version'] = '2026-03-10';

  try {
    const response = await _fetch<DownloadLinksResponse>(url, { headers: rawHeaders });
    return response;
  } catch (error: unknown) {
    // Log the response body for better debugging
    if (error && typeof error === 'object' && 'data' in error) {
      console.error('[new-api] GitHub error response:', JSON.stringify((error as { data: unknown }).data));
    }
    throw error;
  }
}

/**
 * Normalize a raw API response (either OrgReport or flat 1-day ReportDayTotals)
 * into an OrgReport with a day_totals array.
 *
 * The 28-day endpoint returns an OrgReport; the 1-day endpoint returns a flat
 * ReportDayTotals object that must be wrapped before further processing.
 *
 * Exported for unit testing.
 */
export function normalizeReportResponse(response: OrgReport | ReportDayTotals): OrgReport {
  // 1-day endpoint returns a flat ReportDayTotals (has `day` but no `day_totals` array)
  if (response && 'day' in response && !Array.isArray((response as unknown as OrgReport).day_totals)) {
    const dayTotals = response as ReportDayTotals;
    return {
      report_start_day: dayTotals.day,
      report_end_day: dayTotals.day,
      organization_id: dayTotals.organization_id || '',
      enterprise_id: dayTotals.enterprise_id || '',
      created_at: new Date().toISOString(),
      day_totals: [dayTotals],
    };
  }

  return response as unknown as OrgReport;
}

/**
 * Download and parse a report file from a signed URL.
 * The 28-day endpoint returns plain JSON containing an OrgReport object.
 * The 1-day endpoint returns a flat ReportDayTotals object (not wrapped in OrgReport).
 * This function normalizes both formats into an OrgReport.
 */
export async function downloadReport(
  downloadUrl: string,
  orgIdentifier?: string
): Promise<OrgReport> {
  const response = await _fetch<OrgReport | ReportDayTotals>(downloadUrl, {
    responseType: 'json',
  });

  return normalizeReportResponse(response);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/**
 * Shift all day_totals dates so the most recent day equals today.
 * Used in mock mode to keep mock data within the current date window,
 * regardless of the hardcoded dates in the static mock file.
 */
function shiftReportDatesToToday(report: OrgReport): OrgReport {
  if (!report.day_totals || report.day_totals.length === 0) return report;

  const sorted = [...report.day_totals].sort((a, b) => a.day.localeCompare(b.day));
  const lastDay = sorted[sorted.length - 1]!.day;
  const today = toDateString(new Date());
  const daysDiff = Math.round(
    (new Date(today).getTime() - new Date(lastDay).getTime()) / MS_PER_DAY
  );

  if (daysDiff <= 0) return report; // Data is already current

  const shiftedTotals = sorted.map(d => {
    const shifted = new Date(new Date(d.day).getTime() + daysDiff * MS_PER_DAY);
    return { ...d, day: toDateString(shifted) };
  });

  return {
    ...report,
    report_start_day: shiftedTotals[0]!.day,
    report_end_day: shiftedTotals[shiftedTotals.length - 1]!.day,
    day_totals: shiftedTotals,
  };
}

/**
 * Fetch the latest 28-day metrics report.
 * This is the most efficient endpoint — one API call + one download for 28 days of data.
 */
export async function fetchLatestReport(
  request: MetricsReportRequest,
  headers: HeadersInit
): Promise<OrgReport> {
  // In mock mode, generate a report with dates anchored to today's 28-day window
  // so that seeded DB data always aligns with the dashboard's default date picker.
  if (isMockMode() || request.isMocked) {
    const toDate = (d: Date) => d.toISOString().split('T')[0]!;
    const endDay = toDate(new Date());
    const startDay = toDate(new Date(Date.now() - 27 * 24 * 60 * 60 * 1000));
    return generateMockReport(startDay, endDay);
  }

  const { download_links } = await requestDownloadLinks(request, headers, '28-day');

  if (!download_links || download_links.length === 0) {
    throw new Error('No download links returned from metrics report API');
  }

  // Download all report files and merge day_totals
  const reports = await Promise.all(
    download_links.map(url => downloadReport(url, request.identifier))
  );

  // Merge: use first report as base, combine day_totals from all files
  const merged = { ...reports[0]! };
  if (reports.length > 1) {
    merged.day_totals = reports.flatMap(r => r.day_totals);
  }

  // In mock mode, shift dates to be relative to today so they fall within
  // the default "last 30 days" window used by sync-status and other queries.
  if (isMockMode()) {
    return shiftReportDatesToToday(merged);
  }

  return merged;
}

/**
 * Fetch a single day's metrics report.
 */
export async function fetchReportForDate(
  request: MetricsReportRequest,
  headers: HeadersInit,
  day: string
): Promise<OrgReport> {
  const { download_links } = await requestDownloadLinks(request, headers, '1-day', day);

  if (!download_links || download_links.length === 0) {
    throw new Error(`No download links returned for day ${day}`);
  }

  const reports = await Promise.all(
    download_links.map(url => downloadReport(url, request.identifier))
  );

  const merged = { ...reports[0]! };
  if (reports.length > 1) {
    merged.day_totals = reports.flatMap(r => r.day_totals);
  }

  return merged;
}

// --- Backward compatibility exports ---

/** @deprecated Use DownloadLinksResponse instead */
export type DownloadUrlResponse = DownloadLinksResponse;

/** @deprecated Use parseReportJSON instead */
export function parseNDJSON<T = unknown>(content: string): T[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line));
}

/** @deprecated Use fetchLatestReport instead */
export async function fetchMetricsForDate(
  request: MetricsReportRequest & { date: string },
  headers: HeadersInit
): Promise<unknown[]> {
  const report = await fetchReportForDate(
    { scope: request.scope, identifier: request.identifier, teamSlug: request.teamSlug },
    headers,
    request.date
  );
  return report.day_totals;
}

// --- User metrics API Functions ---

/**
 * Build the user-level report URL for the given scope and report type.
 * Org: /orgs/{org}/copilot/metrics/reports/users-{type}[/latest]
 * Enterprise: /enterprises/{ent}/copilot/metrics/reports/users-{type}[/latest]
 */
function buildUserReportUrl(
  request: MetricsReportRequest,
  reportType: '1-day' | '28-day',
  day?: string
): string {
  const { scope, identifier } = request;
  const base = getGitHubApiBaseUrl();
  const isOrg = scope === 'organization';

  if (isOrg) {
    const prefix = reportType === '1-day'
      ? 'users-1-day'
      : 'users-28-day/latest';
    const url = `${base}/orgs/${identifier}/copilot/metrics/reports/${prefix}`;
    return reportType === '1-day' ? `${url}?day=${day}` : url;
  } else {
    const prefix = reportType === '1-day'
      ? 'users-1-day'
      : 'users-28-day/latest';
    const url = `${base}/enterprises/${identifier}/copilot/metrics/reports/${prefix}`;
    return reportType === '1-day' ? `${url}?day=${day}` : url;
  }
}

/**
 * Request download links for a user-level metrics report.
 */
export async function requestUserDownloadLinks(
  request: MetricsReportRequest,
  headers: HeadersInit,
  reportType: '1-day' | '28-day' = '28-day',
  day?: string
): Promise<DownloadLinksResponse> {
  if (isMockMode() || request.isMocked) {
    return mockRequestUserDownloadLinks(request, reportType, day);
  }

  const url = buildUserReportUrl(request, reportType, day);

  const rawHeaders: Record<string, string> = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : { ...(headers as Record<string, string>) };
  delete rawHeaders['x-github-api-version'];
  rawHeaders['X-GitHub-Api-Version'] = '2026-03-10';

  try {
    const response = await _fetch<DownloadLinksResponse>(url, { headers: rawHeaders });
    return response;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      console.error('[user-metrics-api] GitHub error response:', JSON.stringify((error as { data: unknown }).data));
    }
    throw error;
  }
}

/**
 * Download and parse a user-level report file from a signed URL.
 *
 * The real GitHub API returns NDJSON — one JSON object per line, each being a
 * UserDayRecord (per-user-per-day). We parse and aggregate into UserTotals[].
 */
export async function downloadUserReport(downloadUrl: string): Promise<UserReport> {
  const raw = await _fetch<unknown>(downloadUrl, {
    responseType: 'text' as 'json',
  });
  let records: unknown[];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    try {
      // Try plain JSON first (mock data or single-object responses)
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        records = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.user_totals)) {
        // Already in UserReport shape (mock data format)
        console.info('[user-metrics-api] Download is pre-aggregated UserReport');
        return parsed as UserReport;
      } else {
        records = [parsed];
      }
    } catch {
      // NDJSON: one JSON object per line
      const lines = trimmed.split('\n').filter(l => l.trim());
      records = lines.map(line => JSON.parse(line));
    }
  } else if (Array.isArray(raw)) {
    records = raw;
  } else if (raw && typeof raw === 'object' && 'user_totals' in (raw as Record<string, unknown>)) {
    return raw as UserReport;
  } else {
    console.error('[user-metrics-api] Unexpected download response type:', typeof raw);
    return { report_start_day: '', report_end_day: '', user_totals: [] };
  }

  if (records.length === 0) {
    return { report_start_day: '', report_end_day: '', user_totals: [] };
  }

  // Detect format: real API has `user_login` + `day`; pre-aggregated has `login` + `total_active_days`
  const first = records[0] as Record<string, unknown>;
  if ('user_login' in first && 'day' in first) {
    // Real API format — aggregate daily records into per-user totals.
    // Also surface the raw per-day per-user rows as `day_totals` so callers
    // can render a day-by-day chart without making 28 follow-up 1-day calls.
    const dayRecords = records as UserDayRecord[];
    console.info(`[user-metrics-api] Aggregating ${dayRecords.length} daily user records`);
    const userTotals = aggregateUserDayRecords(dayRecords);
    return {
      report_start_day: first.report_start_day as string || '',
      report_end_day: first.report_end_day as string || '',
      organization_id: first.organization_id as string,
      enterprise_id: first.enterprise_id as string,
      user_totals: userTotals,
      day_totals: dayRecords,
    };
  }

  // Pre-aggregated format (mock data / already-aggregated) — array of UserTotals
  if ('login' in first) {
    console.info(`[user-metrics-api] Download has ${records.length} pre-aggregated user records`);
    return { report_start_day: '', report_end_day: '', user_totals: records as UserTotals[] };
  }

  console.warn('[user-metrics-api] Unknown record format. Keys:', Object.keys(first));
  return { report_start_day: '', report_end_day: '', user_totals: [] };
}

/**
 * Fetch the latest 28-day user-level metrics report.
 * Handles multiple download links (large enterprises may have multiple files).
 */
export async function fetchLatestUserReport(
  request: MetricsReportRequest,
  headers: HeadersInit
): Promise<UserReport> {
  const { download_links } = await requestUserDownloadLinks(request, headers, '28-day');

  if (!download_links || download_links.length === 0) {
    throw new Error('No download links returned from user metrics report API');
  }

  // Download all report files concurrently and merge user_totals
  const reports = await Promise.all(
    download_links.map(url => downloadUserReport(url))
  );

  // Merge: use first report as base, combine user_totals AND day_totals from all files.
  // The 28-day report file already contains per-day per-user rows (`day_totals`),
  // so consumers can render a day-by-day chart without a separate 1-day fetch.
  //
  // For large orgs GitHub time-partitions the report across multiple files, and
  // the SAME user appears in every file with per-file `user_totals` covering only
  // that file's date subset. Naively flatMap'ing `user_totals` would produce
  // duplicate rows per user and inflate the user count (issue #398). When we
  // have more than one file, re-derive `user_totals` from the merged day_totals
  // using the same aggregator we use for the arbitrary-date-range path.
  const merged: UserReport = { ...reports[0]! };
  merged.day_totals = reports.flatMap(r => r.day_totals ?? []);
  merged.user_totals = reports.length > 1
    ? aggregateUserDayRecords(merged.day_totals)
    : reports.flatMap(r => r.user_totals ?? []);

  return merged;
}

/**
 * Fetch a single day's user-level metrics report.
 */
export async function fetchUserReportForDate(
  request: MetricsReportRequest,
  headers: HeadersInit,
  day: string
): Promise<UserReport> {
  const { download_links } = await requestUserDownloadLinks(request, headers, '1-day', day);

  if (!download_links || download_links.length === 0) {
    throw new Error(`No user-level download links returned for day ${day}`);
  }

  const reports = await Promise.all(
    download_links.map(url => downloadUserReport(url))
  );

  // Same dedup logic as fetchLatestUserReport — a single day can still be
  // sharded across files for very large orgs.
  const merged: UserReport = { ...reports[0]! };
  merged.day_totals = reports.flatMap(r => r.day_totals ?? []);
  merged.user_totals = reports.length > 1
    ? aggregateUserDayRecords(merged.day_totals)
    : reports.flatMap(r => r.user_totals ?? []);

  return merged;
}

/**
 * Download a user-level report file and return the raw per-day per-user records
 * without aggregating into UserTotals[].
 *
 * Used for storing individual daily records in the user_day_metrics table so that
 * team-level metrics can be computed for any arbitrary date range beyond 28 days.
 */
export async function downloadUserDayRecords(downloadUrl: string): Promise<UserDayRecord[]> {
  const raw = await _fetch<unknown>(downloadUrl, { responseType: 'text' as 'json' });

  let records: unknown[];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        records = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).user_totals)) {
        // Pre-aggregated mock format — no per-day records available
        return [];
      } else {
        records = [parsed];
      }
    } catch {
      const lines = trimmed.split('\n').filter(l => l.trim());
      records = lines.map(line => JSON.parse(line));
    }
  } else if (Array.isArray(raw)) {
    records = raw;
  } else {
    return [];
  }

  if (records.length === 0) return [];

  const first = records[0] as Record<string, unknown>;
  // Only return raw records that have the per-day shape (user_login + day)
  if ('user_login' in first && 'day' in first) {
    return records as UserDayRecord[];
  }
  return [];
}

/**
 * Fetch the latest 28-day user report and return raw per-day per-user records.
 * Multiple download links (large enterprises) are merged into a single flat array.
 */
export async function fetchRawUserDayRecords(
  request: MetricsReportRequest,
  headers: HeadersInit
): Promise<UserDayRecord[]> {
  const { download_links } = await requestUserDownloadLinks(request, headers, '28-day');

  if (!download_links || download_links.length === 0) {
    return [];
  }

  const batches = await Promise.all(download_links.map(url => downloadUserDayRecords(url)));
  return batches.flat();
}
