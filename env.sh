#!/bin/bash

chmod +x scripts/deploy-azure.sh
AZURE_TENANT_ID=df5c178b-9ee5-4702-8227-beaccee0a317
AZURE_SUBSCRIPTION_ID=02822f3b-51ae-46e7-b446-9d74b942e87c
RESOURCE_GROUP=rg-eda-opc-iq-demo
LOCATION=japaneast
FOUNDRY_LOCATION=japaneast

#VM_NAME=$(az vm list --resource-group "$RESOURCE_GROUP" --query "[?tags.application=='eda-iq-demo'].name | [0]" --output tsv)

#APP_NAME=$(az containerapp list --resource-group "$RESOURCE_GROUP" --query "[?tags.application=='eda-iq-demo'].name | [0]" --output tsv)

echo "\$AZURE_TENANT_ID : $AZURE_TENANT_ID"
echo "\$AZURE_SUBSCRIPTION_ID : $AZURE_SUBSCRIPTION_ID"
echo "\$RESOURCE_GROUP : $RESOURCE_GROUP"
echo "\$LOCATION : $LOCATION"
echo "\$FOUNDRY_LOCATION : $FOUNDRY_LOCATION"
echo "\$VM_NAME : $VM_NAME"
echo "\$APP_NAME : $APP_NAME"
