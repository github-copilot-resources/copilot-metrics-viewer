import { describe, it, expect, vi } from 'vitest';
import { convertMetricsToCSV, convertCopilotMetricsToCSV, convertSeatPageToCSV, downloadCSV } from '@/utils/csvExport';
import type { Seat } from '@/model/Seat';
import { Metrics, BreakdownData } from '@/model/Metrics';
import { CopilotMetrics, CopilotIdeCodeCompletions, CopilotIdeCodeCompletionsEditor, CopilotIdeCodeCompletionsEditorModel, CopilotIdeCodeCompletionsEditorModelLanguage } from '@/model/Copilot_Metrics';

describe('CSV Export Utils', () => {
  describe('permitted seat page', () => {
    const seat = (overrides: Partial<Seat> = {}): Seat => ({
      login: 'synthetic-user', id: 0, team: 'synthetic-team',
      created_at: '2026-01-01', plan_type: 'business',
      last_activity_at: '', last_activity_editor: '', ...overrides,
    });

    it('exports only visible columns in supplied page order, with plan and page-relative numbering', () => {
      const input = [
        { ...seat({ login: 'second' }), hidden_identity: 'must-not-export' },
        seat({ login: 'first', id: 42, plan_type: '' }),
      ];
      expect(convertSeatPageToCSV(input, 301)).toBe(
        'S.No,Login,GitHub ID,Assigning team,Assigned time,Last Activity At,Last Activity Editor\r\n' +
        '301,second,0,synthetic-team,2026-01-01 business,,\r\n' +
        '302,first,42,synthetic-team,2026-01-01,,',
      );
      expect(input.map(row => row.login)).toEqual(['second', 'first']);
      expect(convertSeatPageToCSV([])).toBe('');
    });

    it('escapes commas, quotes, CR and LF without changing cell content', () => {
      expect(convertSeatPageToCSV([seat({
        login: 'synthetic,"quoted"', team: 'line1\rline2\nline3\r\nline4',
      })]).split('\r\n').slice(1).join('\r\n')).toBe(
        '1,"synthetic,""quoted""",0,"line1\rline2\nline3\r\nline4",2026-01-01 business,,',
      );
    });

    it.each(['=1+1', '+1', '-1', '@SUM(1)', ' \t=1', '\r\n+1', '\0-1', '\u0085@SUM(1)', '\u200b=1', '\ufeff=1'])(
      'neutralizes synthetic formula prefix %j in every untrusted seat column', value => {
        const row = seat({
          login: value, team: value, created_at: value, plan_type: value,
          last_activity_at: value, last_activity_editor: value,
        });
        const escaped = (cell: string) => /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
        const safe = escaped(`'${value}`);
        const assigned = escaped(`'${value} ${value}`);
        expect(convertSeatPageToCSV([row])).toBe(
          'S.No,Login,GitHub ID,Assigning team,Assigned time,Last Activity At,Last Activity Editor\r\n' +
          `1,${safe},0,${safe},${assigned},${safe},${safe}`,
        );
      },
    );

    it('downloads the seat CSV through a Blob and revokes its object URL', () => {
      const csv = convertSeatPageToCSV([seat()]);
      const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic-seat-page');
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      try {
        downloadCSV(csv, 'seats-page-1.csv');
        expect(create).toHaveBeenCalledWith(expect.any(Blob));
        expect(create.mock.calls[0]?.[0]).toMatchObject({ type: 'text/csv;charset=utf-8;' });
        expect(click.mock.instances[0]).toMatchObject({ download: 'seats-page-1.csv', href: 'blob:synthetic-seat-page' });
        expect(revoke).toHaveBeenCalledWith('blob:synthetic-seat-page');
        expect(document.querySelector('a[download="seats-page-1.csv"]')).toBeNull();
      } finally { vi.restoreAllMocks(); }
    });
  });

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