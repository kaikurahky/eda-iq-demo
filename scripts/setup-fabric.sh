#!/usr/bin/env bash
set -euo pipefail

workspace_id="${FABRIC_WORKSPACE_ID:?Set FABRIC_WORKSPACE_ID to an existing or trial Fabric workspace GUID}"
lakehouse_name="${FABRIC_LAKEHOUSE_NAME:-OpcOptimizationLakehouse}"
fabric_api='https://api.fabric.microsoft.com/v1'

token="$(az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken --output tsv)"
items="$(curl --fail --silent --show-error \
  --header "Authorization: Bearer $token" \
  "$fabric_api/workspaces/$workspace_id/lakehouses")"
lakehouse_id="$(printf '%s' "$items" | FABRIC_LAKEHOUSE_NAME="$lakehouse_name" python3 -c 'import json,sys,os; data=json.load(sys.stdin); name=os.environ["FABRIC_LAKEHOUSE_NAME"]; print(next((x["id"] for x in data.get("value",[]) if x.get("displayName")==name), ""))')"

if [[ -z "$lakehouse_id" ]]; then
  response_headers="$(mktemp)"
  trap 'rm -f "$response_headers"' EXIT
  curl --fail --silent --show-error \
    --dump-header "$response_headers" \
    --output /tmp/opc-fabric-create.json \
    --request POST \
    --header "Authorization: Bearer $token" \
    --header 'Content-Type: application/json' \
    --data "{\"displayName\":\"$lakehouse_name\",\"description\":\"Synthetic OPC recipes, runs, metrics, evidence, and audit events\"}" \
    "$fabric_api/workspaces/$workspace_id/lakehouses"
  location="$(awk 'BEGIN{IGNORECASE=1} /^Location:/ {gsub("\\r", "", $2); print $2}' "$response_headers")"
  if [[ -n "$location" ]]; then
    printf 'Fabric accepted an asynchronous operation: %s\n' "$location"
  fi
else
  printf 'Using existing Fabric lakehouse %s (%s)\n' "$lakehouse_name" "$lakehouse_id"
fi

printf 'Workspace: https://app.fabric.microsoft.com/groups/%s\n' "$workspace_id"