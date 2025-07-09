import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  ideCodeCompletionModels: ModelData[];
  ideChatModels: ModelData[];
  dotcomChatModels: ModelData[];
  dotcomPRModels: ModelData[];
  agentModeChartData: ChartData;
  modelUsageChartData: ChartData;
}

export default defineEventHandler(async (event) => {
  const logger = console;
  const config = useRuntimeConfig(event);
  const query = getQuery(event);
  
  let apiUrl = '';
  let mockedDataPath: string;

  // Extract date parameters from query
  const since = query.since as string | undefined;
  const until = query.until as string | undefined;

  switch (event.context.scope) {
    case 'team':
      apiUrl = `https://api.github.com/orgs/${event.context.org}/team/${event.context.team}/copilot/metrics`;
      mockedDataPath = resolve('public/mock-data/organization_metrics_response_sample.json');
      break;
    case 'org':
      apiUrl = `https://api.github.com/orgs/${event.context.org}/copilot/metrics`;
      mockedDataPath = resolve('public/mock-data/organization_metrics_response_sample.json');
      break;
    case 'ent':
      apiUrl = `https://api.github.com/enterprises/${event.context.ent}/copilot/metrics`;
      mockedDataPath = resolve('public/mock-data/enterprise_metrics_response_sample.json');
      break;
    default:
      return new Response('Invalid configuration/parameters for the request', { status: 400 });
  }

  let metricsData: CopilotMetrics[] = [];

  if (config.public.isDataMocked && mockedDataPath) {
    const path = mockedDataPath;
    const data = readFileSync(path, 'utf8');
    const dataJson = JSON.parse(data);
    metricsData = updateMockDataDates(dataJson, since, until);
  } else {
    if (!event.context.headers.has('Authorization')) {
      logger.error('No Authentication provided');
      return new Response('No Authentication provided', { status: 401 });
    }

    // Add query parameters for date filtering if provided
    if (since || until) {
      const urlParams = new URLSearchParams();
      if (since) urlParams.append('since', since);
      if (until) urlParams.append('until', until);
      apiUrl += `?${urlParams.toString()}`;
    }

    try {
      const response = await $fetch(apiUrl, {
        headers: event.context.headers
      }) as CopilotMetrics[];
      
      metricsData = response;
    } catch (error: any) {
      logger.error('Error fetching metrics data:', error);
      return new Response('Error fetching metrics data: ' + error, { status: error.statusCode || 500 });
    }
  }

  // Calculate GitHub.com statistics
  const stats = calculateGitHubStats(metricsData);
  
  return stats;
});

function calculateGitHubStats(metrics: CopilotMetrics[]): GitHubStats {
  // Calculate totals with optimized loops
  const totals = metrics.reduce((acc, metric) => {
    acc.totalIdeCodeCompletionUsers += metric.copilot_ide_code_completions?.total_engaged_users || 0;
    acc.totalIdeChatUsers += metric.copilot_ide_chat?.total_engaged_users || 0;
    acc.totalDotcomChatUsers += metric.copilot_dotcom_chat?.total_engaged_users || 0;
    acc.totalDotcomPRUsers += metric.copilot_dotcom_pull_requests?.total_engaged_users || 0;
    
    // Calculate PR summaries
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

  // Calculate unique models with optimized approach
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

  // Single loop to process all metrics and models
  for (const metric of metrics) {
    // IDE Code Completions
    metric.copilot_ide_code_completions?.editors?.forEach(editor => {
      editor.models?.forEach(model => {
        modelSets.ideCodeCompletion.add(model.name);
        
        const key = `${model.name}-${editor.name}`;
        if (!modelMaps.ideCodeCompletion.has(key)) {
          modelMaps.ideCodeCompletion.set(key, {
            name: model.name,
            editor: editor.name,
            model_type: model.is_custom_model ? 'Custom' : 'Default',
            total_engaged_users: 0
          });
        }
        modelMaps.ideCodeCompletion.get(key).total_engaged_users += model.total_engaged_users;
      });
    });

    // IDE Chat
    metric.copilot_ide_chat?.editors?.forEach(editor => {
      editor.models?.forEach(model => {
        modelSets.ideChat.add(model.name);
        
        const key = `${model.name}-${editor.name}`;
        if (!modelMaps.ideChat.has(key)) {
          modelMaps.ideChat.set(key, {
            name: model.name,
            editor: editor.name,
            model_type: model.is_custom_model ? 'Custom' : 'Default',
            total_engaged_users: 0,
            total_chats: 0,
            total_chat_insertion_events: 0,
            total_chat_copy_events: 0
          });
        }
        const entry = modelMaps.ideChat.get(key);
        entry.total_engaged_users += model.total_engaged_users;
        entry.total_chats += model.total_chats;
        entry.total_chat_insertion_events += model.total_chat_insertion_events;
        entry.total_chat_copy_events += model.total_chat_copy_events;
      });
    });

    // Dotcom Chat
    metric.copilot_dotcom_chat?.models?.forEach(model => {
      modelSets.dotcomChat.add(model.name);
      
      if (!modelMaps.dotcomChat.has(model.name)) {
        modelMaps.dotcomChat.set(model.name, {
          name: model.name,
          model_type: model.is_custom_model ? 'Custom' : 'Default',
          total_engaged_users: 0,
          total_chats: 0
        });
      }
      const entry = modelMaps.dotcomChat.get(model.name);
      entry.total_engaged_users += model.total_engaged_users;
      entry.total_chats += model.total_chats;
    });

    // Dotcom PR
    metric.copilot_dotcom_pull_requests?.repositories?.forEach(repo => {
      repo.models?.forEach(model => {
        modelSets.dotcomPR.add(model.name);
        
        const key = `${model.name}-${repo.name}`;
        if (!modelMaps.dotcomPR.has(key)) {
          modelMaps.dotcomPR.set(key, {
            name: model.name,
            repository: repo.name,
            model_type: model.is_custom_model ? 'Custom' : 'Default',
            total_engaged_users: 0,
            total_pr_summaries_created: 0
          });
        }
        const entry = modelMaps.dotcomPR.get(key);
        entry.total_engaged_users += model.total_engaged_users;
        entry.total_pr_summaries_created += model.total_pr_summaries_created;
      });
    });
  }

  // Chart data
  const labels = metrics.map(metric => metric.date);
  const agentModeChartData = {
    labels,
    datasets: [
      {
        label: 'IDE Code Completions',
        data: metrics.map(metric => metric.copilot_ide_code_completions?.total_engaged_users || 0),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      },
      {
        label: 'IDE Chat',
        data: metrics.map(metric => metric.copilot_ide_chat?.total_engaged_users || 0),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1
      },
      {
        label: 'GitHub.com Chat',
        data: metrics.map(metric => metric.copilot_dotcom_chat?.total_engaged_users || 0),
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        tension: 0.1
      },
      {
        label: 'GitHub.com PR',
        data: metrics.map(metric => metric.copilot_dotcom_pull_requests?.total_engaged_users || 0),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.2)',
        tension: 0.1
      }
    ]
  };

  const modelUsageChartData = {
    labels: ['IDE Code Completions', 'IDE Chat', 'GitHub.com Chat', 'GitHub.com PR'],
    datasets: [
      {
        label: 'Total Models',
        data: [
          modelSets.ideCodeCompletion.size,
          modelSets.ideChat.size,
          modelSets.dotcomChat.size,
          modelSets.dotcomPR.size
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)'
        ],
        borderColor: [
          'rgb(75, 192, 192)',
          'rgb(255, 99, 132)',
          'rgb(153, 102, 255)',
          'rgb(255, 159, 64)'
        ],
        borderWidth: 1
      }
    ]
  };

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
    modelUsageChartData
  };
}

function updateMockDataDates(originalData: CopilotMetrics[], since?: string, until?: string): CopilotMetrics[] {
  const today = new Date();
  let startDate: Date;
  let endDate: Date;

  // If no dates provided, use last 28 days
  if (!since && !until) {
    startDate = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000);
    endDate = today;
  } else {
    startDate = since ? new Date(since) : new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000);
    endDate = until ? new Date(until) : today;
  }

  // Generate array of dates in the range
  const dateRange: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dateRange.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Update dates in the dataset, copying existing entries when needed
  const result = dateRange.map((date, index) => {
    // Use existing data entries, cycling through them
    const dataIndex = index % originalData.length;
    const entry = { ...originalData[dataIndex] };
    
    // Update the date
    entry.date = date.toISOString().split('T')[0];
    
    return entry;
  });

  return result;
}