import type { Metrics, BreakdownData } from '@/model/Metrics';

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
    const row = [
      metric.day,
      metric.total_suggestions_count.toString(),
      metric.total_acceptances_count.toString(),
      metric.total_lines_suggested.toString(),
      metric.total_lines_accepted.toString(),
      metric.total_active_users.toString(),
      metric.total_chat_acceptances.toString(),
      metric.total_chat_turns.toString(),
      metric.total_active_chat_users.toString(),
      metric.acceptance_rate_by_count.toFixed(2),
      metric.acceptance_rate_by_lines.toFixed(2)
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Converts breakdown data to CSV format
 * @param metrics - Array of metrics data containing breakdown information
 * @returns CSV string for breakdown data
 */
export function convertBreakdownToCSV(metrics: Metrics[]): string {
  if (!metrics || metrics.length === 0) {
    return '';
  }

  // Flatten all breakdown data
  const allBreakdowns: (BreakdownData & { date: string })[] = [];
  metrics.forEach(metric => {
    metric.breakdown.forEach(breakdown => {
      allBreakdowns.push({
        ...breakdown,
        date: metric.day
      });
    });
  });

  if (allBreakdowns.length === 0) {
    return '';
  }

  // Breakdown headers
  const breakdownHeaders = [
    'Date',
    'Language',
    'Editor',
    'Suggestions Count',
    'Acceptances Count',
    'Lines Suggested',
    'Lines Accepted',
    'Active Users',
    'Chat Acceptances',
    'Chat Turns',
    'Active Chat Users'
  ];

  const csvRows: string[] = [];
  csvRows.push(breakdownHeaders.join(','));

  allBreakdowns.forEach(breakdown => {
    const row = [
      breakdown.date,
      breakdown.language,
      breakdown.editor,
      breakdown.suggestions_count.toString(),
      breakdown.acceptances_count.toString(),
      breakdown.lines_suggested.toString(),
      breakdown.lines_accepted.toString(),
      breakdown.active_users.toString(),
      breakdown.chat_acceptances.toString(),
      breakdown.chat_turns.toString(),
      breakdown.active_chat_users.toString()
    ];
    csvRows.push(row.join(','));
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