/**
 * Mock GitHub Copilot Usage Metrics API for testing
 * Simulates the new async download API behavior
 */

import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { DownloadUrlResponse, MetricsReportRequest } from './github-copilot-usage-api';

/**
 * Generate mock NDJSON content for a date
 */
export function generateMockNDJSON(date: string, orgIdentifier: string): string {
  const mockMetrics: CopilotMetrics = {
    date,
    total_active_users: 100 + Math.floor(Math.random() * 50),
    total_engaged_users: 80 + Math.floor(Math.random() * 40),
    copilot_ide_code_completions: {
      total_engaged_users: 75 + Math.floor(Math.random() * 30),
      languages: [
        {
          name: 'TypeScript',
          total_engaged_users: 50
        },
        {
          name: 'JavaScript',
          total_engaged_users: 30
        },
        {
          name: 'Python',
          total_engaged_users: 20
        }
      ],
      editors: [
        {
          name: 'vscode',
          total_engaged_users: 70,
          models: [
            {
              name: 'default',
              is_custom_model: false,
              custom_model_training_date: null,
              total_engaged_users: 70,
              languages: []
            }
          ]
        }
      ]
    },
    copilot_ide_chat: {
      total_engaged_users: 40,
      editors: []
    },
    copilot_dotcom_chat: {
      total_engaged_users: 20,
      models: []
    },
    copilot_dotcom_pull_requests: {
      total_engaged_users: 15,
      repositories: []
    }
  };
  
  // Return as NDJSON (one line)
  return JSON.stringify(mockMetrics);
}

/**
 * Mock implementation of requestDownloadUrl
 */
export function mockRequestDownloadUrl(request: MetricsReportRequest): DownloadUrlResponse {
  const { scope, identifier, date } = request;
  
  // Generate a fake signed URL
  const mockUrl = `https://mock-copilot-reports.github.com/reports/${scope}/${identifier}/${date}.ndjson?signature=mock&expires=9999999999`;
  
  return {
    download_url: mockUrl,
    expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
  };
}

/**
 * Mock implementation of downloadMetricsFile
 */
export function mockDownloadMetricsFile(downloadUrl: string, orgIdentifier: string): string {
  // Extract date from URL (simplified)
  const dateMatch = downloadUrl.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  
  return generateMockNDJSON(date, orgIdentifier);
}

/**
 * Check if we're in mock mode
 */
export function isMockMode(): boolean {
  const config = useRuntimeConfig();
  return config.public.isDataMocked === true || config.public.isDataMocked === 'true';
}
