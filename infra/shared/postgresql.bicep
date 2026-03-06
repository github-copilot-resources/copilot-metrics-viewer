param name string
param location string = resourceGroup().location
param tags object = {}

@secure()
@description('Administrator password for PostgreSQL')
param administratorPassword string

@description('Administrator login name')
param administratorLogin string = 'metricsadmin'

@description('Database name')
param databaseName string = 'copilot_metrics'

@description('Allowed IP ranges for firewall (e.g., Container Apps outbound IPs)')
param allowAzureServices bool = true

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow Azure services (Container Apps) to connect
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = if (allowAzureServices) {
  parent: server
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Require SSL connections
resource sslConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: server
  name: 'require_secure_transport'
  properties: {
    value: 'on'
    source: 'user-override'
  }
}

output serverFqdn string = server.properties.fullyQualifiedDomainName
output databaseName string = databaseName
output connectionString string = 'postgresql://${administratorLogin}:PASSWORD@${server.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
output serverName string = server.name
