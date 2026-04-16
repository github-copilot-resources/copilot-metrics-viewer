/**
 * Tests for AI Chat feature — tool definitions, tool executor, and system prompt.
 */

import { describe, it, expect } from 'vitest';
import { aiTools, buildSystemPrompt, getSuggestedQuestions } from '../server/services/ai-tools';
import { executeTool, type ToolCallRequest } from '../server/services/ai-tool-executor';
import type { H3Event } from 'h3';

// Mock H3Event for tool executor
const mockEvent = {} as H3Event;

// --- Sample data fixtures ---

const sampleMetrics = [
  {
    day: '2024-03-01',
    total_suggestions_count: 1000,
    total_acceptances_count: 400,
    total_lines_suggested: 5000,
    total_lines_accepted: 2000,
    total_active_users: 50,
    total_chat_acceptances: 30,
    total_chat_turns: 200,
    total_active_chat_users: 25,
    acceptance_rate_by_count: 40,
    acceptance_rate_by_lines: 40,
    breakdown: [
      {
        language: 'TypeScript',
        editor: 'VS Code',
        suggestions_count: 600,
        acceptances_count: 300,
        lines_suggested: 3000,
        lines_accepted: 1500,
        active_users: 30,
        chat_acceptances: 20,
        chat_turns: 120,
        active_chat_users: 15,
      },
      {
        language: 'Python',
        editor: 'JetBrains',
        suggestions_count: 400,
        acceptances_count: 100,
        lines_suggested: 2000,
        lines_accepted: 500,
        active_users: 20,
        chat_acceptances: 10,
        chat_turns: 80,
        active_chat_users: 10,
      },
    ],
  },
  {
    day: '2024-03-02',
    total_suggestions_count: 1200,
    total_acceptances_count: 500,
    total_lines_suggested: 6000,
    total_lines_accepted: 2500,
    total_active_users: 55,
    total_chat_acceptances: 35,
    total_chat_turns: 250,
    total_active_chat_users: 28,
    acceptance_rate_by_count: 41.7,
    acceptance_rate_by_lines: 41.7,
    breakdown: [
      {
        language: 'TypeScript',
        editor: 'VS Code',
        suggestions_count: 700,
        acceptances_count: 350,
        lines_suggested: 3500,
        lines_accepted: 1750,
        active_users: 35,
        chat_acceptances: 25,
        chat_turns: 150,
        active_chat_users: 18,
      },
      {
        language: 'Python',
        editor: 'JetBrains',
        suggestions_count: 500,
        acceptances_count: 150,
        lines_suggested: 2500,
        lines_accepted: 750,
        active_users: 20,
        chat_acceptances: 10,
        chat_turns: 100,
        active_chat_users: 10,
      },
    ],
  },
];

const sampleSeats = [
  { login: 'alice', id: 1, team: 'frontend', created_at: '2024-01-01', last_activity_at: '2024-03-01', last_activity_editor: 'vscode', plan_type: 'business' },
  { login: 'bob', id: 2, team: 'backend', created_at: '2024-01-01', last_activity_at: '2024-03-02', last_activity_editor: 'vscode', plan_type: 'business' },
  { login: 'charlie', id: 3, team: 'backend', created_at: '2024-01-01', last_activity_at: '2023-01-01', last_activity_editor: 'jetbrains', plan_type: 'business' },
];

const sampleUserMetrics = [
  { login: 'alice', user_id: 1, user_initiated_interaction_count: 500, code_generation_activity_count: 300, code_acceptance_activity_count: 200, loc_suggested_to_add_sum: 1000, loc_added_sum: 500 },
  { login: 'bob', user_id: 2, user_initiated_interaction_count: 300, code_generation_activity_count: 200, code_acceptance_activity_count: 150, loc_suggested_to_add_sum: 800, loc_added_sum: 400 },
  { login: 'charlie', user_id: 3, user_initiated_interaction_count: 0, code_generation_activity_count: 0, code_acceptance_activity_count: 0, loc_suggested_to_add_sum: 0, loc_added_sum: 0 },
];

const sampleReportData = [
  {
    day: '2024-03-01',
    organization_id: 'org1',
    enterprise_id: 'ent1',
    daily_active_users: 50,
    weekly_active_users: 100,
    monthly_active_users: 200,
    monthly_active_agent_users: 10,
    user_initiated_interaction_count: 500,
    code_generation_activity_count: 300,
    code_acceptance_activity_count: 200,
    totals_by_ide: [],
    totals_by_feature: [],
    totals_by_language_feature: [],
    totals_by_language_model: [],
    totals_by_model_feature: [],
    loc_suggested_to_add_sum: 1000,
    loc_suggested_to_delete_sum: 100,
    loc_added_sum: 500,
    loc_deleted_sum: 50,
    pull_requests: {
      total_created: 20,
      total_reviewed: 15,
      total_merged: 10,
      total_suggestions: 30,
      total_applied_suggestions: 20,
      total_created_by_copilot: 5,
      total_reviewed_by_copilot: 3,
      total_merged_created_by_copilot: 2,
      total_copilot_suggestions: 25,
      total_copilot_applied_suggestions: 15,
    },
  },
];

// -------------------------------------------------------------------
// Tool Definitions Tests
// -------------------------------------------------------------------

describe('AI Tool Definitions', () => {
  it('should export an array of tool definitions', () => {
    expect(Array.isArray(aiTools)).toBe(true);
    expect(aiTools.length).toBeGreaterThan(0);
  });

  it('each tool should have valid OpenAI schema', () => {
    for (const tool of aiTools) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters.type).toBe('object');
    }
  });

  it('should include expected tool names', () => {
    const names = aiTools.map(t => t.function.name);
    expect(names).toContain('get_metrics_summary');
    expect(names).toContain('get_language_breakdown');
    expect(names).toContain('get_editor_breakdown');
    expect(names).toContain('get_chat_metrics');
    expect(names).toContain('get_seat_analysis');
    expect(names).toContain('get_user_metrics');
    expect(names).toContain('get_trend_data');
    expect(names).toContain('get_agent_activity');
  });

  it('get_trend_data should require "metric" parameter', () => {
    const trendTool = aiTools.find(t => t.function.name === 'get_trend_data');
    expect(trendTool).toBeDefined();
    expect(trendTool!.function.parameters.required).toContain('metric');
  });
});

// -------------------------------------------------------------------
// System Prompt Tests
// -------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe('string');
  });

  it('should include current tab context', () => {
    const prompt = buildSystemPrompt({ currentTab: 'languages' });
    expect(prompt).toContain('languages');
  });

  it('should include scope and identifier', () => {
    const prompt = buildSystemPrompt({ scope: 'enterprise', identifier: 'my-corp' });
    expect(prompt).toContain('enterprise');
    expect(prompt).toContain('my-corp');
  });

  it('should include date range', () => {
    const prompt = buildSystemPrompt({ dateRange: { since: '2024-01-01', until: '2024-03-01' } });
    expect(prompt).toContain('2024-01-01');
    expect(prompt).toContain('2024-03-01');
  });
});

// -------------------------------------------------------------------
// Suggested Questions Tests
// -------------------------------------------------------------------

describe('getSuggestedQuestions', () => {
  it('should return questions for undefined tab', () => {
    const questions = getSuggestedQuestions();
    expect(questions.length).toBeGreaterThan(0);
  });

  it('should return tab-specific questions for languages', () => {
    const questions = getSuggestedQuestions('languages');
    expect(questions.some(q => q.toLowerCase().includes('language'))).toBe(true);
  });

  it('should return tab-specific questions for seat analysis', () => {
    const questions = getSuggestedQuestions('seat analysis');
    expect(questions.some(q => q.toLowerCase().includes('seat'))).toBe(true);
  });
});

// -------------------------------------------------------------------
// Tool Executor Tests
// -------------------------------------------------------------------

describe('AI Tool Executor', () => {
  const cachedData = {
    metrics: sampleMetrics as any,
    originalMetrics: undefined,
    reportData: sampleReportData as any,
    seats: sampleSeats as any,
    totalSeats: 3,
    userMetrics: sampleUserMetrics as any,
  };

  describe('get_metrics_summary', () => {
    it('should return summary with key metrics', async () => {
      const result = await executeTool({ name: 'get_metrics_summary', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('Metrics Summary');
      expect(result.data).toContain('acceptance rate');
      expect(result.data).toContain('active users');
    });

    it('should handle empty metrics', async () => {
      const result = await executeTool({ name: 'get_metrics_summary', arguments: {} }, { ...cachedData, metrics: [] }, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('No metrics data');
    });
  });

  describe('get_language_breakdown', () => {
    it('should return language breakdown', async () => {
      const result = await executeTool({ name: 'get_language_breakdown', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('TypeScript');
      expect(result.data).toContain('Python');
    });

    it('should respect top_n parameter', async () => {
      const result = await executeTool({ name: 'get_language_breakdown', arguments: { top_n: '1' } }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('TypeScript');
      // Python should not appear (only top 1)
      const lines = result.data.split('\n').filter(l => l.startsWith('- '));
      expect(lines.length).toBe(1);
    });
  });

  describe('get_editor_breakdown', () => {
    it('should return editor breakdown', async () => {
      const result = await executeTool({ name: 'get_editor_breakdown', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('VS Code');
      expect(result.data).toContain('JetBrains');
    });
  });

  describe('get_chat_metrics', () => {
    it('should return chat metrics', async () => {
      const result = await executeTool({ name: 'get_chat_metrics', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('Chat Metrics');
      expect(result.data).toContain('chat turns');
    });
  });

  describe('get_seat_analysis', () => {
    it('should return seat analysis', async () => {
      const result = await executeTool({ name: 'get_seat_analysis', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('Seat Analysis');
      expect(result.data).toContain('Total seats: 3');
    });

    it('should identify inactive users', async () => {
      const result = await executeTool({ name: 'get_seat_analysis', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('charlie');
    });

    it('should handle empty seats', async () => {
      const result = await executeTool({ name: 'get_seat_analysis', arguments: {} }, { ...cachedData, seats: [] }, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('No seat data');
    });
  });

  describe('get_user_metrics', () => {
    it('should return top users by activity', async () => {
      const result = await executeTool({ name: 'get_user_metrics', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('alice');
      expect(result.data).toContain('bob');
    });

    it('should filter by user_login', async () => {
      const result = await executeTool({ name: 'get_user_metrics', arguments: { user_login: 'alice' } }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('alice');
      expect(result.data).toContain('Interactions');
    });

    it('should handle unknown user', async () => {
      const result = await executeTool({ name: 'get_user_metrics', arguments: { user_login: 'nobody' } }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('No metrics found');
    });
  });

  describe('get_trend_data', () => {
    it('should return trend data for active_users', async () => {
      const result = await executeTool({ name: 'get_trend_data', arguments: { metric: 'active_users' } }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('2024-03-01');
      expect(result.data).toContain('50');
      expect(result.data).toContain('55');
    });

    it('should return trend data for acceptance_rate', async () => {
      const result = await executeTool({ name: 'get_trend_data', arguments: { metric: 'acceptance_rate' } }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('acceptance_rate');
    });

    it('should error on missing metric', async () => {
      const result = await executeTool({ name: 'get_trend_data', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(false);
      expect(result.data).toContain('required');
    });

    it('should error on unknown metric', async () => {
      const result = await executeTool({ name: 'get_trend_data', arguments: { metric: 'bogus' } }, cachedData, mockEvent);
      expect(result.success).toBe(false);
      expect(result.data).toContain('Unknown metric');
    });
  });

  describe('get_agent_activity', () => {
    it('should return agent and PR activity', async () => {
      const result = await executeTool({ name: 'get_agent_activity', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('PRs created: 20');
      expect(result.data).toContain('Copilot-authored PRs: 5');
    });

    it('should handle empty report data', async () => {
      const result = await executeTool({ name: 'get_agent_activity', arguments: {} }, { ...cachedData, reportData: [] }, mockEvent);
      expect(result.success).toBe(true);
      expect(result.data).toContain('No report/agent data');
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const result = await executeTool({ name: 'nonexistent_tool', arguments: {} }, cachedData, mockEvent);
      expect(result.success).toBe(false);
      expect(result.data).toContain('Unknown tool');
    });
  });
});
