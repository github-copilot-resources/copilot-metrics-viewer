//Make a call to the GitHub API to get Copilot Metrics, the API is /api/github/orgs/toussaintt/copilot/usage
//Add the header Accept: application/vnd.github+json to the request
//Add also the Authorization: Bearer <token> header where <token> is hardcoded for now
//Also add X-GitHub-Api-Version: 2022-11-28 header
//Return the response from the API

import axios from "axios";

import { Metrics } from "../model/Metrics";
import organizationMockedResponse from '../assets/organization_response_sample.json';
import enterpriseMockedResponse from '../assets/enterprise_response_sample.json';
import config from '../config';

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(config.github.token ? { Authorization: `token ${config.github.token}` } : {})
};

export const getMetricsApi = async (): Promise<Metrics[]> => {

  let response;
  let metricsData;

  if (config.mockedData) {
    console.log("Using mock data. Check VUE_APP_MOCKED_DATA variable.");
    response = config.scope.type === "organization" ? organizationMockedResponse : enterpriseMockedResponse;
    metricsData = response.map((item: any) => new Metrics(item));
  } else {
    response = await axios.get(
      `${config.github.apiUrl}/copilot/usage`,
      {
       headers
      }
    );


    metricsData = response.data.map((item: any) => new Metrics(item));
  }
  return metricsData;
};

export const getTeams = async (): Promise<string[]> => {
  const response = await axios.get(`${config.github.apiUrl}/teams`, {
    headers
  });

  return response.data;
}

export const getTeamMetricsApi = async (): Promise<Metrics[]> => {
  console.log("config.github.team: " + config.github.team);

  if (config.github.team && config.github.team.trim() !== '') {
    const response = await axios.get(
      `${config.github.apiUrl}/team/${config.github.team}/copilot/usage`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.github.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    return response.data.map((item: any) => new Metrics(item));
  }
  
  return [];

}