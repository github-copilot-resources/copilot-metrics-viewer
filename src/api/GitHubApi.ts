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
  try {
    const response = await axios.get(
      `${config.github.apiUrl}/copilot/metrics`,
      { headers }
    );
    const originalData = ensureCopilotMetrics(response.data);
    const metricsData = convertToMetrics(originalData);
    return { metrics: metricsData, original: originalData };
  } catch (error) {
    console.error('Error fetching metrics:', error);
    throw error;
  }
};

export const getTeams = async (): Promise<string[]> => {
  try {
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
    
    console.log("Teams fetched:", response.data.map((team: any) => team.name || team.slug));
    return response.data.map((team: any) => team.name || team.slug);
  } catch (error: any) {
    console.error('Error fetching teams:', error.message);
    throw error;
  }
};

export const getTeamMetricsApi = async (): Promise<{ metrics: Metrics[], original: CopilotMetrics[], teamMetrics: { team: string, metrics: Metrics[] }[] }> => {
  try {
    const teams = await getTeams();
    if (!teams.length) {
      console.warn('No teams available');
      return { metrics: [], original: [], teamMetrics: [] };
    }

    return await getMultipleTeamsMetricsApi(teams);
  } catch (error) {
    console.error('Error fetching team metrics:', error);
    throw error;
  }
};

export const getMultipleTeamsMetricsApi = async (teams: string[]): Promise<{ metrics: Metrics[], original: CopilotMetrics[], teamMetrics: { team: string, metrics: Metrics[] }[] }> => {
  const allMetrics: Metrics[] = [];
  const allOriginalData: CopilotMetrics[] = [];
  const teamMetrics: { team: string, metrics: Metrics[] }[] = [];

  if (!teams.length) {
    return { metrics: [], original: [], teamMetrics: [] };
  }

  try {
    for (const team of teams) {
      try {
        console.log(`Fetching metrics for team: ${team}`);
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
          console.log(`Successfully processed metrics for team ${team}`);
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
    
    console.log('Teams metrics summary:', {
      totalTeams: teamMetrics.length,
      totalDays: allMetrics.length,
      teamsProcessed: teamMetrics.map(tm => ({
        team: tm.team,
        daysOfData: tm.metrics.length
      }))
    });

    return { metrics: allMetrics, original: allOriginalData, teamMetrics };
  } catch (error) {
    console.error('Error in getMultipleTeamsMetricsApi:', error);
    throw error;
  }
};