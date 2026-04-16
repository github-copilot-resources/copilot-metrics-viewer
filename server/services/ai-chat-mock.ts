/**
 * Mock AI Chat Responses
 *
 * Generates canned LLM-like responses when running in mock mode
 * (NUXT_PUBLIC_IS_DATA_MOCKED=true). This allows E2E and development
 * testing of the AI chat UI without calling the GitHub Models API.
 *
 * The mock simulates tool-calling behavior by actually executing tools
 * against the provided dashboard data and formatting a response.
 */

import { executeTool } from './ai-tool-executor';
import type { H3Event } from 'h3';

interface CachedData {
  metrics?: unknown[];
  originalMetrics?: unknown;
  reportData?: unknown[];
  seats?: unknown[];
  totalSeats?: number;
  userMetrics?: unknown[];
}

interface MockChatResponse {
  answer: string;
  toolsUsed: string[];
  rounds: number;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  mock: boolean;
}

/**
 * Generate a mock chat response by pattern-matching the question
 * and executing actual tools against dashboard data.
 */
export async function generateMockChatResponse(
  question: string,
  currentTab?: string,
  cachedData?: CachedData,
): Promise<MockChatResponse> {
  const q = question.toLowerCase();
  const toolsUsed: string[] = [];

  // Simulate a short delay like a real API call
  await new Promise(resolve => setTimeout(resolve, 300));

  // Determine which tools to "call" based on the question
  const toolResults: string[] = [];

  if (q.includes('summary') || q.includes('overall') || q.includes('overview') || q.includes('adoption')) {
    const result = await executeTool(
      { name: 'get_metrics_summary', arguments: {} },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_metrics_summary');
  }

  if (q.includes('language') || q.includes('typescript') || q.includes('python')) {
    const result = await executeTool(
      { name: 'get_language_breakdown', arguments: { top_n: '5' } },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_language_breakdown');
  }

  if (q.includes('editor') || q.includes('vs code') || q.includes('jetbrains') || q.includes('ide')) {
    const result = await executeTool(
      { name: 'get_editor_breakdown', arguments: {} },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_editor_breakdown');
  }

  if (q.includes('chat') && !q.includes('ai chat')) {
    const result = await executeTool(
      { name: 'get_chat_metrics', arguments: {} },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_chat_metrics');
  }

  if (q.includes('seat') || q.includes('utilization') || q.includes('unused') || q.includes('inactive')) {
    const result = await executeTool(
      { name: 'get_seat_analysis', arguments: {} },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_seat_analysis');
  }

  if (q.includes('user') || q.includes('who') || q.includes('top')) {
    const result = await executeTool(
      { name: 'get_user_metrics', arguments: { top_n: '10' } },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_user_metrics');
  }

  if (q.includes('trend') || q.includes('growth') || q.includes('over time')) {
    const result = await executeTool(
      { name: 'get_trend_data', arguments: { metric: 'active_users' } },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_trend_data');
  }

  if (q.includes('agent') || q.includes('pull request') || q.includes('pr')) {
    const result = await executeTool(
      { name: 'get_agent_activity', arguments: {} },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_agent_activity');
  }

  // If no specific tool matched, provide a general summary
  if (toolResults.length === 0) {
    const result = await executeTool(
      { name: 'get_metrics_summary', arguments: {} },
      cachedData as any,
      {} as H3Event,
    );
    toolResults.push(result.data);
    toolsUsed.push('get_metrics_summary');
  }

  // Format the mock response
  const answer = formatMockAnswer(question, toolResults, toolsUsed);

  return {
    answer,
    toolsUsed,
    rounds: toolsUsed.length > 0 ? 2 : 1,
    usage: {
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
    },
    mock: true,
  };
}

function formatMockAnswer(question: string, toolResults: string[], toolsUsed: string[]): string {
  const parts = [
    `Based on your question about "${question}", here's what I found:\n`,
  ];

  for (const result of toolResults) {
    parts.push(result);
    parts.push('');
  }

  if (toolsUsed.length > 0) {
    parts.push(`*This is a mock response using data from: ${toolsUsed.join(', ')}*`);
  }

  return parts.join('\n');
}
