/**
 * GitHub Copilot Usage Metrics API client
 * Implements the new download-based API for metrics reports
 * See: https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics
 */

import { isMockMode, mockRequestDownloadLinks, mockRequestUserDownloadLinks } from './github-copilot-usage-api-mock';

// Import $fetch for standalone (non-Nitro) environments
// In Nitro context, $fetch is auto-imported; this is a no-op there
import { $fetch as _ofetch } from 'ofetch';
const _fetch = typeof $fetch !== 'undefined' ? $fetch : _ofetch;

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
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise';
  identifier: string;
  teamSlug?: string;
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
  /** Premium requests count for this model+feature combination */
  premium_requests_total?: number;
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
  /** Total premium requests consumed (e.g. Claude Sonnet, GPT-5, etc.) */
  premium_requests_total?: number;
  /** Breakdown by IDE */
  totals_by_ide?: UserIdeTotals[];
  /** Breakdown by feature */
  totals_by_feature?: UserFeatureTotals[];
  /** Breakdown by language + feature */
  totals_by_language_feature?: UserLanguageFeatureTotals[];
  /** Breakdown by model + feature */
  totals_by_model_feature?: UserModelFeatureTotals[];
}

/** A user-level usage metrics report covering a date range */
export interface UserReport {
  report_start_day: string;
  report_end_day: string;
  organization_id?: string;
  enterprise_id?: string;
  created_at?: string;
  user_totals: UserTotals[];
}

// --- API Functions ---

/**
 * Build the report URL for the given scope and report type.
 */
function buildReportUrl(
  request: MetricsReportRequest,
  reportType: '1-day' | '28-day',
  day?: string
): string {
  const { scope, identifier } = request;
  const base = 'https://api.github.com';
  const isOrg = scope === 'organization' || scope === 'team-organization';

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
  if (isMockMode()) {
    return mockRequestDownloadLinks(request, reportType, day);
  }

  const url = buildReportUrl(request, reportType, day);

  // Build clean headers: start from auth middleware headers, then override API version.
  // Headers.entries() lowercases keys, so we normalize to avoid duplicate version headers.
  const rawHeaders = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : { ...headers };
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
 * Download and parse a report file from a signed URL.
 * The files are plain JSON (not NDJSON), containing an OrgReport object.
 */
export async function downloadReport(
  downloadUrl: string,
  orgIdentifier?: string
): Promise<OrgReport> {
  const response = await _fetch<OrgReport>(downloadUrl, {
    responseType: 'json',
  });
  return response;
}

/**
 * Fetch the latest 28-day metrics report.
 * This is the most efficient endpoint — one API call + one download for 28 days of data.
 */
export async function fetchLatestReport(
  request: MetricsReportRequest,
  headers: HeadersInit
): Promise<OrgReport> {
  const { download_links } = await requestDownloadLinks(request, headers, '28-day');

  if (!download_links || download_links.length === 0) {
    throw new Error('No download links returned from metrics report API');
  }

  // Download all report files and merge day_totals
  const reports = await Promise.all(
    download_links.map(url => downloadReport(url, request.identifier))
  );

  // Merge: use first report as base, combine day_totals from all files
  const merged = { ...reports[0] };
  if (reports.length > 1) {
    merged.day_totals = reports.flatMap(r => r.day_totals);
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

  const merged = { ...reports[0] };
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
  const base = 'https://api.github.com';
  const isOrg = scope === 'organization' || scope === 'team-organization';

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
  if (isMockMode()) {
    return mockRequestUserDownloadLinks(request, reportType, day);
  }

  const url = buildUserReportUrl(request, reportType, day);

  const rawHeaders = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : { ...headers };
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
 */
export async function downloadUserReport(downloadUrl: string): Promise<UserReport> {
  const response = await _fetch<UserReport>(downloadUrl, {
    responseType: 'json',
  });
  return response;
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

  // Merge: use first report as base, combine user_totals from all files
  const merged: UserReport = { ...reports[0] };
  if (reports.length > 1) {
    merged.user_totals = reports.flatMap(r => r.user_totals);
  }

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

  const merged: UserReport = { ...reports[0] };
  if (reports.length > 1) {
    merged.user_totals = reports.flatMap(r => r.user_totals);
  }

  return merged;
}
