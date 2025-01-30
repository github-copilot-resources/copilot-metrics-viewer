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
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

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
    : []
)

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module monitoring './shared/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    tags: tags
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
  }
  scope: rg
}

module dashboard './shared/dashboard-web.bicep' = {
  name: 'dashboard'
  params: {
    name: '${abbrs.portalDashboards}${resourceToken}'
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    location: location
    tags: tags
  }
  scope: rg
}

module registry './shared/registry.bicep' = {
  name: 'registry'
  params: {
    location: location
    tags: tags
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
  }
  scope: rg
}

module keyVault './shared/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    tags: tags
    name: '${abbrs.keyVaultVaults}${resourceToken}'
    principalId: principalId
  }
  scope: rg
}

module appsEnv './shared/apps-env.bicep' = {
  name: 'apps-env'
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    tags: tags
    applicationInsightsName: monitoring.outputs.applicationInsightsName
    logAnalyticsWorkspaceName: monitoring.outputs.logAnalyticsWorkspaceName
  }
  scope: rg
}

module copilotMetricsViewer './app/copilot-metrics-viewer.bicep' = {
  name: 'copilot-metrics-viewer'
  params: {
    name: '${abbrs.appContainerApps}copilot-metr-${resourceToken}'
    location: location
    tags: tags
    identityName: '${abbrs.managedIdentityUserAssignedIdentities}copilot-metr-${resourceToken}'
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

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = registry.outputs.loginServer
output AZURE_KEY_VAULT_NAME string = keyVault.outputs.name
output AZURE_KEY_VAULT_ENDPOINT string = keyVault.outputs.endpoint
