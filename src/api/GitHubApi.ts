import axios from "axios";
import { Metrics } from "../model/Metrics";
import { CopilotMetrics } from '../model/Copilot_Metrics';
import { convertToMetrics } from './MetricsToUsageConverter';
import organizationMockedMetricsResponse from '../../mock-data/organization_metrics_response_sample.json';
import enterpriseMockedMetricsResponse from '../../mock-data/enterprise_metrics_response_sample.json';
import config from '../config';

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(config.github.token ? { Authorization: `token ${config.github.token}` } : {})
};

const ensureCopilotMetrics = (data: any[]): CopilotMetrics[] => {
  return data.map(item => {
    if (!item.copilot_ide_code_completions) {
      item.copilot_ide_code_completions = { editors: [] };
    }
    item.copilot_ide_code_completions.editors?.forEach((editor: any) => {
      editor.models?.forEach((model: any) => {
        if (!model.languages) {
          model.languages = [];
        }
      });
    });
    return item as CopilotMetrics;
  });
};

export const getMetricsApi = async (): Promise<{ metrics: Metrics[], original: CopilotMetrics[] }> => {
  let response;
  let metricsData: Metrics[];
  let originalData: CopilotMetrics[];

  if (config.mockedData) {
    console.log("Using mock data. Check VUE_APP_MOCKED_DATA variable.");
    response = config.scope.type === "organization" ? organizationMockedMetricsResponse : enterpriseMockedMetricsResponse;
    originalData = ensureCopilotMetrics(response);
    metricsData = convertToMetrics(originalData);
  } else {
    response = await axios.get(
      `${config.github.apiUrl}/copilot/metrics`,
      {
        headers
      }
    );
    originalData = ensureCopilotMetrics(response.data);
    metricsData = convertToMetrics(originalData);
  }
  return { metrics: metricsData, original: originalData };
};

export const getTeams = async (): Promise<string[]> => {
  const response = await axios.get(`${config.github.apiUrl}/teams`, {
    headers
  });

  return response.data;
}

export const getTeamMetricsApi = async (): Promise<{ metrics: Metrics[], original: CopilotMetrics[] }> => {
  console.log("config.github.team: " + config.github.team);

  if (config.github.team && config.github.team.trim() !== '') {
    const response = await axios.get(
      `${config.github.apiUrl}/team/${config.github.team}/copilot/metrics`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.github.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    const originalData = ensureCopilotMetrics(response.data);
    const metricsData = convertToMetrics(originalData);
    return { metrics: metricsData, original: originalData };
  }
  
  return { metrics: [], original: [] };
}