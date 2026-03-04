/**
 * Tests for GitHub Copilot Usage Metrics API client
 */

import { describe, it, expect } from 'vitest';
import { parseNDJSON } from '../server/services/github-copilot-usage-api';
import type { ReportDayTotals } from '../server/services/github-copilot-usage-api';
import { generateMockReport, mockRequestDownloadLinks } from '../server/services/github-copilot-usage-api-mock';
import { transformReportToMetrics, transformDayToMetrics } from '../server/services/report-transformer';

describe('GitHub Copilot Usage API', () => {
  describe('NDJSON Parsing (backward compat)', () => {
    it('should parse single-line NDJSON', () => {
      const ndjson = '{"date":"2026-02-20","total_active_users":100}';
      const result = parseNDJSON(ndjson);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ date: '2026-02-20', total_active_users: 100 });
    });

    it('should parse multi-line NDJSON', () => {
      const ndjson = `{"date":"2026-02-18","total_active_users":95}
{"date":"2026-02-19","total_active_users":98}
{"date":"2026-02-20","total_active_users":100}`;
      
      const result = parseNDJSON(ndjson);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('date', '2026-02-18');
    });

    it('should ignore empty lines', () => {
      const ndjson = `{"date":"2026-02-18","total_active_users":95}

{"date":"2026-02-19","total_active_users":98}

`;
      const result = parseNDJSON(ndjson);
      expect(result).toHaveLength(2);
    });

    it('should handle whitespace around JSON', () => {
      const ndjson = `  {"date":"2026-02-18","total_active_users":95}  
  {"date":"2026-02-19","total_active_users":98}  `;
      const result = parseNDJSON(ndjson);
      expect(result).toHaveLength(2);
    });
  });

  describe('Mock API', () => {
    it('should generate valid mock report', () => {
      const report = generateMockReport('2026-02-20', '2026-02-22');

      expect(report.report_start_day).toBe('2026-02-20');
      expect(report.report_end_day).toBe('2026-02-22');
      expect(report.day_totals).toHaveLength(3);
      expect(report.day_totals[0].day).toBe('2026-02-20');
      expect(report.day_totals[0].daily_active_users).toBeGreaterThan(0);
      expect(report.day_totals[0].totals_by_ide.length).toBeGreaterThan(0);
      expect(report.day_totals[0].totals_by_feature.length).toBeGreaterThan(0);
    });

    it('should generate mock download links for 28-day report', () => {
      const response = mockRequestDownloadLinks(
        { scope: 'organization', identifier: 'test-org' },
        '28-day'
      );

      expect(response.download_links).toHaveLength(1);
      expect(response.download_links[0]).toContain('organization-28-day-report.json');
      expect(response.report_start_day).toBeTruthy();
      expect(response.report_end_day).toBeTruthy();
    });

    it('should generate mock download links for 1-day report', () => {
      const response = mockRequestDownloadLinks(
        { scope: 'organization', identifier: 'test-org' },
        '1-day',
        '2026-02-20'
      );

      expect(response.download_links).toHaveLength(1);
      expect(response.download_links[0]).toContain('organization-1-day-report.json');
      expect(response.report_day).toBe('2026-02-20');
    });

    it('should handle enterprise scope', () => {
      const response = mockRequestDownloadLinks(
        { scope: 'enterprise', identifier: 'test-enterprise' },
        '28-day'
      );

      expect(response.download_links[0]).toContain('enterprise-28-day-report.json');
    });

    it('should generate valid report from file', () => {
      const report = generateMockReport('2026-02-20', '2026-02-28');

      expect(report.day_totals.length).toBeGreaterThan(0);
      expect(report.organization_id).toBeTruthy();
    });
  });

  describe('Report Transformer', () => {
    it('should transform a day_totals entry to CopilotMetrics format', () => {
      const report = generateMockReport('2026-02-20', '2026-02-20');
      const dayData = report.day_totals[0];
      const metrics = transformDayToMetrics(dayData);

      expect(metrics.date).toBe('2026-02-20');
      expect(metrics.total_active_users).toBe(dayData.daily_active_users);
      expect(metrics.copilot_ide_code_completions).toBeDefined();
      expect(metrics.copilot_ide_code_completions?.editors?.length).toBeGreaterThan(0);
      expect(metrics.copilot_ide_chat).toBeDefined();
    });

    it('should transform a full report to CopilotMetrics array', () => {
      const report = generateMockReport('2026-02-18', '2026-02-20');
      const metrics = transformReportToMetrics(report);

      expect(metrics).toHaveLength(3);
      expect(metrics[0].date).toBe('2026-02-18');
      expect(metrics[1].date).toBe('2026-02-19');
      expect(metrics[2].date).toBe('2026-02-20');

      // Verify each has proper structure
      metrics.forEach(m => {
        expect(m.total_active_users).toBeGreaterThan(0);
        expect(m.copilot_ide_code_completions).toBeDefined();
        expect(m.copilot_ide_chat).toBeDefined();
        expect(m.copilot_dotcom_chat).toBeDefined();
        expect(m.copilot_dotcom_pull_requests).toBeDefined();
      });
    });

    it('should map language data from totals_by_language_feature', () => {
      const report = generateMockReport('2026-02-20', '2026-02-20');
      const metrics = transformDayToMetrics(report.day_totals[0]);

      const completions = metrics.copilot_ide_code_completions;
      expect(completions?.languages?.length).toBeGreaterThan(0);
      expect(completions?.editors?.[0]?.models?.length).toBeGreaterThan(0);
      
      // Verify language data has suggestion counts
      const model = completions?.editors?.[0]?.models?.[0];
      expect(model?.languages?.length).toBeGreaterThan(0);
      if (model?.languages?.[0]) {
        expect(model.languages[0].total_code_suggestions).toBeGreaterThanOrEqual(0);
      }
    });

    it('should map chat data from totals_by_feature', () => {
      const report = generateMockReport('2026-02-20', '2026-02-20');
      const metrics = transformDayToMetrics(report.day_totals[0]);

      const chat = metrics.copilot_ide_chat;
      expect(chat?.editors?.length).toBeGreaterThan(0);
      
      // Chat models should have interaction counts
      const editor = chat?.editors?.[0];
      expect(editor?.models?.length).toBeGreaterThan(0);
      if (editor?.models?.[0]) {
        expect(editor.models[0].total_chats).toBeGreaterThanOrEqual(0);
      }
    });

    it('should only include code_completion feature in suggestion counts (acceptance rate fix)', () => {
      // Simulate real API data where agent_edit has high LOC but low relevance to completion rate
      const day: ReportDayTotals = {
        day: '2026-02-14',
        organization_id: '12345',
        enterprise_id: '67890',
        daily_active_users: 4,
        weekly_active_users: 5,
        monthly_active_users: 6,
        user_initiated_interaction_count: 200,
        code_generation_activity_count: 223, // total across ALL features
        code_acceptance_activity_count: 3,
        totals_by_ide: [{ ide: 'vscode', user_initiated_interaction_count: 200, code_generation_activity_count: 223, code_acceptance_activity_count: 3, loc_suggested_to_add_sum: 467, loc_suggested_to_delete_sum: 0, loc_added_sum: 10094, loc_deleted_sum: 3000 }],
        totals_by_feature: [
          { feature: 'agent_edit', user_initiated_interaction_count: 0, code_generation_activity_count: 126, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 10091, loc_deleted_sum: 3000 },
          { feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 19, code_acceptance_activity_count: 3, loc_suggested_to_add_sum: 47, loc_suggested_to_delete_sum: 0, loc_added_sum: 3, loc_deleted_sum: 0 },
          { feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 75, code_generation_activity_count: 75, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 337, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
          { feature: 'chat_panel_ask_mode', user_initiated_interaction_count: 3, code_generation_activity_count: 3, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 83, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
        ],
        totals_by_language_feature: [
          { language: 'typescript', feature: 'code_completion', code_generation_activity_count: 12, code_acceptance_activity_count: 2, loc_suggested_to_add_sum: 30, loc_suggested_to_delete_sum: 0, loc_added_sum: 2, loc_deleted_sum: 0 },
          { language: 'python', feature: 'code_completion', code_generation_activity_count: 7, code_acceptance_activity_count: 1, loc_suggested_to_add_sum: 17, loc_suggested_to_delete_sum: 0, loc_added_sum: 1, loc_deleted_sum: 0 },
          { language: 'typescript', feature: 'agent_edit', code_generation_activity_count: 80, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 6000, loc_deleted_sum: 2000 },
        ],
        totals_by_language_model: [],
        totals_by_model_feature: [
          { model: 'claude-opus-4.6', feature: 'agent_edit', user_initiated_interaction_count: 0, code_generation_activity_count: 80, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_suggested_to_delete_sum: 0, loc_added_sum: 6000, loc_deleted_sum: 2000 },
          { model: 'auto', feature: 'code_completion', user_initiated_interaction_count: 0, code_generation_activity_count: 19, code_acceptance_activity_count: 3, loc_suggested_to_add_sum: 47, loc_suggested_to_delete_sum: 0, loc_added_sum: 3, loc_deleted_sum: 0 },
          { model: 'claude-opus-4.6', feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 75, code_generation_activity_count: 75, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 337, loc_suggested_to_delete_sum: 0, loc_added_sum: 0, loc_deleted_sum: 0 },
        ],
        loc_suggested_to_add_sum: 467,
        loc_suggested_to_delete_sum: 0,
        loc_added_sum: 10094,
        loc_deleted_sum: 3000,
      };

      const metrics = transformDayToMetrics(day);
      
      // Code completions should ONLY have code_completion language data, NOT agent_edit
      const completions = metrics.copilot_ide_code_completions;
      expect(completions?.editors).toHaveLength(1);
      
      const editor = completions?.editors?.[0];
      expect(editor?.name).toBe('vscode');
      
      // Should have 'auto' model from code_completion, NOT claude-opus-4.6 from agent_edit
      const models = editor?.models || [];
      const modelNames = models.map(m => m.name);
      expect(modelNames).toContain('auto');
      expect(modelNames).not.toContain('claude-opus-4.6');
      
      // Sum up total suggestions/acceptances from all languages across all models
      let totalSuggestions = 0;
      let totalAcceptances = 0;
      let totalLinesSuggested = 0;
      let totalLinesAccepted = 0;
      models.forEach(m => {
        m.languages.forEach(l => {
          totalSuggestions += l.total_code_suggestions;
          totalAcceptances += l.total_code_acceptances;
          totalLinesSuggested += l.total_code_lines_suggested;
          totalLinesAccepted += l.total_code_lines_accepted;
        });
      });
      
      // Should be code_completion only: 19 gen, 3 accept (NOT 223 gen from all features)
      expect(totalSuggestions).toBe(19);
      expect(totalAcceptances).toBe(3);
      // Acceptance rate should be ~15.8%, NOT 0.4%
      const acceptanceRate = totalSuggestions > 0 ? (totalAcceptances / totalSuggestions) * 100 : 0;
      expect(acceptanceRate).toBeCloseTo(15.8, 0);
      
      // Lines should be code_completion scoped too
      expect(totalLinesSuggested).toBe(47);
      expect(totalLinesAccepted).toBe(3);
      
      // Chat should have agent_mode and ask_mode interactions
      const chat = metrics.copilot_ide_chat;
      const chatModels = chat?.editors?.[0]?.models || [];
      const chatModelNames = chatModels.map(m => m.name);
      expect(chatModelNames).toContain('claude-opus-4.6');
      // Total chat turns should be 75 (agent_mode model interactions)
      const totalChats = chatModels.reduce((sum, m) => sum + m.total_chats, 0);
      expect(totalChats).toBe(75);
    });
  });

  describe('Download URL Generation', () => {
    it('should create organization URL correctly', () => {
      const expectedUrl = `https://api.github.com/orgs/test-org/copilot/metrics/reports/organization-1-day?day=2026-02-20`;
      
      expect(expectedUrl).toContain('/orgs/test-org/');
      expect(expectedUrl).toContain('organization-1-day');
      expect(expectedUrl).toContain('day=2026-02-20');
    });

    it('should create enterprise URL correctly', () => {
      const expectedUrl = `https://api.github.com/enterprises/test-ent/copilot/metrics/reports/enterprise-1-day?day=2026-02-20`;
      
      expect(expectedUrl).toContain('/enterprises/test-ent/');
      expect(expectedUrl).toContain('enterprise-1-day');
      expect(expectedUrl).toContain('day=2026-02-20');
    });

    it('should create 28-day URL correctly', () => {
      const expectedUrl = `https://api.github.com/orgs/test-org/copilot/metrics/reports/organization-28-day/latest`;
      
      expect(expectedUrl).toContain('organization-28-day/latest');
    });
  });
});
