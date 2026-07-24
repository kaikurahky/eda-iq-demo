# Demo Runbook

## Story

1. Open the control room and establish the baseline: manual sweep, 94 minutes per run, fragmented evidence, and serial queueing.
2. Open each IQ evidence card. Explain that Work IQ supplies current intent, Fabric IQ supplies historical facts, and Foundry IQ supplies authoritative playbooks.
3. Approve all three generation-one recipes. Point out that the LLM does not execute commands; a typed envelope enters Azure Queue Storage.
4. Show the Azure VM worker moving jobs through queued, running, and completed states.
5. Open OPC comparison. Compare EPE, PV Band, process window, runtime, and cost, then approve the best feasible checkpoint.
6. Create generation two from the approved parent and tighten the fragment/runtime constraint.
7. Open the audit trail and show the linked SHA-256 hashes, actor, parent recipe, and parameter changes.
8. Close on the production architecture: replace one VM with CycleCloud Slurm, preserve the queue contract, and burst only when demand exists.

## Claims to Use

- Azure shortens decision time through parallel capacity and queue elasticity.
- Adaptive exploration can avoid low-value simulations.
- Fabric creates durable, reusable run lineage and shared metrics.
- Foundry provides cited recommendations while deterministic code enforces engineering constraints.
- The same design can connect to protected on-premises or Azure HPC compute.

## Claims to Avoid

- Do not claim benchmarked Proteus speedup; this repository uses a synthetic worker.
- Do not imply Work IQ, Fabric IQ, or Foundry IQ bypass source permissions.
- Do not claim that a single VM represents production OPC capacity.
- Do not expose customer GDS, PDK, masks, contours, or license information to prompts.