/**
 * Mock GitHub Copilot Usage Metrics API for testing
 * 
 * Simulates the real two-step API flow:
 *   1. requestDownloadLinks() → returns URLs pointing to local mock JSON files
 *   2. downloadReport() → actually fetches those files via HTTP from localhost
 * 
 * Mock data files live in public/mock-data/new-api/ and are based on
 * anonymized real API responses. Nuxt serves them as static assets.
 */

import type { DownloadLinksResponse, MetricsReportRequest, OrgReport, ReportDayTotals } from './github-copilot-usage-api';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockOrg28DayRaw from '../../public/mock-data/new-api/organization-28-day-report.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import mockOrg1DayRaw from '../../public/mock-data/new-api/organization-1-day-report.json';

/** Base URL for local mock files served by Nuxt's public/ directory */
function getMockBaseUrl(): string {
  const port = process.env.PORT || process.env.NITRO_PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Mock implementation of requestDownloadLinks.
 * Returns download URLs pointing to local static JSON files,
 * simulating the real GitHub API response format.
 */
export function mockRequestDownloadLinks(
  request: MetricsReportRequest,
  reportType: '1-day' | '28-day',
  day?: string
): DownloadLinksResponse {
  const isOrg = request.scope === 'organization';
  const scopePrefix = isOrg ? 'organization' : 'enterprise';

  if (reportType === '1-day') {
    return {
      download_links: [`${getMockBaseUrl()}/mock-data/new-api/${scopePrefix}-1-day-report.json`],
      report_day: day || new Date().toISOString().split('T')[0],
    };
  }

  // Use a rolling 28-day window ending today so charts always show recent dates
  const today = new Date();
  const endDay = today.toISOString().split('T')[0];
  const startDay = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return {
    download_links: [`${getMockBaseUrl()}/mock-data/new-api/${scopePrefix}-28-day-report.json`],
    report_start_day: startDay,
    report_end_day: endDay,
  };
}

/**
 * Mock implementation of requestUserDownloadLinks.
 * Returns download URLs pointing to local static JSON files for per-user metrics.
 */
export function mockRequestUserDownloadLinks(
  request: MetricsReportRequest,
  reportType: '1-day' | '28-day',
  day?: string
): DownloadLinksResponse {
  const isOrg = request.scope === 'organization';
  const scopePrefix = isOrg ? 'organization' : 'enterprise';

  if (reportType === '1-day') {
    return {
      download_links: [`${getMockBaseUrl()}/mock-data/new-api/${scopePrefix}-users-1-day-report.json`],
      report_day: day || new Date().toISOString().split('T')[0],
    };
  }

  // Use a rolling 28-day window ending today so charts always show recent dates
  const today = new Date();
  const endDay = today.toISOString().split('T')[0];
  const startDay = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return {
    download_links: [`${getMockBaseUrl()}/mock-data/new-api/${scopePrefix}-users-28-day-report.json`],
    report_start_day: startDay,
    report_end_day: endDay,
  };
}

/**
 * Check if we're in mock mode.
 * Supports both Nitro runtime config and standalone (tsx) environments.
 */
export function isMockMode(): boolean {
  if (typeof useRuntimeConfig === 'function') {
    try {
      const config = useRuntimeConfig();
      return config.public.isDataMocked === true || config.public.isDataMocked === 'true';
    } catch { /* fall through to env var check */ }
  }
  return process.env.NUXT_PUBLIC_IS_DATA_MOCKED === 'true';
}

/**
 * Generate a mock OrgReport programmatically (used by unit tests and
 * the metrics-util-v2 mock path that needs data before the HTTP server starts).
 */
export function generateMockReport(startDay: string, endDay: string): OrgReport {
  // Use statically imported mock data (bundled at compile time — no filesystem dependency)
  const data = JSON.parse(JSON.stringify(mockOrg28DayRaw)) as OrgReport;

  const sorted = [...data.day_totals].sort((a, b) => a.day.localeCompare(b.day));
  if (sorted.length === 0) return _generateFallbackReport(startDay, endDay);

  const reqStart = new Date(startDay);
  const reqEnd = new Date(endDay);

  // Try filtering to the requested range directly
  const direct = sorted.filter(d => {
    const date = new Date(d.day);
    return date >= reqStart && date <= reqEnd;
  });

  if (direct.length > 0) {
    data.day_totals = direct;
    data.report_start_day = startDay;
    data.report_end_day = endDay;
    return data;
  }

  // No overlap: shift all days so the file's last day aligns with reqEnd.
  // This keeps relative temporal patterns intact while producing the requested date range.
  const fileEndMs = new Date(sorted[sorted.length - 1].day).getTime();
  const reqEndMs = reqEnd.getTime();
  const offsetMs = reqEndMs - fileEndMs;

  const shifted = sorted
    .map(d => ({
      ...d,
      day: new Date(new Date(d.day).getTime() + offsetMs).toISOString().split('T')[0],
    }))
    .filter(d => {
      const date = new Date(d.day);
      return date >= reqStart && date <= reqEnd;
    });

  if (shifted.length > 0) {
    data.day_totals = shifted;
    data.report_start_day = startDay;
    data.report_end_day = endDay;
    return data;
  }

  return _generateFallbackReport(startDay, endDay);
}

/** Minimal fallback when static file isn't available */
function _generateFallbackReport(startDay: string, endDay: string): OrgReport {
  // Use statically imported 1-day template as per-day template
  let dayTemplate: ReportDayTotals | null = null;
  try {
    const data = JSON.parse(JSON.stringify(mockOrg1DayRaw)) as OrgReport;
    dayTemplate = data.day_totals[0] ?? null;
  } catch {
    // Template unavailable — will use hardcoded fallback below
  }

  const start = new Date(startDay);
  const end = new Date(endDay);
  const dayTotals: ReportDayTotals[] = [];
  const current = new Date(start);
  while (current <= end) {
    const day = current.toISOString().split('T')[0];
    dayTotals.push(dayTemplate ? { ...dayTemplate, day } : _generateMinimalDay(day));
    current.setDate(current.getDate() + 1);
  }
  return {
    report_start_day: startDay,
    report_end_day: endDay,
    organization_id: dayTemplate?.organization_id ?? '100000001',
    enterprise_id: dayTemplate?.enterprise_id ?? '200001',
    created_at: new Date().toISOString(),
    day_totals: dayTotals,
  };
}

function _generateMinimalDay(day: string) {
  return {
    day,
    organization_id: '100000001',
    enterprise_id: '200001',
    daily_active_users: 4,
    weekly_active_users: 5,
    monthly_active_users: 6,
    monthly_active_agent_users: 5,
    user_initiated_interaction_count: 50,
    code_generation_activity_count: 150,
    code_acceptance_activity_count: 45,
    totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 50, code_generation_activity_count: 150, code_acceptance_activity_count: 45, loc_suggested_to_add_sum: 300, loc_suggested_to_delete_sum: 0, loc_added_sum: 600, loc_deleted_sum: 50 }],
    totals_by_feature: [
      { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 60, code_acceptance_activity_count: 45, loc_suggested_to_add_sum: 100, loc_suggested_to_delete_sum: 0, loc_added_sum: 50, loc_deleted_sum: 0 },
      { feature: 'agent_edit', user_initiated_interaction_count: 15, code_generation_activity_count: 90, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 500, loc_deleted_sum: 50 },
      { feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 20, code_generation_activity_count: 0, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
      { feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 10, code_generation_activity_count: 0, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
    ],
    totals_by_language_feature: [
      { language: 'typescript', feature: 'code_completion', code_generation_activity_count: 40, code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 60, loc_suggested_to_delete_sum: 0, loc_added_sum: 30, loc_deleted_sum: 0 },
      { language: 'python',     feature: 'agent_edit',      code_generation_activity_count: 35, code_acceptance_activity_count: 0,  loc_suggested_to_add_sum: 0,  loc_suggested_to_delete_sum: 0, loc_added_sum: 250, loc_deleted_sum: 30 },
      { language: 'typescript', feature: 'agent_edit',      code_generation_activity_count: 30, code_acceptance_activity_count: 0,  loc_suggested_to_add_sum: 0,  loc_suggested_to_delete_sum: 0, loc_added_sum: 200, loc_deleted_sum: 20 },
      { language: 'markdown',   feature: 'agent_edit',      code_generation_activity_count: 15, code_acceptance_activity_count: 0,  loc_suggested_to_add_sum: 0,  loc_suggested_to_delete_sum: 0, loc_added_sum: 50,  loc_deleted_sum: 0  },
    ],
    totals_by_language_model: [
      { language: 'typescript', model: 'gpt-5.3-codex', code_generation_activity_count: 40, code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 60, loc_suggested_to_delete_sum: 0, loc_added_sum: 30, loc_deleted_sum: 0 },
    ],
    totals_by_model_feature: [
      { model: 'gpt-5.3-codex', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 60, code_acceptance_activity_count: 45, loc_suggested_to_add_sum: 100, loc_suggested_to_delete_sum: 0, loc_added_sum: 50, loc_deleted_sum: 0 },
      { model: 'claude-opus-4.6', feature: 'agent_edit', user_initiated_interaction_count: 15, code_generation_activity_count: 90, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 500, loc_deleted_sum: 50 },
      { model: 'gpt-5.3-codex', feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 20, code_generation_activity_count: 0, code_acceptance_activity_count: 5, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
      { model: 'claude-opus-4.6', feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 10, code_generation_activity_count: 0, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
    ],
    loc_suggested_to_add_sum: 300,
    loc_suggested_to_delete_sum: 0,
    loc_added_sum: 600,
    loc_deleted_sum: 50,
  };
}
