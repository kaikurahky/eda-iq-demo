@description('Azure region for Foundry and AI Search resources.')
param location string

@description('Deterministic resource token from the parent deployment.')
param resourceToken string

@description('Tags applied to all resources.')
param tags object

@description('User-assigned managed identity used by the Container App.')
param appIdentityPrincipalId string

var azureAiUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '53ca6127-db72-4b80-b1b0-d745d6d5456d')

resource foundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: 'azai${resourceToken}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  kind: 'AIServices'
  sku: { name: 'S0' }
  properties: {
    allowProjectManagement: true
    customSubDomainName: 'azai${resourceToken}'
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: foundry
  name: 'azprj${resourceToken}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    description: 'Synthetic OPC recipe optimization and Azure HPC demonstration'
    displayName: 'OPC IQ Demo'
  }
}

resource search 'Microsoft.Search/searchServices@2025-05-01' = {
  name: 'azsrch${resourceToken}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  sku: { name: 'basic' }
  properties: {
    disableLocalAuth: true
    partitionCount: 1
    publicNetworkAccess: 'enabled'
    replicaCount: 1
    semanticSearch: 'free'
  }
}

resource appFoundryRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundry.id, appIdentityPrincipalId, azureAiUserRoleId)
  scope: foundry
  properties: {
    principalId: appIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: azureAiUserRoleId
  }
}

output foundryAccountName string = foundry.name
output foundryProjectName string = project.name
output foundryProjectEndpoint string = project.properties.endpoints['AI Foundry API']
output searchServiceName string = search.name
