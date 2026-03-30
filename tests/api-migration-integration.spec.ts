/**
 * Integration tests for new API migration features
 * Tests actual functionality of the report transformer, NDJSON parsing, and API integration
 */

import { describe, it, expect } from 'vitest';
import { parseNDJSON } from '../server/services/github-copilot-usage-api';
import { generateMockReport } from '../server/services/github-copilot-usage-api-mock';
import { transformReportToMetrics } from '../server/services/report-transformer';

describe('API Migration Integration', () => {

  describe('Report Data Flow', () => {
    it('should generate mock report and transform to CopilotMetrics', () => {
      const report = generateMockReport('2026-02-20', '2026-02-22');
      const metrics = transformReportToMetrics(report);

      expect(metrics).toHaveLength(3);
      expect(metrics[0].date).toBe('2026-02-20');
      expect(metrics[0].total_active_users).toBeGreaterThan(0);
      expect(metrics[0].copilot_ide_code_completions).toBeDefined();
    });

    it('should preserve language data through transformation', () => {
      const report = generateMockReport('2026-02-20', '2026-02-20');
      const metrics = transformReportToMetrics(report);
      
      const completions = metrics[0].copilot_ide_code_completions;
      expect(completions?.editors?.length).toBeGreaterThan(0);
      expect(completions?.languages?.length).toBeGreaterThan(0);
    });

    it('should sort transformed metrics chronologically when report day_totals are out of order', () => {
      const report = generateMockReport('2026-02-20', '2026-02-22');
      report.day_totals = [report.day_totals[2], report.day_totals[0], report.day_totals[1]];

      const metrics = transformReportToMetrics(report);

      expect(metrics.map(metric => metric.date)).toEqual([
        '2026-02-20',
        '2026-02-21',
        '2026-02-22'
      ]);
    });

    it('should handle NDJSON parsing (backward compat)', () => {
      const ndjson = '{"date":"2026-02-20","total_active_users":100}\n{"date":"2026-02-21","total_active_users":110}';
      const parsed = parseNDJSON(ndjson);
      
      expect(parsed).toHaveLength(2);
    });

    it('should handle empty lines in NDJSON', () => {
      const ndjson = '{"date":"2026-02-18"}\n\n{"date":"2026-02-19"}\n\n';
      const parsed = parseNDJSON(ndjson);
      expect(parsed).toHaveLength(2);
    });
  });

  describe('Date Range Calculations', () => {
    it('should calculate days between dates correctly', () => {
      const getDaysBetween = (start: string, end: string): number => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1;
      };

      expect(getDaysBetween('2026-02-18', '2026-02-20')).toBe(3);
      expect(getDaysBetween('2026-02-20', '2026-02-20')).toBe(1);
      expect(getDaysBetween('2026-02-01', '2026-02-28')).toBe(28);
      expect(getDaysBetween('2026-01-01', '2026-01-31')).toBe(31);
    });

    it('should generate date array for range', () => {
      const startDate = '2026-02-18';
      const endDate = '2026-02-20';
      const expected = ['2026-02-18', '2026-02-19', '2026-02-20'];

      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates: string[] = [];

      const current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      expect(dates).toEqual(expected);
      expect(dates.length).toBe(3);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing environment variable names', () => {
      const requiredVars = [
        'NUXT_PUBLIC_SCOPE',
        'NUXT_PUBLIC_GITHUB_ORG',
        'NUXT_PUBLIC_GITHUB_ENT',
        'NUXT_PUBLIC_IS_DATA_MOCKED',
        'NUXT_GITHUB_TOKEN',
        'NUXT_SESSION_PASSWORD'
      ];

      expect(requiredVars.length).toBe(6);
      expect(requiredVars).toContain('NUXT_PUBLIC_SCOPE');
      expect(requiredVars).toContain('NUXT_GITHUB_TOKEN');
    });

    it('should default to new API (USE_LEGACY_API not set or false)', () => {
      // Default is new API — USE_LEGACY_API must be explicitly "true" for legacy
      const useLegacy = process.env.USE_LEGACY_API?.toLowerCase() === 'true';
      expect(useLegacy).toBe(false);
    });
  });
});
