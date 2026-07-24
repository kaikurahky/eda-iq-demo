#!/usr/bin/env bash
set -euo pipefail

resource_group="${RESOURCE_GROUP:-rg-eda-opc-iq-demo}"
location="${LOCATION:-japaneast}"
foundry_location="${FOUNDRY_LOCATION:-japaneast}"
tenant_id="${AZURE_TENANT_ID:-16b3c013-d300-468d-ac64-7eda0820b6d3}"
subscription_id="${AZURE_SUBSCRIPTION_ID:-bd90ba39-1b34-4281-8578-8419b4092104}"
deployment_name="eda-iq-demo-$(date -u +%Y%m%d%H%M%S)"
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ssh_key="$(mktemp)"
trap 'rm -f "$ssh_key" "$ssh_key.pub"' EXIT

command -v az >/dev/null
command -v docker >/dev/null
current_tenant="$(az account show --query tenantId --output tsv)"
if [[ "$current_tenant" != "$tenant_id" ]]; then
  printf 'Azure CLI is signed into tenant %s, expected %s. Run: az login --tenant %s\n' "$current_tenant" "$tenant_id" "$tenant_id" >&2
  exit 1
fi
az account set --subscription "$subscription_id"
ssh-keygen -q -t ed25519 -N '' -f "$ssh_key"

az group create --name "$resource_group" --location "$location" --output none
worker_exists="$(az vm list --resource-group "$resource_group" --query "[?tags.application=='eda-iq-demo'] | length(@)" --output tsv)"
configure_worker_bootstrap=true
if (( worker_exists > 0 )); then
  configure_worker_bootstrap=false
fi

az deployment group validate \
  --resource-group "$resource_group" \
  --template-file "$project_root/infra/main.bicep" \
  --parameters "$project_root/infra/main.parameters.json" location="$location" foundryLocation="$foundry_location" adminSshPublicKey="$(<"$ssh_key.pub")" configureWorkerBootstrap="$configure_worker_bootstrap" \
  --output none
az deployment group what-if \
  --resource-group "$resource_group" \
  --template-file "$project_root/infra/main.bicep" \
  --parameters "$project_root/infra/main.parameters.json" location="$location" foundryLocation="$foundry_location" adminSshPublicKey="$(<"$ssh_key.pub")" configureWorkerBootstrap="$configure_worker_bootstrap" \
  --result-format ResourceIdOnly
az deployment group create \
  --name "$deployment_name" \
  --resource-group "$resource_group" \
  --template-file "$project_root/infra/main.bicep" \
  --parameters "$project_root/infra/main.parameters.json" location="$location" foundryLocation="$foundry_location" adminSshPublicKey="$(<"$ssh_key.pub")" configureWorkerBootstrap="$configure_worker_bootstrap" \
  --output none

output_query="properties.outputs.deployment.value"
registry_name="$(az deployment group show --name "$deployment_name" --resource-group "$resource_group" --query "$output_query.registryName" --output tsv)"
registry_server="$(az deployment group show --name "$deployment_name" --resource-group "$resource_group" --query "$output_query.registryLoginServer" --output tsv)"
app_name="$(az deployment group show --name "$deployment_name" --resource-group "$resource_group" --query "$output_query.containerAppName" --output tsv)"
app_url="$(az deployment group show --name "$deployment_name" --resource-group "$resource_group" --query "$output_query.applicationUrl" --output tsv)"
worker_vm="$(az deployment group show --name "$deployment_name" --resource-group "$resource_group" --query "$output_query.workerVmName" --output tsv)"
image="$registry_server/eda-iq-demo:$(date -u +%Y%m%d%H%M%S)"

az acr build --registry "$registry_name" --image "$image" "$project_root"
az containerapp update --name "$app_name" --resource-group "$resource_group" --image "$image" --output none
az vm run-command invoke --resource-group "$resource_group" --name "$worker_vm" --command-id RunShellScript --scripts 'systemctl is-active opc-worker' --query 'value[0].message' --output tsv

printf 'Application: %s\nMCP: %s/api/mcp\n' "$app_url" "$app_url"