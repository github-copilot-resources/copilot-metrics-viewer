import axios from "axios";
import { Metrics } from "../model/Metrics";
import { CopilotMetrics, ensureCopilotMetrics } from '../model/Copilot_Metrics';
import { convertToMetrics } from './MetricsToUsageConverter';
import config from '../config';

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(config.github.token ? { Authorization: `token ${config.github.token}` } : {})
};

export const getMetricsApi = async (): Promise<{ metrics: Metrics[], original: CopilotMetrics[] }> => {
  const response = await axios.get(
    `${config.github.apiUrl}/copilot/metrics`,
    { headers }
  );
  const originalData = ensureCopilotMetrics(response.data);
  const metricsData = convertToMetrics(originalData);
  return { metrics: metricsData, original: originalData };
};

export const getTeams = async (): Promise<string[]> => {
  // If teams are configured in config, use them directly
  if (config.github.team && config.github.team.trim() !== '') {
    return config.github.team.split(',').map(team => team.trim());
  }

  // Fetch teams from GitHub API
  const response = await axios.get(`${config.github.apiUrl}/teams`, {
    headers
  });

  if (!Array.isArray(response.data)) {
    throw new Error('Invalid response format from GitHub API');
  }
  
  return response.data.map((team: any) => team.name || team.slug);
};

export const getTeamMetricsApi = async (): Promise<{ metrics: Metrics[], original: CopilotMetrics[], teamMetrics: { team: string, metrics: Metrics[] }[] }> => {
  const teams = await getTeams();
  if (!teams.length) {
    return { metrics: [], original: [], teamMetrics: [] };
  }

  return await getMultipleTeamsMetricsApi(teams);
};

export const getMultipleTeamsMetricsApi = async (teams: string[]): Promise<{ metrics: Metrics[], original: CopilotMetrics[], teamMetrics: { team: string, metrics: Metrics[] }[] }> => {
  const allMetrics: Metrics[] = [];
  const allOriginalData: CopilotMetrics[] = [];
  const teamMetrics: { team: string, metrics: Metrics[] }[] = [];

  if (!teams.length) {
    return { metrics: [], original: [], teamMetrics: [] };
  }

  for (const team of teams) {
    try {
      const response = await axios.get(
        `${config.github.apiUrl}/team/${team}/copilot/metrics`,
        { headers }
      );

      const originalData = ensureCopilotMetrics(response.data);
      const metricsData = convertToMetrics(originalData);
      
      if (metricsData && metricsData.length > 0) {
        teamMetrics.push({ team, metrics: metricsData });
        allMetrics.push(...metricsData);
        allOriginalData.push(...originalData);
      } else {
        console.warn(`No metrics data found for team ${team}`);
      }
    } catch (error) {
      console.error(`Error fetching metrics for team ${team}:`, error);
      // Continue with other teams even if one fails
    }
  }

  // Sort teams by name for consistent display
  teamMetrics.sort((a, b) => a.team.localeCompare(b.team));
  
  return { metrics: allMetrics, original: allOriginalData, teamMetrics };
};