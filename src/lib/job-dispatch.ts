import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { QueueClient } from "@azure/storage-queue";
import { z } from "zod";
import type { DesignRun, OpcMetrics } from "@/lib/eda-domain";

interface OpcJobEnvelope {
  runId: string;
  generation: number;
  maskBiasNm: number;
  fragmentLimit: number;
  smoothing: number;
  serifStrength: number;
  submittedAt: string;
}

const resultSchema = z.object({
  runId: z.string().min(1),
  metrics: z.object({
    epeP95Nm: z.number().nonnegative(),
    pvBandNm: z.number().nonnegative(),
    defectRiskPpm: z.number().nonnegative(),
    processWindowScore: z.number().min(0).max(100),
    runtimeMinutes: z.number().positive(),
    computeCostUsd: z.number().nonnegative(),
  }),
});

function azureCredential() {
  const managedIdentityClientId = process.env.AZURE_CLIENT_ID;
  return managedIdentityClientId
    ? new ManagedIdentityCredential({ clientId: managedIdentityClientId })
    : new DefaultAzureCredential();
}

function recipeFor(run: DesignRun): OpcJobEnvelope {
  const candidate = Math.max(0, Number(run.id.slice(-2)) - 1);
  return {
    runId: run.id,
    generation: run.generation,
    maskBiasNm: Number((1.1 + candidate * 0.15).toFixed(2)),
    fragmentLimit: Math.min(420, 220 + candidate * 20),
    smoothing: Number((0.56 + candidate * 0.03).toFixed(2)),
    serifStrength: Number((0.64 + candidate * 0.04).toFixed(2)),
    submittedAt: new Date().toISOString(),
  };
}

export async function dispatchOpcJob(run: DesignRun): Promise<"azure-queue" | "local-simulator"> {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  if (!accountName) return "local-simulator";

  const queueName = process.env.OPC_QUEUE_NAME ?? "opc-jobs";
  const queue = new QueueClient(
    `https://${accountName}.queue.core.windows.net/${queueName}`,
    azureCredential(),
  );
  await queue.sendMessage(JSON.stringify(recipeFor(run)));
  return "azure-queue";
}

export async function fetchOpcResults(runs: DesignRun[]): Promise<Map<string, OpcMetrics>> {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  if (!accountName) return new Map();

  const service = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    azureCredential(),
  );
  const container = service.getContainerClient(process.env.OPC_RESULTS_CONTAINER ?? "opc-results");
  const results = new Map<string, OpcMetrics>();

  await Promise.all(runs.map(async (run) => {
    const blob = container.getBlockBlobClient(`runs/${run.id}/result.json`);
    if (!(await blob.exists())) return;
    const response = await blob.downloadToBuffer();
    const parsed = resultSchema.parse(JSON.parse(response.toString("utf8")));
    if (parsed.runId !== run.id) {
      throw new Error(`Blob result runId mismatch: expected ${run.id}, received ${parsed.runId}`);
    }
    results.set(run.id, parsed.metrics);
  }));

  return results;
}