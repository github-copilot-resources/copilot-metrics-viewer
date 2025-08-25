export interface ExportData {
  [key: string]: string | number | null | undefined;
}

export function exportToCSV(data: ExportData[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = value === null || value === undefined ? '' : String(value);
        return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
          ? `"${stringValue.replace(/"/g, '""')}"` 
          : stringValue;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

export function exportToJSON(data: ExportData[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
}


export async function copyTableToClipboard(data: ExportData[]): Promise<void> {
  if (!data || data.length === 0) {
    console.warn('No data to copy');
    return;
  }

  const headers = Object.keys(data[0] || {});
  
  // Create tab-separated values (good for pasting into spreadsheets)
  const headerRow = headers.join('\t');
  const dataRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      return value === null || value === undefined ? '' : String(value);
    }).join('\t')
  );

  const clipboardContent = [headerRow, ...dataRows].join('\n');

  try {
    await navigator.clipboard.writeText(clipboardContent);
    // You could show a toast notification here
    console.log('Table data copied to clipboard');
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    // Fallback for older browsers
    fallbackCopyToClipboard(clipboardContent);
  }
}

function fallbackCopyToClipboard(text: string): void {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.width = '2em';
  textArea.style.height = '2em';
  textArea.style.padding = '0';
  textArea.style.border = 'none';
  textArea.style.outline = 'none';
  textArea.style.boxShadow = 'none';
  textArea.style.background = 'transparent';
  
  document.body.appendChild(textArea);
  textArea.select();
  
  try {
    document.execCommand('copy');
    console.log('Table data copied to clipboard (fallback)');
  } catch (err) {
    console.error('Fallback copy failed:', err);
  }
  
  document.body.removeChild(textArea);
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
}

export function formatFilename(baseName: string, extension: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  return `${baseName}_${timestamp}.${extension}`;
}