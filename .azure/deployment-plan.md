# EDA OPC Optimization Demo Deployment Plan

## Status

Validated - Ready for Deployment

## Goal

Build a reusable Azure demo that emulates Synopsys Proteus OPC recipe optimization, runs sample compute jobs on a small Linux VM, and demonstrates permission-aware orchestration and insight with Work IQ, Fabric IQ, Foundry IQ, Microsoft Fabric, and Microsoft Foundry.

## Azure Context

- Tenant: `16b3c013-d300-468d-ac64-7eda0820b6d3`
- Subscription: `bd90ba39-1b34-4281-8578-8419b4092104`
- Sign-in account: `hikurais@microsoft.com`
- Preferred region: `japaneast` for all Azure resources, including Foundry and AI Search
- Resource group: `rg-eda-opc-iq-demo` by default
- Current CLI context: Windows Azure CLI with WAM authenticated to the target tenant and subscription

## Planned Work

1. Convert the existing PPA placement demo into an OPC recipe optimization demo.
2. Add a deterministic synthetic Proteus-like runner that accepts bounded recipe parameters and emits EPE, PV Band, defect-risk, process-window, runtime, and estimated cost metrics.
3. Add asynchronous job contracts and an Azure Linux VM worker bootstrap. The demo VM emulates a one-node Slurm partition without requiring EDA licenses.
4. Add Foundry-backed recommendation and explanation with deterministic fallback data, citations, and human approval before execution.
5. Add Fabric export for run facts, recipe dimensions, evidence, and audit events. Support an existing Fabric workspace/capacity by ID; make new Fabric capacity creation opt-in.
6. Replace the current UI vocabulary and workflow with OPC-specific campaign controls, wafer/contour results, Pareto comparison, Azure-vs-on-premises time-to-result, utilization, and scale-out narrative.
7. Complete reusable Bicep, parameter files, bootstrap scripts, sample data, GitHub Actions validation, and deployment/runbook documentation.
8. Validate locally, run Bicep validation and Azure what-if, then deploy only after explicit approval.
9. Run post-deployment health, queue-to-VM, Foundry grounding, Fabric export, and end-to-end demo smoke tests.

## Architecture

### Experience and Control Plane

- Next.js dashboard on Azure Container Apps: campaign setup, human approval, live status, comparison, citations, and audit trail.
- API/MCP boundary: exposes bounded OPC operations; the model never receives shell access and never constructs arbitrary VM commands.
- Azure Storage: Queue Storage for job envelopes and Blob Storage for synthetic input decks and result artifacts. Public network access is disabled; the VM and Container Apps reach Queue/Blob through Private Endpoints and Private DNS.
- Application Insights and Log Analytics: request, queue latency, worker runtime, failures, and end-to-end traces.

### AI and Intelligence Plane

- Work IQ: optional user-delegated context from meetings, mail, files, and approvals. The portable demo ships with clearly labeled synthetic evidence because Work IQ requires tenant-specific Microsoft 365 governance and user context.
- Fabric IQ: OPC domain semantics for `Design`, `Layer`, `Recipe`, `SimulationRun`, `ProcessWindow`, and `Recommendation`, backed by OneLake/Lakehouse data. Fabric IQ integration is preview and remains an optional post-deploy enablement step.
- Foundry IQ: permission-aware knowledge base containing synthetic OPC playbooks, prior experiment summaries, and operating constraints, with citations. OneLake knowledge requires Fabric, Foundry, and Azure AI Search in the same tenant; AI Search Basic or higher is required for that path.
- Microsoft Foundry agent/model: explains tradeoffs, proposes a bounded next experiment, and summarizes results. Numerical objective evaluation and all guardrails stay deterministic in application code.

### Compute Plane

- One small Ubuntu Linux VM, initially `Standard_B2s` subject to target-subscription availability, with system-assigned managed identity and no public inbound SSH.
- Worker service polls the queue using managed identity, downloads a signed synthetic job specification, runs the mock OPC simulator, uploads JSON/CSV/PNG artifacts, and updates status.
- Production evolution: replace the VM worker with CycleCloud Slurm or an existing on-premises Slurm cluster through a private EDA gateway. The job contract remains unchanged.

### Fabric Data Products

- Lakehouse folders/tables: `opc_runs`, `opc_recipes`, `opc_metrics`, `opc_evidence`, and `audit_events`.
- Semantic metrics: time-to-first-feasible recipe, EPE p95, PV Band, process-window score, compute minutes, queue wait, cost per feasible candidate, and exploration efficiency.
- Demo report: baseline manual sweep versus AI-guided adaptive exploration, emphasizing fewer simulations and parallel cloud execution rather than claiming that a single simulation becomes intrinsically faster.

### End-to-End Flow

1. Work/Fabric/Foundry evidence is assembled under the caller's permissions or loaded from labeled synthetic demo fixtures.
2. The optimizer proposes only schema-valid recipe parameters within hard engineering bounds.
3. A silicon lead reviews citations, expected benefit, cost, and data boundary, then approves.
4. Container Apps writes an immutable job envelope to Queue Storage.
5. The VM worker executes the synthetic OPC simulator and writes artifacts and metrics to Blob Storage.
6. The dashboard streams status and ranks candidates on a deterministic Pareto frontier.
7. Results are exported to OneLake/Fabric and can become the next Foundry IQ grounding source.

## Demo Story

1. Show an on-premises baseline: serial parameter sweep, idle license wait, and long time-to-result.
2. Ask the agent why the current recipe fails at line-end and corner patterns; show source citations and Fabric history.
3. Approve three bounded candidates and watch the Azure VM execute real synthetic compute jobs.
4. Compare exhaustive sweep versus adaptive exploration: simulations avoided, elapsed time saved, cloud cost, and quality guardrails.
5. Select a recipe checkpoint and create the next generation while preserving full lineage and approval history.
6. Close with the production path: burst to CycleCloud Slurm, keep PDK/GDS in the protected compute plane, and scale workers independently from the intelligence plane.

## Portability and IaC

- Bicep remains the source of truth and uses tenant-neutral parameters.
- No subscription, tenant, user, password, API key, Fabric workspace ID, or model endpoint is committed as a secret.
- Core deployment creates Container Apps, ACR, Storage, monitoring, VNet, NSG, managed identities, and the Linux VM.
- Foundry resource/project, model deployment, and AI Search are parameterized and subject to regional quota/capacity validation.
- Fabric workspace/lakehouse provisioning uses Fabric REST APIs after Azure deployment because Fabric items and workspace roles are tenant-level SaaS objects. Existing workspace/capacity IDs are preferred.
- Optional Fabric capacity creation is disabled by default because an F SKU incurs ongoing cost; the deploy script must require explicit opt-in.

## Cost Controls

- Use a burstable demo VM and expose stop/deallocate commands in the runbook.
- Keep Container Apps at one small replica for the live demo, with a documented scale-to-zero variant after state persistence is enabled.
- Use low-cost model and search SKUs only after target-region quota checks.
- Do not create Fabric capacity until the user chooses existing capacity, trial capacity, or explicit paid F SKU deployment.

## Security

- Use managed identities and Azure RBAC where supported.
- Do not commit credentials or tenant-specific secrets.
- Keep deployment parameters portable across Azure tenants and subscriptions.
- Disable storage shared-key authorization and anonymous blob access.
- Use private networking for the VM and no public IP; use Run Command or Bastion only for break-glass administration.
- Treat recipe parameters as typed data, not executable text; reject unknown fields and out-of-range values.
- Keep GDS, mask data, PDK files, proprietary contours, and license material outside prompts and web search.
- Clearly label all demo input and results as synthetic and avoid unsupported claims about Synopsys product behavior.

## Validation

- Application lint and production build
- Unit tests for objective scoring, parameter bounds, state transitions, and audit-chain validation
- Worker contract and synthetic simulator smoke tests
- Infrastructure static validation and what-if validation
- Azure region, SKU, model quota, and RBAC prerequisite checks after target-tenant login
- Local OPC optimization workflow and browser checks at desktop and mobile sizes
- Post-deployment health, queue-to-worker, artifact, Foundry, Fabric, and end-to-end demo tests

## Section 7: Validation Proof

Validated on 2026-07-24 against subscription `bd90ba39-1b34-4281-8578-8419b4092104`.

| Check | Command or evidence | Result |
| --- | --- | --- |
| Target identity and authorization | Windows Azure CLI WAM `az account show`; subscription role check | Passed: target tenant/subscription, account `hikurais@microsoft.com`, Owner |
| Resource providers | `az provider show` and `az provider register --namespace Microsoft.App --wait` | Passed: all required providers registered, including `Microsoft.App` |
| VM SKU and quota | Japan East `Standard_B2s` SKU restriction and Standard BS family usage checks | Passed: SKU unrestricted; 0 of 100 vCPUs used |
| Azure Policy | Subscription and resource-group policy assignment review | Passed: no assignment found that blocks the planned resource types |
| Application quality | `npm run check` | Passed: lint, tests, and production build |
| Worker contract | `python -m unittest discover -s worker/tests -v` | Passed: 2 of 2 tests |
| Container packaging | Docker image build and local HTTP/API/MCP smoke checks | Passed |
| Bicep compilation | WSL and Windows `az bicep build --file infra/main.bicep` | Passed; only non-blocking BCP081 type-metadata warning for VM API `2025-04-01` |
| ARM validation | `az deployment group validate` with all resources, including Foundry and AI Search, in Japan East | Passed: `provisioningState` is `Succeeded` at `2026-07-24T09:25:01Z` |
| RBAC static review | Storage, ACR, VM, Container App, and Foundry role assignments in Bicep | Passed: managed identities and least-privilege data-plane roles are present |
| Deployment preview | `az deployment group what-if --result-format ResourceIdOnly` | Passed: 22 creates, 0 modifies, 0 deletes; 3 deployment-time RBAC expressions marked `Unsupported` as expected |
| Private networking remediation | Storage policy `MCAPSGovDeployPolicies / StorageAccount_PublicNetwork_Modify`; Blob/Queue Private Endpoints and Private DNS | Passed: Storage remains public-network disabled; both Private Endpoint connections are `Approved`; VM resolves Queue to `10.42.1.6` and Blob to `10.42.1.5` |
| Container Apps recovery | Deployment `eda-iq-private-link-recreate-20260724201111` | Passed: Workload profiles environment with the `Consumption` profile, VNet integration, and application revision ready in Japan East |
| Queue-to-worker E2E | Approved `RUN-0101` through the public API; VM `opc-worker` journal; result API | Passed: approval HTTP 200, worker uploaded `runs/RUN-0101/result.json` at `2026-07-24T11:19:02Z`, API reported `completed` with 100% progress |

Core post-deployment health and Queue-to-VM-to-Blob checks passed. Optional tenant-governed Foundry agent, Fabric, Fabric IQ, Foundry IQ, and Work IQ enablement remains separate from the portable core deployment.

## Known Decisions and Constraints

- Plan approved on 2026-07-24 for implementation, validation, and deployment.
- Use an existing or trial Fabric capacity; do not create a paid F SKU.
- Implement a real Work IQ connection, subject to target-tenant licensing, billing, admin policy, and delegated user consent.
- The available PowerPoint file in the workspace contains one slide, so the referenced page 15 could not be inspected. This plan is based on the written request and current Microsoft documentation.
- The existing application is a functioning synthetic PPA exploration demo, but its metrics and terminology are place-and-route oriented and must be changed to OPC.
- Work IQ, Fabric IQ, and parts of Foundry IQ are tenant-governed or preview capabilities. The demo must degrade gracefully to synthetic evidence when those services are not enabled.
- WSL device-code authentication is blocked by compliant-device Conditional Access. Azure validation and deployment use Windows Azure CLI with WAM on the managed host.
- Fabric capacity choice remains an approval input; all Azure resources use the approved Japan East region.

## Approval Gate

Deployment to the validated subscription and Japan East region was explicitly approved by the user on 2026-07-24. Paid Fabric F SKU creation remains excluded unless separately approved.