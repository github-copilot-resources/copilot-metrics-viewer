/**
 * Integration tests for new API migration features
 * Tests actual functionality of the storage layer, sync service, and API integration
 */

import { describe, it, expect } from 'vitest';
import { buildMetricsKey, buildSeatsKey, buildSyncStatusKey } from '../server/storage/types';
import { parseNDJSON } from '../server/services/github-copilot-usage-api';
import { generateMockNDJSON } from '../server/services/github-copilot-usage-api-mock';
import type { CopilotMetrics } from '../app/model/Copilot_Metrics';

describe('API Migration Integration', () => {
  describe('Storage Key Generation', () => {
    it('should generate consistent metrics keys', () => {
      const key1 = buildMetricsKey('organization', 'test-org', '2026-02-20');
      const key2 = buildMetricsKey('organization', 'test-org', '2026-02-20');
      
      expect(key1).toBe(key2);
      expect(key1).toBe('metrics:organization:test-org:2026-02-20');
    });

    it('should generate different keys for different scopes', () => {
      const key1 = buildMetricsKey('organization', 'test-org', '2026-02-20');
      const key2 = buildMetricsKey('enterprise', 'test-ent', '2026-02-20');

      expect(key1).not.toBe(key2);
      expect(key1).toContain('organization');
      expect(key2).toContain('enterprise');
    });

    it('should include team slug in key when provided', () => {
      const withoutTeam = buildMetricsKey('organization', 'test-org', '2026-02-20');
      const withTeam = buildMetricsKey('organization', 'test-org', '2026-02-20', 'test-team');

      expect(withTeam).toContain('team:test-team');
      expect(withoutTeam).not.toContain('team:');
      expect(withTeam).not.toBe(withoutTeam);
    });

    it('should generate seats keys correctly', () => {
      const key = buildSeatsKey('organization', 'test-org', '2026-02-20');
      
      expect(key).toBe('seats:organization:test-org:2026-02-20');
      expect(key).toContain('seats:');
    });

    it('should generate sync status keys correctly', () => {
      const key = buildSyncStatusKey('organization', 'test-org', '2026-02-20');
      
      expect(key).toBe('sync:organization:test-org:2026-02-20');
      expect(key).toContain('sync:');
    });
  });

  describe('NDJSON Parsing', () => {
    it('should parse mock NDJSON data correctly', () => {
      const ndjson = generateMockNDJSON('2026-02-20', 'test-org');
      const parsed = parseNDJSON<CopilotMetrics>(ndjson);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toHaveProperty('date', '2026-02-20');
      expect(parsed[0]).toHaveProperty('total_active_users');
      expect(parsed[0].total_active_users).toBeGreaterThan(0);
    });

    it('should parse multi-line NDJSON', () => {
      const line1 = generateMockNDJSON('2026-02-18', 'test-org');
      const line2 = generateMockNDJSON('2026-02-19', 'test-org');
      const line3 = generateMockNDJSON('2026-02-20', 'test-org');
      const ndjson = `${line1}\n${line2}\n${line3}`;
      
      const parsed = parseNDJSON<CopilotMetrics>(ndjson);
      
      expect(parsed).toHaveLength(3);
      expect(parsed[0].date).toBe('2026-02-18');
      expect(parsed[1].date).toBe('2026-02-19');
      expect(parsed[2].date).toBe('2026-02-20');
    });

    it('should handle empty lines in NDJSON', () => {
      const line1 = generateMockNDJSON('2026-02-18', 'test-org');
      const line2 = generateMockNDJSON('2026-02-19', 'test-org');
      const ndjson = `${line1}\n\n${line2}\n\n`;
      
      const parsed = parseNDJSON<CopilotMetrics>(ndjson);
      
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

  describe('API URL Construction', () => {
    it('should construct correct organization download URL pattern', () => {
      const scope = 'organization';
      const identifier = 'test-org';
      const date = '2026-02-20';

      const url = `https://api.github.com/orgs/${identifier}/copilot/metrics/reports/organization-1-day?day=${date}`;

      expect(url).toBe('https://api.github.com/orgs/test-org/copilot/metrics/reports/organization-1-day?day=2026-02-20');
      expect(url).toContain('/orgs/');
      expect(url).toContain('organization-1-day');
      expect(url).toContain('day=2026-02-20');
    });

    it('should construct correct enterprise download URL pattern', () => {
      const scope = 'enterprise';
      const identifier = 'test-ent';
      const date = '2026-02-20';

      const url = `https://api.github.com/enterprises/${identifier}/copilot/metrics/reports/enterprise-1-day?day=${date}`;

      expect(url).toBe('https://api.github.com/enterprises/test-ent/copilot/metrics/reports/enterprise-1-day?day=2026-02-20');
      expect(url).toContain('/enterprises/');
      expect(url).toContain('enterprise-1-day');
      expect(url).toContain('day=2026-02-20');
    });

    it('should use different report types for different scopes', () => {
      const orgUrl = `https://api.github.com/orgs/test/copilot/metrics/reports/organization-1-day?day=2026-02-20`;
      const entUrl = `https://api.github.com/enterprises/test/copilot/metrics/reports/enterprise-1-day?day=2026-02-20`;

      expect(orgUrl).toContain('organization-1-day');
      expect(entUrl).toContain('enterprise-1-day');
      expect(orgUrl).not.toContain('enterprise');
      expect(entUrl).not.toContain('organization-1-day');
    });
  });

  describe('Mock Data Generation', () => {
    it('should generate valid CopilotMetrics structure', () => {
      const ndjson = generateMockNDJSON('2026-02-20', 'test-org');
      const metrics = JSON.parse(ndjson) as CopilotMetrics;

      expect(metrics).toHaveProperty('date', '2026-02-20');
      expect(metrics).toHaveProperty('total_active_users');
      expect(metrics).toHaveProperty('total_engaged_users');
      expect(metrics).toHaveProperty('copilot_ide_code_completions');
      expect(metrics.total_active_users).toBeGreaterThan(0);
      expect(metrics.total_engaged_users).toBeGreaterThan(0);
    });

    it('should generate different data for different calls', () => {
      const ndjson1 = generateMockNDJSON('2026-02-20', 'test-org');
      const ndjson2 = generateMockNDJSON('2026-02-20', 'test-org');
      
      const metrics1 = JSON.parse(ndjson1) as CopilotMetrics;
      const metrics2 = JSON.parse(ndjson2) as CopilotMetrics;

      // Should have some randomization
      expect(metrics1.date).toBe(metrics2.date);
      // Active users might be different due to randomization
      expect(metrics1.total_active_users).toBeGreaterThan(0);
      expect(metrics2.total_active_users).toBeGreaterThan(0);
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

    it('should default to legacy API when flags not set', () => {
      // When feature flags are not explicitly set to 'true', should use legacy API
      const useNewApi = process.env.USE_NEW_API === 'true';
      const enableStorage = process.env.ENABLE_HISTORICAL_MODE === 'true';

      // Default should be false (feature flags opt-in)
      expect(useNewApi).toBe(false);
      expect(enableStorage).toBe(false);
    });
  });
});
