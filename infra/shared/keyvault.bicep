param name string
param location string = resourceGroup().location
param tags object = {}
// param githubAppId string
// @secure()
// param githubAppSecret string

@description('Service principal that should be granted read access to the KeyVault. If unset, no service principal is granted access by default')
param principalId string = ''

var defaultAccessPolicies = !empty(principalId) ? [
  {
    objectId: principalId
    permissions: { secrets: [ 'get', 'list' ] }
    tenantId: subscription().tenantId
  }
] : []

resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enabledForTemplateDeployment: true
    accessPolicies: union(defaultAccessPolicies, [
      // define access policies here
    ])
  }
}

// resource ghAppIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
//   parent: keyVault
//   name: 'ghAppId'
//   properties: {
//     value: githubAppId
//   }
// }

// resource ghAppSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
//   parent: keyVault
//   name: 'ghAppSecret'
//   properties: {
//     value: githubAppSecret
//   }
// }

output endpoint string = keyVault.properties.vaultUri
output name string = keyVault.name
