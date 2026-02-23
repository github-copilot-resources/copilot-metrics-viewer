/**
 * GitHub Copilot Usage Metrics API client
 * Implements the new async file download API for metrics
 */

import { isMockMode, mockRequestDownloadUrl, mockDownloadMetricsFile } from './github-copilot-usage-api-mock';

/**
 * Response from download URL request
 */
export interface DownloadUrlResponse {
  download_url: string;
  expires_at: string;
}

/**
 * Options for requesting metrics report download URL
 */
export interface MetricsReportRequest {
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise';
  identifier: string; // org slug or enterprise slug
  teamSlug?: string;
  date: string; // YYYY-MM-DD format
}

/**
 * Request download URL for a specific day's metrics report
 * 
 * New API endpoint pattern:
 * - Organization: GET /orgs/{org}/copilot/metrics/reports/organization-1-day?day=YYYY-MM-DD
 * - Enterprise: GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day?day=YYYY-MM-DD
 */
export async function requestDownloadUrl(
  request: MetricsReportRequest,
  headers: HeadersInit
): Promise<DownloadUrlResponse> {
  // Check if in mock mode
  if (isMockMode()) {
    return mockRequestDownloadUrl(request);
  }
  
  const { scope, identifier, date } = request;
  
  let url: string;
  if (scope === 'organization' || scope === 'team-organization') {
    url = `https://api.github.com/orgs/${identifier}/copilot/metrics/reports/organization-1-day?day=${date}`;
  } else {
    url = `https://api.github.com/enterprises/${identifier}/copilot/metrics/reports/enterprise-1-day?day=${date}`;
  }
  
  const response = await $fetch<DownloadUrlResponse>(url, { headers });
  return response;
}

/**
 * Download and parse NDJSON file from signed URL
 */
export async function downloadMetricsFile(downloadUrl: string, orgIdentifier?: string): Promise<string> {
  // Check if in mock mode
  if (isMockMode()) {
    return mockDownloadMetricsFile(downloadUrl, orgIdentifier || 'mock-org');
  }
  
  const response = await $fetch<string>(downloadUrl, {
    // No authorization needed for signed URL
    responseType: 'text'
  });
  
  return response;
}

/**
 * Parse NDJSON content into array of objects
 * NDJSON = Newline Delimited JSON (one JSON object per line)
 */
export function parseNDJSON<T = unknown>(content: string): T[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line));
}

/**
 * Complete flow: Request URL, download, and parse metrics for a single day
 */
export async function fetchMetricsForDate(
  request: MetricsReportRequest,
  headers: HeadersInit
): Promise<unknown[]> {
  // Step 1: Request download URL
  const { download_url } = await requestDownloadUrl(request, headers);
  
  // Step 2: Download NDJSON file
  const ndjsonContent = await downloadMetricsFile(download_url, request.identifier);
  
  // Step 3: Parse NDJSON
  const metrics = parseNDJSON(ndjsonContent);
  
  return metrics;
}

/**
 * Fetch metrics for multiple dates
 * Note: This makes multiple API calls - one per day
 */
export async function fetchMetricsForDateRange(
  scope: 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise',
  identifier: string,
  startDate: string,
  endDate: string,
  headers: HeadersInit,
  teamSlug?: string
): Promise<unknown[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const allMetrics: unknown[] = [];
  
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    
    try {
      const metrics = await fetchMetricsForDate(
        { scope, identifier, date: dateStr, teamSlug },
        headers
      );
      allMetrics.push(...metrics);
    } catch (error) {
      console.error(`Failed to fetch metrics for ${dateStr}:`, error);
      // Continue with other dates even if one fails
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return allMetrics;
}
