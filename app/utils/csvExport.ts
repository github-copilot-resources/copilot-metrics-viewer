import type { Metrics } from '@/model/Metrics';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';

/**
 * Converts metrics data to CSV format
 * @param metrics - Array of metrics data
 * @returns CSV string ready for download
 */
export function convertMetricsToCSV(metrics: Metrics[]): string {
  if (!metrics || metrics.length === 0) {
    return '';
  }

  // Main metrics headers
  const mainHeaders = [
    'Date',
    'Total Suggestions',
    'Total Acceptances',
    'Total Lines Suggested',
    'Total Lines Accepted',
    'Total Active Users',
    'Total Chat Acceptances',
    'Total Chat Turns',
    'Total Active Chat Users',
    'Acceptance Rate by Count (%)',
    'Acceptance Rate by Lines (%)'
  ];

  // Create CSV rows for main metrics
  const csvRows: string[] = [];
  csvRows.push(mainHeaders.join(','));

  metrics.forEach(metric => {
    if (metric) {
      const row = [
        metric.day,
        metric.total_suggestions_count?.toString() || '0',
        metric.total_acceptances_count?.toString() || '0',
        metric.total_lines_suggested?.toString() || '0',
        metric.total_lines_accepted?.toString() || '0',
        metric.total_active_users?.toString() || '0',
        metric.total_chat_acceptances?.toString() || '0',
        metric.total_chat_turns?.toString() || '0',
        metric.total_active_chat_users?.toString() || '0',
        metric.acceptance_rate_by_count?.toFixed(2) || '0.00',
        metric.acceptance_rate_by_lines?.toFixed(2) || '0.00'
      ];
      csvRows.push(row.join(','));
    }
  });

  return csvRows.join('\n');
}

/**
 * Converts raw CopilotMetrics data to flattened CSV format by day
 * @param metrics - Array of CopilotMetrics data
 * @returns CSV string with all metrics flattened by day
 */
export function convertCopilotMetricsToCSV(metrics: CopilotMetrics[]): string {
  if (!metrics || metrics.length === 0) {
    return '';
  }

  // Create flattened rows for each day
  const flattenedRows: Record<string, string | number | boolean | null>[] = [];
  
  metrics.forEach(metric => {
    if (!metric) return;
    
    // IDE Code Completions - by Editor and Model and Language
    if (metric.copilot_ide_code_completions && metric.copilot_ide_code_completions.editors) {
      metric.copilot_ide_code_completions.editors.forEach(editor => {
        if (editor && editor.models) {
          editor.models.forEach(model => {
            if (model && model.languages) {
              model.languages.forEach(language => {
                if (language) {
                  flattenedRows.push({
                    date: metric.date,
                    total_active_users: metric.total_active_users,
                    total_engaged_users: metric.total_engaged_users,
                    feature_type: 'IDE Code Completions',
                    editor_name: editor.name,
                    model_name: model.name,
                    is_custom_model: model.is_custom_model,
                    custom_model_training_date: model.custom_model_training_date || '',
                    language_name: language.name,
                    feature_engaged_users: language.total_engaged_users,
                    suggestions_count: language.total_code_suggestions,
                    acceptances_count: language.total_code_acceptances,
                    lines_suggested: language.total_code_lines_suggested,
                    lines_accepted: language.total_code_lines_accepted,
                    chats: null,
                    chat_insertion_events: null,
                    chat_copy_events: null,
                    pr_summaries_created: null,
                    repository_name: null
                  });
                }
              });
            }
          });
        }
      });
    }

    // IDE Chat - by Editor and Model  
    if (metric.copilot_ide_chat && metric.copilot_ide_chat.editors) {
      metric.copilot_ide_chat.editors.forEach(editor => {
        if (editor && editor.models) {
          editor.models.forEach(model => {
            if (model) {
              flattenedRows.push({
                date: metric.date,
                total_active_users: metric.total_active_users,
                total_engaged_users: metric.total_engaged_users,
                feature_type: 'IDE Chat',
                editor_name: editor.name,
                model_name: model.name,
                is_custom_model: model.is_custom_model,
                custom_model_training_date: model.custom_model_training_date || '',
                language_name: null,
                feature_engaged_users: model.total_engaged_users,
                suggestions_count: null,
                acceptances_count: null,
                lines_suggested: null,
                lines_accepted: null,
                chats: model.total_chats,
                chat_insertion_events: model.total_chat_insertion_events,
                chat_copy_events: model.total_chat_copy_events,
                pr_summaries_created: null,
                repository_name: null
              });
            }
          });
        }
      });
    }

    // Dotcom Chat - by Model
    if (metric.copilot_dotcom_chat && metric.copilot_dotcom_chat.models) {
      metric.copilot_dotcom_chat.models.forEach(model => {
        if (model) {
          flattenedRows.push({
            date: metric.date,
            total_active_users: metric.total_active_users,
            total_engaged_users: metric.total_engaged_users,
            feature_type: 'Dotcom Chat',
            editor_name: null,
            model_name: model.name,
            is_custom_model: model.is_custom_model,
            custom_model_training_date: model.custom_model_training_date || '',
            language_name: null,
            feature_engaged_users: model.total_engaged_users,
            suggestions_count: null,
            acceptances_count: null,
            lines_suggested: null,
            lines_accepted: null,
            chats: model.total_chats,
            chat_insertion_events: null,
            chat_copy_events: null,
            pr_summaries_created: null,
            repository_name: null
          });
        }
      });
    }

    // Dotcom Pull Requests - by Repository and Model
    if (metric.copilot_dotcom_pull_requests && metric.copilot_dotcom_pull_requests.repositories) {
      metric.copilot_dotcom_pull_requests.repositories.forEach(repo => {
        if (repo && repo.models) {
          repo.models.forEach(model => {
            if (model) {
              flattenedRows.push({
                date: metric.date,
                total_active_users: metric.total_active_users,
                total_engaged_users: metric.total_engaged_users,
                feature_type: 'Dotcom Pull Requests',
                editor_name: null,
                model_name: model.name,
                is_custom_model: model.is_custom_model,
                custom_model_training_date: model.custom_model_training_date || '',
                language_name: null,
                feature_engaged_users: model.total_engaged_users,
                suggestions_count: null,
                acceptances_count: null,
                lines_suggested: null,
                lines_accepted: null,
                chats: null,
                chat_insertion_events: null,
                chat_copy_events: null,
                pr_summaries_created: model.total_pr_summaries_created,
                repository_name: repo.name
              });
            }
          });
        }
      });
    }
  });

  if (flattenedRows.length === 0) {
    return '';
  }

  // Define headers for flattened CSV
  const headers = [
    'Date',
    'Total Active Users',
    'Total Engaged Users',
    'Feature Type',
    'Editor Name',
    'Model Name',
    'Is Custom Model',
    'Custom Model Training Date',
    'Language Name',
    'Feature Engaged Users',
    'Suggestions Count',
    'Acceptances Count',
    'Lines Suggested',
    'Lines Accepted',
    'Chats',
    'Chat Insertion Events',
    'Chat Copy Events',
    'PR Summaries Created',
    'Repository Name'
  ];

  // Create CSV rows
  const csvRows: string[] = [];
  csvRows.push(headers.join(','));

  flattenedRows.forEach(row => {
    if (row) {
      const csvRow = [
        row.date,
        row.total_active_users?.toString() || '',
        row.total_engaged_users?.toString() || '',
        row.feature_type || '',
        row.editor_name || '',
        row.model_name || '',
        row.is_custom_model?.toString() || '',
        row.custom_model_training_date || '',
        row.language_name || '',
        row.feature_engaged_users?.toString() || '',
        row.suggestions_count?.toString() || '',
        row.acceptances_count?.toString() || '',
        row.lines_suggested?.toString() || '',
        row.lines_accepted?.toString() || '',
        row.chats?.toString() || '',
        row.chat_insertion_events?.toString() || '',
        row.chat_copy_events?.toString() || '',
        row.pr_summaries_created?.toString() || '',
        row.repository_name || ''
      ];
      csvRows.push(csvRow.join(','));
    }
  });

  return csvRows.join('\n');
}

/**
 * Triggers a CSV file download in the browser
 * @param csvContent - CSV content as string
 * @param filename - Name of the file to download
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}