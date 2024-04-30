//Make a call to the GitHub API to get Copilot Metrics, the API is https://api.github.com/orgs/toussaintt/copilot/usage
//Add the header Accept: application/vnd.github+json to the request
//Add also the Authorization: Bearer <token> header where <token> is hardcoded for now
//Also add X-GitHub-Api-Version: 2022-11-28 header
//Return the response from the API

import axios from "axios";

import { Metrics } from "../model/Metrics";
import organizationMockedResponse from '../assets/organization_response_sample.json';
import enterpriseMockedResponse from '../assets/enterprise_response_sample.json';


export const getMetricsApi = async (): Promise<Metrics[]> => {
  
  let response;
  let metricsData;

  if (process.env.VUE_APP_MOCKED_DATA === "true") {
    
    if (process.env.VUE_APP_SCOPE === "organization") {
      response = organizationMockedResponse;
    } else if (process.env.VUE_APP_SCOPE === "enterprise") {
      response = enterpriseMockedResponse;
    } else {
      throw new Error(`Invalid VUE_APP_SCOPE value: ${process.env.VUE_APP_SCOPE}. Expected "organization" or "enterprise".`);
    }

    metricsData = response.map((item: any) => new Metrics(item));
  } else {
    if (process.env.VUE_APP_SCOPE === "organization") {
      response = await axios.get(
        `https://api.github.com/orgs/${process.env.VUE_APP_GITHUB_ORG}/copilot/usage`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${process.env.VUE_APP_GITHUB_TOKEN}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
    } else if (process.env.VUE_APP_SCOPE === "enterprise") {

      response = await axios.get(
        `https://api.github.com/enterprises/${process.env.VUE_APP_GITHUB_ENT}/copilot/usage`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${process.env.VUE_APP_GITHUB_TOKEN}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
    } else {
      throw new Error(`Invalid VUE_APP_SCOPE value: ${process.env.VUE_APP_SCOPE}. Expected "organization" or "enterprise".`);
    }

    metricsData = response.data.map((item: any) => new Metrics(item));
  }
  return metricsData;
};

export const getTeams = async (): Promise<string[]> =>{
  const response = await axios.get(`https://api.github.com/orgs/${process.env.VUE_APP_GITHUB_ORG}/teams`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.VUE_APP_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  return response.data;
}

