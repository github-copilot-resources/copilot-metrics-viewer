/**
 * Tests for metrics storage implementation
 */

import { describe, it, expect, afterEach } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { 
  saveMetrics, 
  getMetrics, 
  getMetricsByDateRange,
  hasMetrics,
  deleteMetrics
} from '../../server/storage/metrics-storage';
import type { CopilotMetrics } from '../../app/model/Copilot_Metrics';

// Setup Nuxt environment for tests
await setup({
  server: true,
});

// Mock data
const mockMetrics: CopilotMetrics = {
  date: '2026-02-20',
  total_active_users: 100,
  total_engaged_users: 80,
  copilot_ide_code_completions: {
    total_engaged_users: 75,
    languages: [],
    editors: []
  },
  copilot_ide_chat: null,
  copilot_dotcom_chat: null,
  copilot_dotcom_pull_requests: null
};

describe('Metrics Storage', () => {
  const scope = 'organization';
  const scopeIdentifier = 'test-org';
  const metricsDate = '2026-02-20';

  afterEach(async () => {
    // Clean up after each test
    try {
      await deleteMetrics(scope, scopeIdentifier, metricsDate);
    } catch (error) {
      // Ignore errors if key doesn't exist
    }
  });

  it('should save and retrieve metrics', async () => {
    await saveMetrics(scope, scopeIdentifier, metricsDate, mockMetrics);
    
    const retrieved = await getMetrics(scope, scopeIdentifier, metricsDate);
    expect(retrieved).toBeDefined();
    expect(retrieved?.date).toBe(mockMetrics.date);
    expect(retrieved?.total_active_users).toBe(mockMetrics.total_active_users);
  });

  it('should return null for non-existent metrics', async () => {
    const retrieved = await getMetrics(scope, scopeIdentifier, '2026-01-01');
    expect(retrieved).toBeNull();
  });

  it('should check if metrics exist', async () => {
    const exists1 = await hasMetrics(scope, scopeIdentifier, metricsDate);
    expect(exists1).toBe(false);

    await saveMetrics(scope, scopeIdentifier, metricsDate, mockMetrics);

    const exists2 = await hasMetrics(scope, scopeIdentifier, metricsDate);
    expect(exists2).toBe(true);
  });

  it('should delete metrics', async () => {
    await saveMetrics(scope, scopeIdentifier, metricsDate, mockMetrics);
    expect(await hasMetrics(scope, scopeIdentifier, metricsDate)).toBe(true);

    await deleteMetrics(scope, scopeIdentifier, metricsDate);
    expect(await hasMetrics(scope, scopeIdentifier, metricsDate)).toBe(false);
  });

  it('should handle team scope metrics', async () => {
    const teamSlug = 'test-team';
    
    await saveMetrics(scope, scopeIdentifier, metricsDate, mockMetrics, teamSlug);
    
    const retrieved = await getMetrics(scope, scopeIdentifier, metricsDate, teamSlug);
    expect(retrieved).toBeDefined();
    expect(retrieved?.date).toBe(mockMetrics.date);
    
    // Clean up
    await deleteMetrics(scope, scopeIdentifier, metricsDate, teamSlug);
  });

  it('should retrieve metrics by date range', async () => {
    // Save metrics for multiple dates
    const dates = ['2026-02-18', '2026-02-19', '2026-02-20'];
    
    for (const date of dates) {
      const metrics = { ...mockMetrics, date };
      await saveMetrics(scope, scopeIdentifier, date, metrics);
    }

    // Retrieve date range
    const results = await getMetricsByDateRange({
      scope,
      scopeIdentifier,
      startDate: '2026-02-18',
      endDate: '2026-02-20'
    });

    expect(results).toHaveLength(3);
    expect(results[0].date).toBe('2026-02-18');
    expect(results[2].date).toBe('2026-02-20');

    // Clean up
    for (const date of dates) {
      await deleteMetrics(scope, scopeIdentifier, date);
    }
  });

  it('should handle date range with missing dates', async () => {
    // Save only some dates
    await saveMetrics(scope, scopeIdentifier, '2026-02-18', { ...mockMetrics, date: '2026-02-18' });
    await saveMetrics(scope, scopeIdentifier, '2026-02-20', { ...mockMetrics, date: '2026-02-20' });

    const results = await getMetricsByDateRange({
      scope,
      scopeIdentifier,
      startDate: '2026-02-18',
      endDate: '2026-02-20'
    });

    // Should only return the two dates that exist
    expect(results).toHaveLength(2);
    expect(results[0].date).toBe('2026-02-18');
    expect(results[1].date).toBe('2026-02-20');

    // Clean up
    await deleteMetrics(scope, scopeIdentifier, '2026-02-18');
    await deleteMetrics(scope, scopeIdentifier, '2026-02-20');
  });
});
