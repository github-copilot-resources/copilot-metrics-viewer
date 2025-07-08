import { describe, it, expect } from 'vitest';
import { convertMetricsToCSV, convertCopilotMetricsToCSV } from '@/utils/csvExport';
import { Metrics, BreakdownData } from '@/model/Metrics';
import { CopilotMetrics, CopilotIdeCodeCompletions, CopilotIdeCodeCompletionsEditor, CopilotIdeCodeCompletionsEditorModel, CopilotIdeCodeCompletionsEditorModelLanguage } from '@/model/Copilot_Metrics';

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
    const csvOutput = convertMetricsToCSV(null as unknown as Metrics[]);
    expect(csvOutput).toBe('');
  });

  it('should convert CopilotMetrics to flattened CSV format', () => {
    // Create mock CopilotMetrics data
    const language = new CopilotIdeCodeCompletionsEditorModelLanguage({
      name: 'TypeScript',
      total_engaged_users: 5,
      total_code_suggestions: 100,
      total_code_acceptances: 80,
      total_code_lines_suggested: 500,
      total_code_lines_accepted: 400
    });

    const model = new CopilotIdeCodeCompletionsEditorModel({
      name: 'claude-3.5-sonnet',
      is_custom_model: false,
      custom_model_training_date: null,
      total_engaged_users: 5,
      languages: [language]
    });

    const editor = new CopilotIdeCodeCompletionsEditor({
      name: 'VS Code',
      total_engaged_users: 5,
      models: [model]
    });

    const codeCompletions = new CopilotIdeCodeCompletions({
      total_engaged_users: 5,
      languages: [],
      editors: [editor]
    });

    const copilotMetrics = new CopilotMetrics({
      date: '2024-01-01',
      total_active_users: 10,
      total_engaged_users: 8,
      copilot_ide_code_completions: codeCompletions,
      copilot_ide_chat: null,
      copilot_dotcom_chat: null,
      copilot_dotcom_pull_requests: null
    });

    const csvOutput = convertCopilotMetricsToCSV([copilotMetrics]);
    
    // Verify headers
    expect(csvOutput).toContain('Date,Total Active Users,Total Engaged Users,Feature Type');
    expect(csvOutput).toContain('Editor Name,Model Name,Is Custom Model');
    expect(csvOutput).toContain('Language Name,Feature Engaged Users');
    expect(csvOutput).toContain('Suggestions Count,Acceptances Count');
    
    // Verify data
    expect(csvOutput).toContain('2024-01-01,10,8,IDE Code Completions');
    expect(csvOutput).toContain('VS Code,claude-3.5-sonnet,false');
    expect(csvOutput).toContain('TypeScript,5,100,80,500,400');
  });

  it('should handle empty CopilotMetrics array', () => {
    const csvOutput = convertCopilotMetricsToCSV([]);
    expect(csvOutput).toBe('');
  });

  it('should handle null/undefined CopilotMetrics', () => {
    const csvOutput = convertCopilotMetricsToCSV(null as unknown as CopilotMetrics[]);
    expect(csvOutput).toBe('');
  });
});