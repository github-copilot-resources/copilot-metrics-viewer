/**
 * Mock GitHub Copilot Usage Metrics API for testing
 * Simulates the new download-based API behavior with realistic report data
 */

import type { DownloadLinksResponse, MetricsReportRequest, OrgReport, ReportDayTotals } from './github-copilot-usage-api';

/**
 * Generate a mock day_totals entry matching the real API format
 */
function generateMockDayTotals(day: string): ReportDayTotals {
  const activeUsers = 3 + Math.floor(Math.random() * 3);
  const codeGenCount = 100 + Math.floor(Math.random() * 200);
  const codeAcceptCount = Math.floor(codeGenCount * 0.3);
  const interactionCount = 30 + Math.floor(Math.random() * 80);
  const locSuggested = 200 + Math.floor(Math.random() * 1000);

  return {
    day,
    organization_id: '100000001',
    enterprise_id: '200001',
    daily_active_users: activeUsers,
    weekly_active_users: activeUsers + 1,
    monthly_active_users: activeUsers + 2,
    monthly_active_chat_users: activeUsers,
    monthly_active_agent_users: Math.max(1, activeUsers - 1),
    user_initiated_interaction_count: interactionCount,
    code_generation_activity_count: codeGenCount,
    code_acceptance_activity_count: codeAcceptCount,
    totals_by_ide: [
      {
        ide: 'vscode',
        user_initiated_interaction_count: interactionCount,
        code_generation_activity_count: codeGenCount,
        code_acceptance_activity_count: codeAcceptCount,
        loc_suggested_to_add_sum: locSuggested,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: locSuggested + 500,
        loc_deleted_sum: Math.floor(locSuggested * 0.3),
      }
    ],
    totals_by_feature: [
      {
        feature: 'code_completion',
        user_initiated_interaction_count: 0,
        code_generation_activity_count: Math.floor(codeGenCount * 0.4),
        code_acceptance_activity_count: codeAcceptCount,
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.3),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: Math.floor(locSuggested * 0.15),
        loc_deleted_sum: 0,
      },
      {
        feature: 'chat_panel_agent_mode',
        user_initiated_interaction_count: Math.floor(interactionCount * 0.7),
        code_generation_activity_count: Math.floor(codeGenCount * 0.3),
        code_acceptance_activity_count: 0,
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.4),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 0,
        loc_deleted_sum: 0,
      },
      {
        feature: 'chat_panel_ask_mode',
        user_initiated_interaction_count: Math.floor(interactionCount * 0.2),
        code_generation_activity_count: Math.floor(codeGenCount * 0.2),
        code_acceptance_activity_count: 0,
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.2),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 0,
        loc_deleted_sum: 0,
      },
      {
        feature: 'agent_edit',
        user_initiated_interaction_count: 0,
        code_generation_activity_count: Math.floor(codeGenCount * 0.1),
        code_acceptance_activity_count: 0,
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.1),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 0,
        loc_deleted_sum: 0,
      }
    ],
    totals_by_language_feature: [
      {
        language: 'typescript',
        feature: 'code_completion',
        code_generation_activity_count: Math.floor(codeGenCount * 0.25),
        code_acceptance_activity_count: Math.floor(codeAcceptCount * 0.5),
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.15),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: Math.floor(locSuggested * 0.08),
        loc_deleted_sum: 0,
      },
      {
        language: 'python',
        feature: 'code_completion',
        code_generation_activity_count: Math.floor(codeGenCount * 0.15),
        code_acceptance_activity_count: Math.floor(codeAcceptCount * 0.3),
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.1),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: Math.floor(locSuggested * 0.05),
        loc_deleted_sum: 0,
      }
    ],
    totals_by_language_model: [
      {
        language: 'typescript',
        model: 'default',
        code_generation_activity_count: Math.floor(codeGenCount * 0.25),
        code_acceptance_activity_count: Math.floor(codeAcceptCount * 0.5),
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.15),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: Math.floor(locSuggested * 0.08),
        loc_deleted_sum: 0,
      },
      {
        language: 'python',
        model: 'default',
        code_generation_activity_count: Math.floor(codeGenCount * 0.15),
        code_acceptance_activity_count: Math.floor(codeAcceptCount * 0.3),
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.1),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: Math.floor(locSuggested * 0.05),
        loc_deleted_sum: 0,
      }
    ],
    totals_by_model_feature: [
      {
        model: 'default',
        feature: 'code_completion',
        user_initiated_interaction_count: 0,
        code_generation_activity_count: Math.floor(codeGenCount * 0.4),
        code_acceptance_activity_count: codeAcceptCount,
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.3),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: Math.floor(locSuggested * 0.15),
        loc_deleted_sum: 0,
      },
      {
        model: 'default',
        feature: 'chat_panel_agent_mode',
        user_initiated_interaction_count: Math.floor(interactionCount * 0.7),
        code_generation_activity_count: Math.floor(codeGenCount * 0.3),
        code_acceptance_activity_count: 0,
        loc_suggested_to_add_sum: Math.floor(locSuggested * 0.4),
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 0,
        loc_deleted_sum: 0,
      }
    ],
    loc_suggested_to_add_sum: locSuggested,
    loc_suggested_to_delete_sum: 0,
    loc_added_sum: locSuggested + 500,
    loc_deleted_sum: Math.floor(locSuggested * 0.3),
  };
}

/**
 * Generate a mock OrgReport for a date range
 */
export function generateMockReport(startDay: string, endDay: string): OrgReport {
  const start = new Date(startDay);
  const end = new Date(endDay);
  const dayTotals: ReportDayTotals[] = [];

  const current = new Date(start);
  while (current <= end) {
    dayTotals.push(generateMockDayTotals(current.toISOString().split('T')[0]));
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

/**
 * Mock implementation of requestDownloadLinks
 */
export function mockRequestDownloadLinks(
  request: MetricsReportRequest,
  reportType: '1-day' | '28-day',
  day?: string
): DownloadLinksResponse {
  const { scope, identifier } = request;
  const mockUrl = `https://mock-copilot-reports.github.com/reports/${scope}/${identifier}/${reportType}.json?signature=mock`;

  if (reportType === '1-day') {
    return {
      download_links: [mockUrl],
      report_day: day || new Date().toISOString().split('T')[0],
    };
  }

  const endDay = new Date();
  const startDay = new Date(endDay);
  startDay.setDate(startDay.getDate() - 27);

  return {
    download_links: [mockUrl],
    report_start_day: startDay.toISOString().split('T')[0],
    report_end_day: endDay.toISOString().split('T')[0],
  };
}

/**
 * Mock implementation of downloadReport
 */
export function mockDownloadReport(downloadUrl: string, orgIdentifier: string): OrgReport {
  // Determine date range from URL pattern
  const is28Day = downloadUrl.includes('28-day');
  const dayMatch = downloadUrl.match(/day=(\d{4}-\d{2}-\d{2})/);

  if (is28Day || !dayMatch) {
    const endDay = new Date();
    const startDay = new Date(endDay);
    startDay.setDate(startDay.getDate() - 27);
    return generateMockReport(
      startDay.toISOString().split('T')[0],
      endDay.toISOString().split('T')[0]
    );
  }

  return generateMockReport(dayMatch[1], dayMatch[1]);
}

/**
 * Check if we're in mock mode
 */
export function isMockMode(): boolean {
  const config = useRuntimeConfig();
  return config.public.isDataMocked === true || config.public.isDataMocked === 'true';
}
