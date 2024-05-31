//Make a call to the GitHub API to get Copilot Metrics, the API is https://api.github.com/orgs/toussaintt/copilot/usage
//Add the header Accept: application/vnd.github+json to the request
//Add also the Authorization: Bearer <token> header where <token> is hardcoded for now
//Also add X-GitHub-Api-Version: 2022-11-28 header
//Return the response from the API

import axios from "axios";

import { Metrics } from "../model/Metrics";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import fs from "fs";
import organizationMockedResponse from '../assets/organization_response_sample.json';
import enterpriseMockedResponse from '../assets/enterprise_response_sample.json';

let auth;

if (process.env.VUE_APP_AUTH_METHOD === "token") {
  auth = process.env.VUE_APP_GITHUB_TOKEN;
} else if (process.env.VUE_APP_AUTH_METHOD === "app") {
  console.log("Creating App Auth");
  console.log(`App ID: ${process.env.VUE_APP_GITHUB_APPLICATION_ID}`);
  console.log(`Private Key: ${process.env.VUE_APP_GITHUB_KEY_PATH}`);
  console.log(`Installation ID: ${process.env.VUE_APP_GITHUB_INSTALLATION_ID}`);

  const privateKey = fs.readFileSync(process.env.VUE_APP_GITHUB_KEY_PATH, 'utf8');
  console.log(`Private Key: ${privateKey}`);
  auth = createAppAuth({
    appId: process.env.VUE_APP_GITHUB_APPLICATION_ID,
    privateKey: process.env.VUE_APP_GITHUB_KEY_PATH,
    installationId: process.env.VUE_APP_GITHUB_INSTALLATION_ID,
  });
  console.log("Auth: ", auth);
} else {
  throw new Error(`Invalid VUE_APP_AUTH_METHOD value: ${process.env.VUE_APP_AUTH_METHOD}. Expected "token" or "app".`);
}

const octokit = new Octokit({
  auth,
  userAgent: "copilot-metrics",
});

export const getMetricsApi = async (): Promise<Metrics[]> => {
  
  let response;
  let metricsData;

  if (process.env.VUE_APP_MOCKED_DATA === "true") {
    console.log("Using mock data. Check VUE_APP_MOCKED_DATA variable.");
    if (process.env.VUE_APP_SCOPE === "organization") {
      response = organizationMockedResponse;
    } else if (process.env.VUE_APP_SCOPE === "enterprise") {
      response = enterpriseMockedResponse;
    } else {
      throw new Error(`Invalid VUE_APP_SCOPE value: ${process.env.VUE_APP_SCOPE}. Expected "organization" or "enterprise".`);
    }

    metricsData = response.map((item: any) => new Metrics(item));
  } else {
    // if VUE_APP_GITHUB_TOKEN is not set, throw an error
    if (!process.env.VUE_APP_GITHUB_TOKEN) {
      throw new Error("VUE_APP_GITHUB_TOKEN environment variable is not set.");
    }
    
    if(process.env.VUE_APP_AUTH_METHOD === "token"){
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
    } else if(process.env.VUE_APP_AUTH_METHOD === "app"){
      console.log("Getting metrics using GitHub App");
      console.log(`Scope: ${process.env.VUE_APP_AUTH_METHOD}`);
      
      if (process.env.VUE_APP_SCOPE === "organization") {
        console.log(`Scope: ${process.env.VUE_APP_SCOPE}`);
        response = await octokit.request('GET /orgs/{org}/copilot/usage', {
          org: process.env.VUE_APP_GITHUB_ORG,
        });

        console.log(response);
        
      } else {
        throw new Error(`Invalid VUE_APP_SCOPE value: ${process.env.VUE_APP_SCOPE}. Expected "organization". GitHub Apps can only be scoped at the organization level.`);
      } 
    } else{
      throw new Error(`Invalid VUE_APP_AUTH_METHOD value: ${process.env.VUE_APP_AUTH_METHOD}. Expected "token" or "app".`);
    }

    console.log("Out of the if statement");
    metricsData = response.data.map((item: any) => new Metrics(item));
    console.log(metricsData);
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

