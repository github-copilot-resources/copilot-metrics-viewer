//Make a call to the GitHub API to get Copilot Metrics, the API is https://api.github.com/orgs/toussaintt/copilot/usage
//Add the header Accept: application/vnd.github+json to the request
//Add also the Authorization: Bearer <token> header where <token> is hardcoded for now
//Also add X-GitHub-Api-Version: 2022-11-28 header
//Return the response from the API

import axios from "axios";
import { Metrics } from "../model/MetricsData";

export const getGitHubCopilotMetricsApi = async (): Promise<Metrics[]> => {
  const response = await axios.get(
    `https://api.github.com/orgs/${process.env.VUE_APP_GITHUB_ORG}/copilot/usage`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.VUE_APP_GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  // Map the response data to an array of Metrics objects
  const metricsData = response.data.map((item: any) => new Metrics(item));

  return metricsData;
};