/**
 * AI Tool Executor
 *
 * Executes tool calls from the LLM by reusing the existing server-side
 * data-fetching logic. Each tool function returns a concise string
 * representation of the data for the LLM to reason over.
 */

import type { H3Event } from 'h3';
import type { Metrics } from '@/model/Metrics';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { ReportDayTotals } from '../services/github-copilot-usage-api';
import type { Seat } from '@/model/Seat';
import type { UserTotals } from '../services/github-copilot-usage-api';
import { CHAT_FEATURES, AGENT_FEATURES, FEATURE_LABELS } from '../../shared/utils/feature-classification';

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, string>;
}

export interface ToolCallResult {
  success: boolean;
  data: string;
}

interface CachedData {
  metrics?: Metrics[];
  originalMetrics?: CopilotMetrics[];
  reportData?: ReportDayTotals[];
  seats?: Seat[];
  totalSeats?: number;
  userMetrics?: UserTotals[];
}

/**
 * Execute a single tool call and return the result as a string.
 *
 * Rather than making internal HTTP requests to our own API endpoints (which
 * would complicate auth forwarding), we accept pre-fetched data from the
 * chat endpoint that already has it from the dashboard context.
 */
export async function executeTool(
  toolCall: ToolCallRequest,
  cachedData: CachedData,
  _event: H3Event,
): Promise<ToolCallResult> {
  try {
    switch (toolCall.name) {
      case 'get_metrics_summary':
        return getMetricsSummary(cachedData);
      case 'get_language_breakdown':
        return getLanguageBreakdown(cachedData, toolCall.arguments);
      case 'get_editor_breakdown':
        return getEditorBreakdown(cachedData);
      case 'get_chat_metrics':
        return getChatMetrics(cachedData);
      case 'get_seat_analysis':
        return getSeatAnalysis(cachedData);
      case 'get_user_metrics':
        return getUserMetrics(cachedData, toolCall.arguments);
      case 'get_trend_data':
        return getTrendData(cachedData, toolCall.arguments);
      case 'get_agent_activity':
        return getAgentActivity(cachedData);
      default:
        return { success: false, data: `Unknown tool: ${toolCall.name}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, data: `Tool execution error: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

function getMetricsSummary(data: CachedData): ToolCallResult {
  const metrics = data.metrics;
  if (!metrics || metrics.length === 0) {
    return { success: true, data: 'No metrics data available for the selected date range.' };
  }

  const days = metrics.length;
  const totalSuggestions = metrics.reduce((s, m) => s + m.total_suggestions_count, 0);
  const totalAcceptances = metrics.reduce((s, m) => s + m.total_acceptances_count, 0);
  const totalLinesSuggested = metrics.reduce((s, m) => s + m.total_lines_suggested, 0);
  const totalLinesAccepted = metrics.reduce((s, m) => s + m.total_lines_accepted, 0);
  const avgActiveUsers = Math.round(metrics.reduce((s, m) => s + m.total_active_users, 0) / days);
  const avgChatUsers = Math.round(metrics.reduce((s, m) => s + m.total_active_chat_users, 0) / days);
  const totalChatTurns = metrics.reduce((s, m) => s + m.total_chat_turns, 0);
  const acceptanceRate = totalSuggestions > 0 ? ((totalAcceptances / totalSuggestions) * 100).toFixed(1) : '0';
  const lineAcceptanceRate = totalLinesSuggested > 0 ? ((totalLinesAccepted / totalLinesSuggested) * 100).toFixed(1) : '0';

  const dateRange = `${metrics[0]!.day} to ${metrics[metrics.length - 1]!.day}`;

  return {
    success: true,
    data: [
      `Metrics Summary (${dateRange}, ${days} days):`,
      `- Average daily active users: ${avgActiveUsers}`,
      `- Total suggestions: ${totalSuggestions.toLocaleString()}`,
      `- Total acceptances: ${totalAcceptances.toLocaleString()}`,
      `- Acceptance rate (by count): ${acceptanceRate}%`,
      `- Total lines suggested: ${totalLinesSuggested.toLocaleString()}`,
      `- Total lines accepted: ${totalLinesAccepted.toLocaleString()}`,
      `- Line acceptance rate: ${lineAcceptanceRate}%`,
      `- Average daily chat users: ${avgChatUsers}`,
      `- Total chat turns: ${totalChatTurns.toLocaleString()}`,
    ].join('\n'),
  };
}

function getLanguageBreakdown(data: CachedData, args: Record<string, string>): ToolCallResult {
  const metrics = data.metrics;
  if (!metrics || metrics.length === 0) {
    return { success: true, data: 'No metrics data available.' };
  }

  const topN = parseInt(args.top_n || '10', 10);

  // Aggregate breakdown by language across all days
  const langMap = new Map<string, {
    suggestions: number; acceptances: number;
    linesSuggested: number; linesAccepted: number; activeUsers: number;
  }>();

  for (const m of metrics) {
    for (const b of m.breakdown) {
      const existing = langMap.get(b.language) || { suggestions: 0, acceptances: 0, linesSuggested: 0, linesAccepted: 0, activeUsers: 0 };
      existing.suggestions += b.suggestions_count;
      existing.acceptances += b.acceptances_count;
      existing.linesSuggested += b.lines_suggested;
      existing.linesAccepted += b.lines_accepted;
      existing.activeUsers += b.active_users;
      langMap.set(b.language, existing);
    }
  }

  const sorted = [...langMap.entries()]
    .sort((a, b) => b[1].suggestions - a[1].suggestions)
    .slice(0, topN);

  if (sorted.length === 0) {
    return { success: true, data: 'No language breakdown data available.' };
  }

  const lines = [`Language Breakdown (top ${topN}):`];
  for (const [lang, stats] of sorted) {
    const rate = stats.suggestions > 0 ? ((stats.acceptances / stats.suggestions) * 100).toFixed(1) : '0';
    lines.push(
      `- ${lang}: ${stats.suggestions.toLocaleString()} suggestions, ${stats.acceptances.toLocaleString()} acceptances (${rate}%), ` +
      `${stats.linesAccepted.toLocaleString()} lines accepted`,
    );
  }

  return { success: true, data: lines.join('\n') };
}

function getEditorBreakdown(data: CachedData): ToolCallResult {
  const metrics = data.metrics;
  if (!metrics || metrics.length === 0) {
    return { success: true, data: 'No metrics data available.' };
  }

  const editorMap = new Map<string, {
    suggestions: number; acceptances: number;
    linesSuggested: number; linesAccepted: number; activeUsers: number;
  }>();

  for (const m of metrics) {
    for (const b of m.breakdown) {
      const existing = editorMap.get(b.editor) || { suggestions: 0, acceptances: 0, linesSuggested: 0, linesAccepted: 0, activeUsers: 0 };
      existing.suggestions += b.suggestions_count;
      existing.acceptances += b.acceptances_count;
      existing.linesSuggested += b.lines_suggested;
      existing.linesAccepted += b.lines_accepted;
      existing.activeUsers += b.active_users;
      editorMap.set(b.editor, existing);
    }
  }

  const sorted = [...editorMap.entries()]
    .sort((a, b) => b[1].suggestions - a[1].suggestions);

  if (sorted.length === 0) {
    return { success: true, data: 'No editor breakdown data available.' };
  }

  const lines = ['Editor Breakdown:'];
  for (const [editor, stats] of sorted) {
    const rate = stats.suggestions > 0 ? ((stats.acceptances / stats.suggestions) * 100).toFixed(1) : '0';
    lines.push(
      `- ${editor}: ${stats.suggestions.toLocaleString()} suggestions, ${stats.acceptances.toLocaleString()} acceptances (${rate}%), ` +
      `${stats.activeUsers.toLocaleString()} active user-days`,
    );
  }

  return { success: true, data: lines.join('\n') };
}

function getChatMetrics(data: CachedData): ToolCallResult {
  const metrics = data.metrics;
  if (!metrics || metrics.length === 0) {
    return { success: true, data: 'No metrics data available.' };
  }

  const days = metrics.length;
  const totalChatTurns = metrics.reduce((s, m) => s + m.total_chat_turns, 0);
  const totalChatAcceptances = metrics.reduce((s, m) => s + m.total_chat_acceptances, 0);
  const avgChatUsers = Math.round(metrics.reduce((s, m) => s + m.total_active_chat_users, 0) / days);
  const maxChatUsers = Math.max(...metrics.map(m => m.total_active_chat_users));

  return {
    success: true,
    data: [
      `Chat Metrics (${days} days):`,
      `- Total chat turns: ${totalChatTurns.toLocaleString()}`,
      `- Total chat acceptances: ${totalChatAcceptances.toLocaleString()}`,
      `- Average daily active chat users: ${avgChatUsers}`,
      `- Peak daily chat users: ${maxChatUsers}`,
      `- Avg turns per day: ${(totalChatTurns / days).toFixed(1)}`,
    ].join('\n'),
  };
}

function getSeatAnalysis(data: CachedData): ToolCallResult {
  const seats = data.seats;
  const totalSeats = data.totalSeats;
  if (!seats || seats.length === 0) {
    return { success: true, data: 'No seat data available. The seat analysis may not be loaded yet.' };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const active = seats.filter(s => s.last_activity_at && new Date(s.last_activity_at) >= thirtyDaysAgo);
  const inactive = seats.filter(s => !s.last_activity_at || new Date(s.last_activity_at) < thirtyDaysAgo);

  const planTypes = new Map<string, number>();
  for (const s of seats) {
    planTypes.set(s.plan_type || 'unknown', (planTypes.get(s.plan_type || 'unknown') || 0) + 1);
  }

  const lines = [
    `Seat Analysis:`,
    `- Total seats: ${totalSeats ?? seats.length}`,
    `- Active in last 30 days: ${active.length}`,
    `- Inactive (no activity in 30 days): ${inactive.length}`,
    `- Utilization rate: ${((active.length / (totalSeats ?? seats.length)) * 100).toFixed(1)}%`,
    `- Plan types: ${[...planTypes.entries()].map(([k, v]) => `${k}: ${v}`).join(', ')}`,
  ];

  if (inactive.length > 0 && inactive.length <= 20) {
    lines.push(`- Inactive users: ${inactive.map(s => s.login).join(', ')}`);
  } else if (inactive.length > 20) {
    lines.push(`- First 20 inactive users: ${inactive.slice(0, 20).map(s => s.login).join(', ')}...`);
  }

  return { success: true, data: lines.join('\n') };
}

function getUserMetrics(data: CachedData, args: Record<string, string>): ToolCallResult {
  const userMetrics = data.userMetrics;
  if (!userMetrics || userMetrics.length === 0) {
    return { success: true, data: 'No per-user metrics data available. The user metrics tab may not be loaded yet.' };
  }

  const userLogin = args.user_login?.toLowerCase();
  const topN = parseInt(args.top_n || '20', 10);

  if (userLogin) {
    const user = userMetrics.find(u => u.login?.toLowerCase() === userLogin);
    if (!user) {
      return { success: true, data: `No metrics found for user "${args.user_login}".` };
    }
    return {
      success: true,
      data: formatUserTotals(user),
    };
  }

  // Return top N users by activity
  const sorted = [...userMetrics]
    .sort((a, b) => (b.user_initiated_interaction_count || 0) - (a.user_initiated_interaction_count || 0))
    .slice(0, topN);

  const lines = [`Per-User Metrics (top ${topN} of ${userMetrics.length} users by activity):`];
  for (const user of sorted) {
    const flags = getUserFeatureFlags(user);
    lines.push(
      `- ${user.login}: ${(user.user_initiated_interaction_count || 0).toLocaleString()} interactions, ` +
      `${(user.code_generation_activity_count || 0).toLocaleString()} code gen, ` +
      `${(user.code_acceptance_activity_count || 0).toLocaleString()} accepted` +
      (flags ? ` [${flags}]` : ''),
    );
  }

  return { success: true, data: lines.join('\n') };
}

function formatUserTotals(user: UserTotals): string {
  const lines = [
    `User: ${user.login}`,
    `- Interactions: ${(user.user_initiated_interaction_count || 0).toLocaleString()}`,
    `- Code generation events: ${(user.code_generation_activity_count || 0).toLocaleString()}`,
    `- Code acceptance events: ${(user.code_acceptance_activity_count || 0).toLocaleString()}`,
    `- Lines suggested to add: ${(user.loc_suggested_to_add_sum || 0).toLocaleString()}`,
    `- Lines added: ${(user.loc_added_sum || 0).toLocaleString()}`,
  ];

  if (user.totals_by_feature && user.totals_by_feature.length > 0) {
    lines.push('- Feature breakdown:');
    for (const f of user.totals_by_feature) {
      if (f.user_initiated_interaction_count > 0 || f.code_generation_activity_count > 0) {
        const label = FEATURE_LABELS[f.feature] || f.feature;
        const parts: string[] = [];
        if (f.user_initiated_interaction_count > 0)
          parts.push(`${f.user_initiated_interaction_count} interactions`);
        if (f.code_generation_activity_count > 0)
          parts.push(`${f.code_generation_activity_count} code gen`);
        if (f.loc_added_sum > 0)
          parts.push(`${f.loc_added_sum} LOC added`);
        lines.push(`  - ${label}: ${parts.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}

function getUserFeatureFlags(user: UserTotals): string {
  const flags: string[] = [];
  if (hasFeature(user, CHAT_FEATURES)) flags.push('Chat');
  if (hasFeature(user, AGENT_FEATURES)) flags.push('Agent');
  return flags.join(', ');
}

function hasFeature(user: UserTotals, features: string[]): boolean {
  if (!user.totals_by_feature) return false;
  return user.totals_by_feature.some(
    f => features.includes(f.feature) &&
      (f.user_initiated_interaction_count > 0 || f.code_generation_activity_count > 0),
  );
}

function getTrendData(data: CachedData, args: Record<string, string>): ToolCallResult {
  const metrics = data.metrics;
  if (!metrics || metrics.length === 0) {
    return { success: true, data: 'No metrics data available.' };
  }

  const metric = args.metric;
  if (!metric) {
    return { success: false, data: 'The "metric" parameter is required.' };
  }

  const lines = [`Trend: ${metric} (${metrics.length} days)`];

  for (const m of metrics) {
    let value: number;
    switch (metric) {
      case 'active_users':
        value = m.total_active_users;
        break;
      case 'acceptance_rate':
        value = m.total_suggestions_count > 0
          ? Math.round((m.total_acceptances_count / m.total_suggestions_count) * 100)
          : 0;
        break;
      case 'suggestions_count':
        value = m.total_suggestions_count;
        break;
      case 'acceptances_count':
        value = m.total_acceptances_count;
        break;
      case 'lines_suggested':
        value = m.total_lines_suggested;
        break;
      case 'lines_accepted':
        value = m.total_lines_accepted;
        break;
      case 'chat_turns':
        value = m.total_chat_turns;
        break;
      case 'chat_active_users':
        value = m.total_active_chat_users;
        break;
      default:
        return { success: false, data: `Unknown metric: ${metric}` };
    }
    lines.push(`  ${m.day}: ${value}`);
  }

  return { success: true, data: lines.join('\n') };
}

function getAgentActivity(data: CachedData): ToolCallResult {
  const reportData = data.reportData;
  if (!reportData || reportData.length === 0) {
    return { success: true, data: 'No report/agent data available.' };
  }

  // Aggregate PR and agent data across the date range
  let totalPRsCreated = 0;
  let totalPRsMerged = 0;
  let totalCopilotPRs = 0;
  let totalCopilotMerged = 0;
  let totalSuggestions = 0;
  let totalApplied = 0;
  let daysWithAgentUsers = 0;
  let totalAgentUsers = 0;

  for (const day of reportData) {
    if (day.pull_requests) {
      const pr = day.pull_requests;
      totalPRsCreated += pr.total_created || 0;
      totalPRsMerged += pr.total_merged || 0;
      totalCopilotPRs += pr.total_created_by_copilot || 0;
      totalCopilotMerged += pr.total_merged_created_by_copilot || 0;
      totalSuggestions += pr.total_copilot_suggestions || 0;
      totalApplied += pr.total_copilot_applied_suggestions || 0;
    }
    if (day.monthly_active_agent_users) {
      daysWithAgentUsers++;
      totalAgentUsers += day.monthly_active_agent_users;
    }
  }

  const avgAgentUsers = daysWithAgentUsers > 0 ? Math.round(totalAgentUsers / daysWithAgentUsers) : 0;

  return {
    success: true,
    data: [
      `Agent & PR Activity (${reportData.length} days):`,
      `- Total PRs created: ${totalPRsCreated}`,
      `- Total PRs merged: ${totalPRsMerged}`,
      `- Copilot-authored PRs: ${totalCopilotPRs}`,
      `- Copilot-authored PRs merged: ${totalCopilotMerged}`,
      `- Copilot PR suggestions: ${totalSuggestions}`,
      `- Copilot PR suggestions applied: ${totalApplied}`,
      `- Avg monthly active agent users: ${avgAgentUsers}`,
    ].join('\n'),
  };
}
