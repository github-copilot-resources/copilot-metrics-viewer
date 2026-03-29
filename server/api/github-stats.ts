import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { ReportDayTotals } from '../services/github-copilot-usage-api';
import { getMetricsDataV2 } from '../../shared/utils/metrics-util-v2';

interface ModelFeatureRow {
  model: string;
  feature: string;
  interactions: number;
  codeGenerations: number;
  codeAcceptances: number;
  locAdded: number;
  locDeleted: number;
}

interface GitHubStats {
  totalIdeCodeCompletionUsers: number;
  totalIdeChatUsers: number;
  totalDotcomChatUsers: number;
  totalDotcomPRUsers: number;
  totalPRSummariesCreated: number;
  totalIdeCodeCompletionModels: number;
  totalIdeChatModels: number;
  totalDotcomChatModels: number;
  totalDotcomPRModels: number;
  ideCodeCompletionModels: any[];
  ideChatModels: any[];
  dotcomChatModels: any[];
  dotcomPRModels: any[];
  agentModeChartData: any;
  modelUsageChartData: any;
  // New API report data stats
  hasReportData: boolean;
  allModels: string[];
  allFeatures: string[];
  modelFeatureTable: ModelFeatureRow[];
  featureSummary: { feature: string; interactions: number; codeGenerations: number; locAdded: number }[];
  modelSummary: { model: string; interactions: number; codeGenerations: number; locAdded: number }[];
  dailyActiveUsers: { day: string; daily: number; weekly: number; monthly: number }[];
  agentUsers: { day: string; monthlyAgentUsers: number; monthlyChatUsers: number }[];
}

export default defineEventHandler(async (event) => {
  try {
    const { metrics: metricsData, reportData } = await getMetricsDataV2(event);
    const stats = calculateGitHubStats(metricsData, reportData || []);
    return stats;
  } catch (error) {
    const logger = console;
    logger.error('Error in github-stats endpoint:', error);
    throw createError({ statusCode: 500, statusMessage: 'Error fetching metrics data: ' + (error instanceof Error ? error.message : String(error)) });
  }
});

function calculateGitHubStats(metrics: CopilotMetrics[], reportData: ReportDayTotals[]): GitHubStats {
  // CopilotMetrics-based totals
  const totals = metrics.reduce((acc, metric) => {
    acc.totalIdeCodeCompletionUsers += metric.copilot_ide_code_completions?.total_engaged_users || 0;
    acc.totalIdeChatUsers += metric.copilot_ide_chat?.total_engaged_users || 0;
    acc.totalDotcomChatUsers += metric.copilot_dotcom_chat?.total_engaged_users || 0;
    acc.totalDotcomPRUsers += metric.copilot_dotcom_pull_requests?.total_engaged_users || 0;
    if (metric.copilot_dotcom_pull_requests?.repositories) {
      acc.totalPRSummariesCreated += metric.copilot_dotcom_pull_requests.repositories.reduce((repoSum, repo) => {
        return repoSum + (repo.models?.reduce((modelSum, model) => {
          return modelSum + (model.total_pr_summaries_created || 0);
        }, 0) || 0);
      }, 0);
    }
    return acc;
  }, {
    totalIdeCodeCompletionUsers: 0,
    totalIdeChatUsers: 0,
    totalDotcomChatUsers: 0,
    totalDotcomPRUsers: 0,
    totalPRSummariesCreated: 0
  });

  // Legacy model extraction from CopilotMetrics
  const modelSets = {
    ideCodeCompletion: new Set<string>(),
    ideChat: new Set<string>(),
    dotcomChat: new Set<string>(),
    dotcomPR: new Set<string>()
  };
  const modelMaps = {
    ideCodeCompletion: new Map(),
    ideChat: new Map(),
    dotcomChat: new Map(),
    dotcomPR: new Map()
  };

  for (const metric of metrics) {
    metric.copilot_ide_code_completions?.editors?.forEach(editor => {
      editor.models?.forEach(model => {
        modelSets.ideCodeCompletion.add(model.name);
        const key = `${model.name}-${editor.name}`;
        if (!modelMaps.ideCodeCompletion.has(key)) {
          modelMaps.ideCodeCompletion.set(key, {
            name: model.name, editor: editor.name,
            model_type: model.is_custom_model ? 'Custom' : 'Default',
            total_engaged_users: 0
          });
        }
        modelMaps.ideCodeCompletion.get(key).total_engaged_users += model.total_engaged_users;
      });
    });

    metric.copilot_ide_chat?.editors?.forEach(editor => {
      editor.models?.forEach(model => {
        modelSets.ideChat.add(model.name);
        const key = `${model.name}-${editor.name}`;
        if (!modelMaps.ideChat.has(key)) {
          modelMaps.ideChat.set(key, {
            name: model.name, editor: editor.name,
            model_type: model.is_custom_model ? 'Custom' : 'Default',
            total_engaged_users: 0, total_chats: 0,
            total_chat_insertion_events: 0, total_chat_copy_events: 0
          });
        }
        const entry = modelMaps.ideChat.get(key);
        entry.total_engaged_users += model.total_engaged_users;
        entry.total_chats += model.total_chats;
        entry.total_chat_insertion_events += model.total_chat_insertion_events;
        entry.total_chat_copy_events += model.total_chat_copy_events;
      });
    });

    metric.copilot_dotcom_chat?.models?.forEach(model => {
      modelSets.dotcomChat.add(model.name);
      if (!modelMaps.dotcomChat.has(model.name)) {
        modelMaps.dotcomChat.set(model.name, {
          name: model.name, model_type: model.is_custom_model ? 'Custom' : 'Default',
          total_engaged_users: 0, total_chats: 0
        });
      }
      const entry = modelMaps.dotcomChat.get(model.name);
      entry.total_engaged_users += model.total_engaged_users;
      entry.total_chats += model.total_chats;
    });

    metric.copilot_dotcom_pull_requests?.repositories?.forEach(repo => {
      repo.models?.forEach(model => {
        modelSets.dotcomPR.add(model.name);
        const key = `${model.name}-${repo.name}`;
        if (!modelMaps.dotcomPR.has(key)) {
          modelMaps.dotcomPR.set(key, {
            name: model.name, repository: repo.name,
            model_type: model.is_custom_model ? 'Custom' : 'Default',
            total_engaged_users: 0, total_pr_summaries_created: 0
          });
        }
        const entry = modelMaps.dotcomPR.get(key);
        entry.total_engaged_users += model.total_engaged_users;
        entry.total_pr_summaries_created += model.total_pr_summaries_created;
      });
    });
  }

  // Charts
  const labels = metrics.map(m => m.date);
  const agentModeChartData = {
    labels,
    datasets: [
      {
        label: 'Code Completions', data: metrics.map(m => m.copilot_ide_code_completions?.total_engaged_users || 0),
        borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)', tension: 0.1
      },
      {
        label: 'Chat', data: metrics.map(m => m.copilot_ide_chat?.total_engaged_users || 0),
        borderColor: 'rgb(255, 99, 132)', backgroundColor: 'rgba(255, 99, 132, 0.2)', tension: 0.1
      }
    ]
  };

  const modelUsageChartData = {
    labels: ['Code Completions', 'Chat'],
    datasets: [{
      label: 'Total Models',
      data: [modelSets.ideCodeCompletion.size, modelSets.ideChat.size],
      backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
      borderColor: ['rgb(75, 192, 192)', 'rgb(255, 99, 132)'],
      borderWidth: 1
    }]
  };

  // === New API report data stats ===
  const hasReportData = reportData.length > 0;

  // Aggregate model-feature data across all days
  const mfMap = new Map<string, ModelFeatureRow>();
  const featureMap = new Map<string, { feature: string; interactions: number; codeGenerations: number; locAdded: number }>();
  const modelMap = new Map<string, { model: string; interactions: number; codeGenerations: number; locAdded: number }>();

  for (const day of reportData) {
    for (const mf of (day.totals_by_model_feature || [])) {
      const key = `${mf.model}|${mf.feature}`;
      const existing = mfMap.get(key);
      if (existing) {
        existing.interactions += mf.user_initiated_interaction_count;
        existing.codeGenerations += mf.code_generation_activity_count;
        existing.codeAcceptances += mf.code_acceptance_activity_count;
        existing.locAdded += mf.loc_added_sum;
        existing.locDeleted += mf.loc_deleted_sum;
      } else {
        mfMap.set(key, {
          model: mf.model, feature: mf.feature,
          interactions: mf.user_initiated_interaction_count,
          codeGenerations: mf.code_generation_activity_count,
          codeAcceptances: mf.code_acceptance_activity_count,
          locAdded: mf.loc_added_sum, locDeleted: mf.loc_deleted_sum,
        });
      }

      // Feature summary
      const fEntry = featureMap.get(mf.feature) || { feature: mf.feature, interactions: 0, codeGenerations: 0, locAdded: 0 };
      fEntry.interactions += mf.user_initiated_interaction_count;
      fEntry.codeGenerations += mf.code_generation_activity_count;
      fEntry.locAdded += mf.loc_added_sum;
      featureMap.set(mf.feature, fEntry);

      // Model summary
      const mEntry = modelMap.get(mf.model) || { model: mf.model, interactions: 0, codeGenerations: 0, locAdded: 0 };
      mEntry.interactions += mf.user_initiated_interaction_count;
      mEntry.codeGenerations += mf.code_generation_activity_count;
      mEntry.locAdded += mf.loc_added_sum;
      modelMap.set(mf.model, mEntry);
    }

    // Include features from totals_by_feature that aren't in model_feature (e.g. code_completion)
    for (const f of (day.totals_by_feature || [])) {
      if (!featureMap.has(f.feature)) {
        featureMap.set(f.feature, { feature: f.feature, interactions: 0, codeGenerations: 0, locAdded: 0 });
      }
      const entry = featureMap.get(f.feature)!;
      // Only add if not already counted from model_feature
      if (!(day.totals_by_model_feature || []).some(mf => mf.feature === f.feature)) {
        entry.interactions += f.user_initiated_interaction_count;
        entry.codeGenerations += f.code_generation_activity_count;
        entry.locAdded += f.loc_added_sum;
      }
    }
  }

  const allModels = [...new Set(reportData.flatMap(d => (d.totals_by_model_feature || []).map(m => m.model)))];
  const allFeatures = [...new Set(reportData.flatMap(d => (d.totals_by_feature || []).map(f => f.feature)))];

  const dailyActiveUsers = reportData.map(d => ({
    day: d.day,
    daily: d.daily_active_users || 0,
    weekly: d.weekly_active_users || 0,
    monthly: d.monthly_active_users || 0,
  }));

  const agentUsers = reportData.map(d => ({
    day: d.day,
    monthlyAgentUsers: d.monthly_active_agent_users || 0,
    monthlyChatUsers: d.monthly_active_chat_users || 0,
  }));

  return {
    ...totals,
    totalIdeCodeCompletionModels: modelSets.ideCodeCompletion.size,
    totalIdeChatModels: modelSets.ideChat.size,
    totalDotcomChatModels: modelSets.dotcomChat.size,
    totalDotcomPRModels: modelSets.dotcomPR.size,
    ideCodeCompletionModels: Array.from(modelMaps.ideCodeCompletion.values()),
    ideChatModels: Array.from(modelMaps.ideChat.values()),
    dotcomChatModels: Array.from(modelMaps.dotcomChat.values()),
    dotcomPRModels: Array.from(modelMaps.dotcomPR.values()),
    agentModeChartData,
    modelUsageChartData,
    hasReportData,
    allModels,
    allFeatures,
    modelFeatureTable: [...mfMap.values()].sort((a, b) => b.locAdded - a.locAdded),
    featureSummary: [...featureMap.values()].sort((a, b) => b.codeGenerations - a.codeGenerations),
    modelSummary: [...modelMap.values()].sort((a, b) => b.locAdded - a.locAdded),
    dailyActiveUsers,
    agentUsers,
  };
}
