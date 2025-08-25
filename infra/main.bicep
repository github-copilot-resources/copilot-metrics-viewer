targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

param copilotMetricsViewerExists bool

// Settings
@secure()
@description('GitHub App Client Id - required for GitHub OAuth')
param githubClientId string
@secure()
@description('GitHub App Client Secret - required for GitHub OAuth')
param githubClientSecret string
@secure()
param sessionPassword string
@secure()
param githubPAT string
@allowed(['enterprise', 'organization', 'team'])
param githubScope string
@description('The name of the GitHub organization, required when scope is "organization"')
param githubOrg string
@description('The name of the GitHub team, required when scope is "team"')
param githubTeam string
@description('The name of the GitHub enterprise, required when scope is "enterprise"')
param githubEnt string

// Basic Authentication Parameters (optional - for additional access control)
@secure()
@description('Basic authentication username for app access (optional)')
param basicAuthUsername string = ''
@secure()
@description('Basic authentication password for app access (optional)')
param basicAuthPassword string = ''

@description('Id of the user or app to assign application roles')
param principalId string

// Tags that should be applied to all resources.
// 
// Note that 'azd-service-name' tags should be applied separately to service host resources.
// Example usage:
//   tags: union(tags, { 'azd-service-name': <service name in azure.yaml> })
var tags = {
  'azd-env-name': environmentName
}


var abbrs = loadJsonContent('./abbreviations.json')

// Use custom resource naming for shared and app-specific resources
// Shared resources: include 'shared' in the name
var sharedToken = 'govinsights-shared-${environmentName}'
// For container registry (alphanumeric, no dashes) - add unique suffix to avoid conflicts
var sharedTokenAcr = 'crgovinsshrd${environmentName}${take(uniqueString(subscription().id, environmentName), 6)}'
// For Key Vault (max 24 chars, alphanumeric and dashes only)
var sharedTokenKv = 'kv-govins-shr-${environmentName}'
// App-specific resources: include app name, business, and env
var appName = 'copilot'
var appToken = '${appName}-govinsights-${environmentName}'

var settings = concat(
  [
    {
      name: 'NUXT_SESSION_PASSWORD'
      value: '${sessionPassword}-${guid(sessionPassword)}-${guid(sessionPassword)}'
      secret: true
    }
    {
      name: 'NUXT_PUBLIC_SCOPE'
      value: githubScope
    }
  ],
  !empty(githubPAT)
    ? [
        {
          name: 'NUXT_GITHUB_TOKEN'
          value: githubPAT
          secret: true
        }
        {
          name: 'NUXT_PUBLIC_USING_GITHUB_AUTH'
          value: 'false'
        }
      ]
    : [],
  !empty(githubClientId) && !empty(githubClientSecret)
    ? [
        {
          name: 'NUXT_OAUTH_GITHUB_CLIENT_ID'
          value: githubClientId
          secret: true
        }
        {
          name: 'NUXT_OAUTH_GITHUB_CLIENT_SECRET'
          value: githubClientSecret
          secret: true
        }
        {
          name: 'NUXT_PUBLIC_USING_GITHUB_AUTH'
          value: 'true'
        }
      ]
    : [],
  !empty(githubOrg)
    ? [
        {
          name: 'NUXT_PUBLIC_GITHUB_ORG'
          value: githubOrg
        }
      ]
    : [],
  !empty(githubTeam)
    ? [
        {
          name: 'NUXT_PUBLIC_GITHUB_TEAM'
          value: githubTeam
        }
      ]
    : [],
  !empty(githubEnt)
    ? [
        {
          name: 'NUXT_PUBLIC_GITHUB_ENT'
          value: githubEnt
        }
      ]
    : [],
  !empty(basicAuthUsername) && !empty(basicAuthPassword)
    ? [
        {
          name: 'NUXT_BASIC_AUTH_USERNAME'
          value: basicAuthUsername
          secret: true
        }
        {
          name: 'NUXT_BASIC_AUTH_PASSWORD'
          value: basicAuthPassword
          secret: true
        }
        {
          name: 'NUXT_PUBLIC_BASIC_AUTH_ENABLED'
          value: 'true'
        }
      ]
    : []
)



// Use existing resource group as required by IT
resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' existing = {
  name: 'GovInsights-DevCP-DEV-RG'
}


// --- Shared Resources ---

// Log Analytics Workspace (shared)
module monitoring './shared/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    tags: tags
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${sharedToken}'
    applicationInsightsName: '${abbrs.insightsComponents}${sharedToken}'
  }
  scope: rg
}

// Container App Environment (shared)
module appsEnv './shared/apps-env.bicep' = {
  name: 'apps-env'
  params: {
    name: '${abbrs.appManagedEnvironments}${sharedToken}'
    location: location
    tags: tags
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    logAnalyticsWorkspaceName: monitoring.outputs.logAnalyticsWorkspaceName
  }
  scope: rg
}

// Container Registry (shared, alphanumeric)
module registry './shared/registry.bicep' = {
  name: 'registry'
  params: {
    location: location
    tags: tags
    name: '${abbrs.containerRegistryRegistries}${sharedTokenAcr}'
  }
  scope: rg
}

// Key Vault (shared)
module keyVault './shared/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    tags: tags
    name: sharedTokenKv
    principalId: principalId
  }
  scope: rg
}

// --- App-Specific Resources ---

// Container App (app-specific)
module copilotMetricsViewer './app/copilot-metrics-viewer.bicep' = {
  name: 'copilot-metrics-viewer'
  params: {
    name: '${abbrs.appContainerApps}${appToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}${appToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    containerAppsEnvironmentName: appsEnv.outputs.name
    containerRegistryName: registry.outputs.name
    exists: copilotMetricsViewerExists
    appDefinition: {
      settings: settings
    }
  }
  scope: rg
}

// Dashboard (app-specific)
module dashboard './shared/dashboard-web.bicep' = {
  name: 'dashboard'
  params: {
    name: '${abbrs.portalDashboards}${appToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    location: location
    tags: tags
  }
  scope: rg
}


output AZURE_CONTAINER_REGISTRY_ENDPOINT string = registry.outputs.loginServer
output AZURE_KEY_VAULT_NAME string = keyVault.outputs.name
output AZURE_KEY_VAULT_ENDPOINT string = keyVault.outputs.endpoint



