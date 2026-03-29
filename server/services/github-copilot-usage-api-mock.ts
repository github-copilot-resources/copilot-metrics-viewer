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

import type { DownloadLinksResponse, MetricsReportRequest, OrgReport } from './github-copilot-usage-api';

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
  const isOrg = request.scope === 'organization' || request.scope === 'team-organization';
  const scopePrefix = isOrg ? 'organization' : 'enterprise';

  if (reportType === '1-day') {
    return {
      download_links: [`${getMockBaseUrl()}/mock-data/new-api/${scopePrefix}-1-day-report.json`],
      report_day: day || new Date().toISOString().split('T')[0],
    };
  }

  return {
    download_links: [`${getMockBaseUrl()}/mock-data/new-api/${scopePrefix}-28-day-report.json`],
    report_start_day: '2026-02-04',
    report_end_day: '2026-03-03',
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
  const isOrg = request.scope === 'organization' || request.scope === 'team-organization';
  const scopePrefix = isOrg ? 'organization' : 'enterprise';

  if (reportType === '1-day') {
    return {
      download_links: [`${getMockBaseUrl()}/mock-data/new-api/${scopePrefix}-users-1-day-report.json`],
      report_day: day || new Date().toISOString().split('T')[0],
    };
  }

  return {
    download_links: [`${getMockBaseUrl()}/mock-data/new-api/${scopePrefix}-users-28-day-report.json`],
    report_start_day: '2026-02-04',
    report_end_day: '2026-03-03',
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
  // Read from the static mock file if available (Node.js environments)
  try {
    const { readFileSync } = require('fs');
    const { resolve } = require('path');
    const filePath = resolve('public/mock-data/new-api/organization-28-day-report.json');
    const data = JSON.parse(readFileSync(filePath, 'utf8')) as OrgReport;
    // Filter to requested date range
    const start = new Date(startDay);
    const end = new Date(endDay);
    data.day_totals = data.day_totals
      .filter(d => {
        const date = new Date(d.day);
        return date >= start && date <= end;
      })
      .sort((a, b) => a.day.localeCompare(b.day));
    if (data.day_totals.length > 0) {
      data.report_start_day = startDay;
      data.report_end_day = endDay;
      return data;
    }
    // Requested range has no data in file — fall through to generator
  } catch {
    // File not available — fall through to generator
  }
  return _generateFallbackReport(startDay, endDay);
}

/** Minimal fallback when static file isn't available */
function _generateFallbackReport(startDay: string, endDay: string): OrgReport {
  const start = new Date(startDay);
  const end = new Date(endDay);
  const dayTotals = [];
  const current = new Date(start);
  while (current <= end) {
    dayTotals.push(_generateMinimalDay(current.toISOString().split('T')[0]));
    current.setDate(current.getDate() + 1);
  }
  return {
    report_start_day: startDay,
    report_end_day: endDay,
    organization_id: '100000001',
    enterprise_id: '200001',
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
    user_initiated_interaction_count: 50,
    code_generation_activity_count: 150,
    code_acceptance_activity_count: 45,
    totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 50, code_generation_activity_count: 150, code_acceptance_activity_count: 45, loc_suggested_to_add_sum: 300, loc_suggested_to_delete_sum: 0, loc_added_sum: 600, loc_deleted_sum: 50 }],
    totals_by_feature: [
      { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 60, code_acceptance_activity_count: 45, loc_suggested_to_add_sum: 100, loc_suggested_to_delete_sum: 0, loc_added_sum: 50, loc_deleted_sum: 0 },
      { feature: 'agent_edit', user_initiated_interaction_count: 0, code_generation_activity_count: 90, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 500, loc_deleted_sum: 50 },
    ],
    totals_by_language_feature: [
      { language: 'typescript', feature: 'code_completion', code_generation_activity_count: 40, code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 60, loc_suggested_to_delete_sum: 0, loc_added_sum: 30, loc_deleted_sum: 0 },
    ],
    totals_by_language_model: [
      { language: 'typescript', model: 'gpt-5.3-codex', code_generation_activity_count: 40, code_acceptance_activity_count: 30, loc_suggested_to_add_sum: 60, loc_suggested_to_delete_sum: 0, loc_added_sum: 30, loc_deleted_sum: 0 },
    ],
    totals_by_model_feature: [
      { model: 'gpt-5.3-codex', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 60, code_acceptance_activity_count: 45, loc_suggested_to_add_sum: 100, loc_suggested_to_delete_sum: 0, loc_added_sum: 50, loc_deleted_sum: 0 },
      { model: 'claude-opus-4.6', feature: 'agent_edit', user_initiated_interaction_count: 0, code_generation_activity_count: 90, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 500, loc_deleted_sum: 50 },
    ],
    loc_suggested_to_add_sum: 300,
    loc_suggested_to_delete_sum: 0,
    loc_added_sum: 600,
    loc_deleted_sum: 50,
  };
}
