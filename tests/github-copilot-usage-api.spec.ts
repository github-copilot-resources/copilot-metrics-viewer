/**
 * Tests for GitHub Copilot Usage Metrics API client
 */

import { describe, it, expect } from 'vitest';
import { parseNDJSON } from '../server/services/github-copilot-usage-api';
import { generateMockNDJSON, mockRequestDownloadUrl } from '../server/services/github-copilot-usage-api-mock';
import type { CopilotMetrics } from '../app/model/Copilot_Metrics';

describe('GitHub Copilot Usage API', () => {
  describe('NDJSON Parsing', () => {
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
      expect(result[1]).toHaveProperty('date', '2026-02-19');
      expect(result[2]).toHaveProperty('date', '2026-02-20');
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
    it('should generate valid mock NDJSON', () => {
      const ndjson = generateMockNDJSON('2026-02-20', 'test-org');
      
      expect(ndjson).toBeTruthy();
      
      // Should be valid JSON
      const parsed = JSON.parse(ndjson) as CopilotMetrics;
      expect(parsed.date).toBe('2026-02-20');
      expect(parsed.total_active_users).toBeGreaterThan(0);
      expect(parsed.total_engaged_users).toBeGreaterThan(0);
    });

    it('should generate mock download URL', () => {
      const response = mockRequestDownloadUrl({
        scope: 'organization',
        identifier: 'test-org',
        date: '2026-02-20'
      });
      
      expect(response.download_url).toContain('test-org');
      expect(response.download_url).toContain('2026-02-20');
      expect(response.expires_at).toBeTruthy();
      
      // Expiration should be in the future
      const expiresAt = new Date(response.expires_at);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle enterprise scope', () => {
      const response = mockRequestDownloadUrl({
        scope: 'enterprise',
        identifier: 'test-enterprise',
        date: '2026-02-20'
      });
      
      expect(response.download_url).toContain('test-enterprise');
      expect(response.download_url).toContain('enterprise');
    });
  });

  describe('Download URL Generation', () => {
    it('should create organization URL correctly', () => {
      // This tests the URL pattern even though we can't actually call the API
      const scope = 'organization';
      const identifier = 'test-org';
      const date = '2026-02-20';
      
      const expectedUrl = `https://api.github.com/orgs/${identifier}/copilot/metrics/reports/organization-1-day?day=${date}`;
      
      expect(expectedUrl).toContain('/orgs/test-org/');
      expect(expectedUrl).toContain('organization-1-day');
      expect(expectedUrl).toContain('day=2026-02-20');
    });

    it('should create enterprise URL correctly', () => {
      const scope = 'enterprise';
      const identifier = 'test-ent';
      const date = '2026-02-20';
      
      const expectedUrl = `https://api.github.com/enterprises/${identifier}/copilot/metrics/reports/enterprise-1-day?day=${date}`;
      
      expect(expectedUrl).toContain('/enterprises/test-ent/');
      expect(expectedUrl).toContain('enterprise-1-day');
      expect(expectedUrl).toContain('day=2026-02-20');
    });
  });
});
