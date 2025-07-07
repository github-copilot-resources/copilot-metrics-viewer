import { describe, it, expect } from 'vitest';
import { convertMetricsToCSV } from '@/utils/csvExport';
import { Metrics, BreakdownData } from '@/model/Metrics';

describe('CSV Export Utils', () => {
  it('should convert metrics to CSV format', () => {
    // Create mock metrics data
    const breakdownData = new BreakdownData({
      language: 'TypeScript',
      editor: 'VS Code',
      suggestions_count: 100,
      acceptances_count: 80,
      lines_suggested: 500,
      lines_accepted: 400,
      active_users: 5,
      chat_acceptances: 10,
      chat_turns: 15,
      active_chat_users: 3
    });

    const metrics = new Metrics({
      day: '2024-01-01',
      total_suggestions_count: 100,
      total_acceptances_count: 80,
      total_lines_suggested: 500,
      total_lines_accepted: 400,
      total_active_users: 5,
      total_chat_acceptances: 10,
      total_chat_turns: 15,
      total_active_chat_users: 3,
      breakdown: [breakdownData]
    });

    const csvOutput = convertMetricsToCSV([metrics]);
    
    // Verify headers
    expect(csvOutput).toContain('Date,Total Suggestions,Total Acceptances');
    expect(csvOutput).toContain('Total Lines Suggested,Total Lines Accepted');
    expect(csvOutput).toContain('Acceptance Rate by Count (%),Acceptance Rate by Lines (%)');
    
    // Verify data
    expect(csvOutput).toContain('2024-01-01,100,80,500,400,5,10,15,3');
    expect(csvOutput).toContain('80.00,80.00'); // Acceptance rates
  });

  it('should handle empty metrics array', () => {
    const csvOutput = convertMetricsToCSV([]);
    expect(csvOutput).toBe('');
  });

  it('should handle null/undefined metrics', () => {
    const csvOutput = convertMetricsToCSV(null as any);
    expect(csvOutput).toBe('');
  });
});