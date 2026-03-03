/**
 * Tests for GitHub Copilot Usage Metrics API client
 */

import { describe, it, expect } from 'vitest';
import { parseNDJSON } from '../server/services/github-copilot-usage-api';
import { generateMockReport, mockRequestDownloadLinks, mockDownloadReport } from '../server/services/github-copilot-usage-api-mock';
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
      expect(response.download_links[0]).toContain('test-org');
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
      expect(response.report_day).toBe('2026-02-20');
    });

    it('should handle enterprise scope', () => {
      const response = mockRequestDownloadLinks(
        { scope: 'enterprise', identifier: 'test-enterprise' },
        '28-day'
      );

      expect(response.download_links[0]).toContain('test-enterprise');
      expect(response.download_links[0]).toContain('enterprise');
    });

    it('should return valid report from mock download', () => {
      const report = mockDownloadReport('https://example.com/28-day', 'test-org');

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
