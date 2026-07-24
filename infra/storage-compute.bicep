@description('Azure region for storage and compute resources.')
param location string

@description('Deterministic resource token from the parent deployment.')
param resourceToken string

@description('Tags applied to all resources.')
param tags object

@description('User-assigned managed identity used by the Container App.')
param appIdentityPrincipalId string

@description('Small demo VM SKU. Validate availability before deployment.')
param vmSize string = 'Standard_B2s'

@description('Linux VM administrator user name.')
param adminUsername string = 'azureopc'

@description('SSH public key for break-glass VM administration through Azure control plane.')
param adminSshPublicKey string

@description('Include cloud-init when creating a new worker VM. Disable when updating an existing VM.')
param configureWorkerBootstrap bool = true

var queueDataContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')
var blobDataContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')

resource storage 'Microsoft.Storage/storageAccounts@2025-01-01' = {
  name: 'azst${resourceToken}'
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Disabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2025-01-01' = {
  parent: storage
  name: 'default'
  properties: { deleteRetentionPolicy: { enabled: true, days: 7 } }
}

resource inputContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: blobService
  name: 'opc-inputs'
  properties: { publicAccess: 'None' }
}

resource resultContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: blobService
  name: 'opc-results'
  properties: { publicAccess: 'None' }
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2025-01-01' = {
  parent: storage
  name: 'default'
}

resource jobQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2025-01-01' = {
  parent: queueService
  name: 'opc-jobs'
}

resource appQueueRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, appIdentityPrincipalId, queueDataContributorRoleId)
  scope: storage
  properties: {
    principalId: appIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: queueDataContributorRoleId
  }
}

resource appBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, appIdentityPrincipalId, blobDataContributorRoleId)
  scope: storage
  properties: {
    principalId: appIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobDataContributorRoleId
  }
}

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-07-01' = {
  name: 'aznsg${resourceToken}'
  location: location
  tags: tags
  properties: { securityRules: [] }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-07-01' = {
  name: 'azvnt${resourceToken}'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.42.0.0/16'] }
    subnets: [
      {
        name: 'worker'
        properties: {
          addressPrefix: '10.42.1.0/24'
          networkSecurityGroup: { id: nsg.id }
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: 'container-apps'
        properties: {
          addressPrefix: '10.42.4.0/23'
          delegations: [{
            name: 'Microsoft.App.environments'
            properties: { serviceName: 'Microsoft.App/environments' }
          }]
        }
      }
    ]
  }
}

resource blobPrivateDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.blob.${environment().suffixes.storage}'
  location: 'global'
  tags: tags
}

resource queuePrivateDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.queue.${environment().suffixes.storage}'
  location: 'global'
  tags: tags
}

resource blobPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: blobPrivateDns
  name: 'azpdnsvlblob${resourceToken}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

resource queuePrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: queuePrivateDns
  name: 'azpdnsvlqueue${resourceToken}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-07-01' = {
  name: 'azpeb${resourceToken}'
  location: location
  tags: tags
  properties: {
    privateLinkServiceConnections: [{
      name: 'blob'
      properties: {
        groupIds: ['blob']
        privateLinkServiceId: storage.id
      }
    }]
    subnet: { id: vnet.properties.subnets[0].id }
  }
}

resource blobPrivateDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-07-01' = {
  parent: blobPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [{ name: 'blob', properties: { privateDnsZoneId: blobPrivateDns.id } }]
  }
}

resource queuePrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-07-01' = {
  name: 'azpeq${resourceToken}'
  location: location
  tags: tags
  properties: {
    privateLinkServiceConnections: [{
      name: 'queue'
      properties: {
        groupIds: ['queue']
        privateLinkServiceId: storage.id
      }
    }]
    subnet: { id: vnet.properties.subnets[0].id }
  }
}

resource queuePrivateDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-07-01' = {
  parent: queuePrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [{ name: 'queue', properties: { privateDnsZoneId: queuePrivateDns.id } }]
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2024-07-01' = {
  name: 'aznic${resourceToken}'
  location: location
  tags: tags
  properties: {
    ipConfigurations: [{
      name: 'primary'
      properties: {
        privateIPAllocationMethod: 'Dynamic'
        subnet: { id: vnet.properties.subnets[0].id }
      }
    }]
  }
}

var cloudInit = '''
#cloud-config
write_files:
  - path: /opt/opc-worker/mock_proteus.py
    encoding: b64
    content: ${loadFileAsBase64('../worker/mock_proteus.py')}
  - path: /opt/opc-worker/azure_worker.py
    encoding: b64
    content: ${loadFileAsBase64('../worker/azure_worker.py')}
  - path: /opt/opc-worker/requirements.txt
    encoding: b64
    content: ${loadFileAsBase64('../worker/requirements.txt')}
  - path: /opt/opc-worker/bootstrap.sh
    encoding: b64
    permissions: '0755'
    content: ${loadFileAsBase64('../worker/bootstrap.sh')}
runcmd:
  - [bash, /opt/opc-worker/bootstrap.sh, '${storage.name}']
'''

resource vm 'Microsoft.Compute/virtualMachines@2025-04-01' = {
  name: 'azvm${resourceToken}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    hardwareProfile: { vmSize: vmSize }
    networkProfile: { networkInterfaces: [{ id: nic.id, properties: { primary: true } }] }
    osProfile: union({
      adminUsername: adminUsername
      computerName: 'opc-worker'
      linuxConfiguration: {
        disablePasswordAuthentication: true
        provisionVMAgent: true
        ssh: { publicKeys: [{ keyData: adminSshPublicKey, path: '/home/${adminUsername}/.ssh/authorized_keys' }] }
      }
    }, configureWorkerBootstrap ? { customData: base64(cloudInit) } : {})
    storageProfile: {
      imageReference: {
        offer: 'ubuntu-24_04-lts'
        publisher: 'Canonical'
        sku: 'server'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        deleteOption: 'Delete'
        managedDisk: { storageAccountType: 'StandardSSD_LRS' }
      }
    }
  }
}

resource vmQueueRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, vm.id, queueDataContributorRoleId)
  scope: storage
  properties: {
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: queueDataContributorRoleId
  }
}

resource vmBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, vm.id, blobDataContributorRoleId)
  scope: storage
  properties: {
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobDataContributorRoleId
  }
}

output storageAccountName string = storage.name
output queueName string = jobQueue.name
output resultContainerName string = resultContainer.name
output vmName string = vm.name
output vmPrivateIp string = nic.properties.ipConfigurations[0].properties.privateIPAddress
output containerAppsSubnetId string = vnet.properties.subnets[1].id
