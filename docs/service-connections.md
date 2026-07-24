# IQ and Data Service Connections

## Work IQ

Work IQ is user scoped and governed in Microsoft 365. Enable usage-based billing and policy in the Microsoft 365 admin center, register the application for the Work IQ API, and use delegated authorization so every call runs as the signed-in engineer. Configure the Work IQ remote MCP or REST endpoint as a Foundry agent tool. Do not use an application identity to impersonate broad organizational access.

For this demo, restrict retrieval to an OPC review Teams meeting, an approved SharePoint playbook library, and named project participants. Validate that a user without access to the meeting or library cannot retrieve those citations.

## Fabric and Fabric IQ

Use an existing or trial Fabric capacity. Set `FABRIC_WORKSPACE_ID` and run `scripts/setup-fabric.sh` to create or reuse `OpcOptimizationLakehouse`. Load synthetic `opc_runs`, `opc_recipes`, `opc_metrics`, `opc_evidence`, and `audit_events` data, then create an ontology with Design, Layer, Recipe, SimulationRun, Metric, Recommendation, and Approval entities.

Fabric IQ is preview. Review geography, compliance, tenant settings, and capacity cost before enabling it as a Foundry tool.

## Foundry and Foundry IQ

The Bicep deployment creates a Foundry account/project and AI Search Basic. Deploy a small supported model only after checking model catalog support and subscription quota. In Foundry, create a knowledge base over `knowledge/opc-recipe-guide.md` and synthetic OneLake files, connect it to the agent, and verify every answer includes a matching citation.

OneLake knowledge requires Fabric, Foundry, and AI Search in the same tenant. Data can be processed outside the Fabric compliance or geographic boundary; complete the required review before using non-synthetic data.