import { readFileSync, renameSync, writeFileSync } from "node:fs";
import {
  advanceRun,
  appendAuditEvent,
  approveRun,
  completeRun,
  createCandidateRuns,
  createFollowUpRuns,
  opcScore,
  verifyAuditChain,
  type AuditEvent,
  type CampaignParameters,
  type DesignRun,
  type OpcMetrics,
} from "@/lib/eda-domain";

export interface DemoSnapshot {
  runs: DesignRun[];
  auditEvents: AuditEvent[];
  auditChainValid: boolean;
  finalApproval: FinalApproval | null;
  finalApprovals: FinalApproval[];
  campaigns: Campaign[];
  currentGeneration: number;
  generatedAt: string;
}

export interface FinalApproval {
  runId: string;
  generation: number;
  approvedBy: string;
  approvedAt: string;
}

export interface Campaign {
  id: string;
  generation: number;
  name: string;
  parentRunId?: string;
  parameters: CampaignParameters;
  createdAt: string;
}

export interface FollowUpCampaignInput {
  parentRunId: string;
  name: string;
  parameters: CampaignParameters;
}

interface DemoState {
  runs: DesignRun[];
  auditEvents: AuditEvent[];
  finalApprovals: FinalApproval[];
  campaigns: Campaign[];
  currentGeneration: number;
}

const globalForDemo = globalThis as unknown as { edaDemoState?: DemoState };
const stateFile = "/tmp/eda-iq-demo-state.json";

function createState(): DemoState {
  const runs = createCandidateRuns();
  const createdAt = new Date().toISOString();
  const auditEvents = appendAuditEvent([], {
    actor: "eda-orchestrator",
    action: "PLAN_CREATED",
    target: "OPC recipe exploration",
    detail: "4つのIQソースを根拠に3つのOPCレシピ候補を生成。Human approvalを要求。",
  });
  return {
    runs,
    auditEvents,
    finalApprovals: [],
    currentGeneration: 1,
    campaigns: [{
      id: "CAMPAIGN-G1",
      generation: 1,
      name: "Initial OPC Recipe Exploration",
      parameters: {
        epeMaximumNm: 3,
        pvBandMaximumNm: 10,
        processWindowMinimum: 85,
        maskBiasNm: 1.5,
        fragmentLimit: 240,
        candidateCount: 3,
      },
      createdAt,
    }],
  };
}

function state(): DemoState {
  if (!globalForDemo.edaDemoState) {
    try {
      globalForDemo.edaDemoState = JSON.parse(readFileSync(stateFile, "utf8")) as DemoState;
    } catch {
      globalForDemo.edaDemoState = createState();
      persistState(globalForDemo.edaDemoState);
    }
  }
  return globalForDemo.edaDemoState;
}

function persistState(current: DemoState): void {
  const temporaryFile = `${stateFile}.${process.pid}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(current), "utf8");
  renameSync(temporaryFile, stateFile);
  globalForDemo.edaDemoState = current;
}

function refreshRuns(current: DemoState): void {
  const now = new Date();
  let changed = false;
  current.runs = current.runs.map((run) => {
    const elapsed = now.getTime() - new Date(run.updatedAt).getTime();
    let next = run;

    if (run.status === "queued" && elapsed >= 1200) {
      changed = true;
      next = advanceRun(run, now);
      current.auditEvents = appendAuditEvent(current.auditEvents, {
        actor: "mock-eda-runner",
        action: "RUN_STARTED",
        target: run.id,
        detail: `${run.name}を隔離された疑似EDA workerで開始。`,
      }, now);
    } else if (!process.env.AZURE_STORAGE_ACCOUNT_NAME && run.status === "running" && elapsed >= 2600) {
      changed = true;
      next = advanceRun(run, now);
      current.auditEvents = appendAuditEvent(current.auditEvents, {
        actor: "mock-eda-runner",
        action: "RUN_COMPLETED",
        target: run.id,
        detail: `${run.name}の合成OPCレポートを生成。score=${opcScore(next.result!, next.baseline)}`,
      }, now);
    }

    return next;
  });
  if (changed) persistState(current);
}

export function applyOpcResults(results: Map<string, OpcMetrics>): DemoSnapshot {
  if (results.size === 0) return getSnapshot();

  const current = state();
  let changed = false;
  current.runs = current.runs.map((run) => {
    const result = results.get(run.id);
    if (!result || (run.status !== "queued" && run.status !== "running")) return run;

    changed = true;
    const completed = completeRun(run, result);
    current.auditEvents = appendAuditEvent(current.auditEvents, {
      actor: "azure-opc-worker",
      action: "RUN_COMPLETED",
      target: run.id,
      detail: `${run.name}のBlob結果を検証して反映。score=${opcScore(result, run.baseline)}`,
    });
    return completed;
  });
  if (changed) persistState(current);
  return getSnapshot();
}

export function getSnapshot(): DemoSnapshot {
  const current = state();
  refreshRuns(current);
  const finalApproval = current.finalApprovals.find((approval) => approval.generation === current.currentGeneration) ?? null;
  return {
    runs: current.runs,
    auditEvents: current.auditEvents,
    auditChainValid: verifyAuditChain(current.auditEvents),
    finalApproval,
    finalApprovals: current.finalApprovals,
    campaigns: current.campaigns,
    currentGeneration: current.currentGeneration,
    generatedAt: new Date().toISOString(),
  };
}

export function approveDemoRun(runId: string, actor: string): DemoSnapshot {
  const current = state();
  const runIndex = current.runs.findIndex((run) => run.id === runId);
  if (runIndex < 0) {
    throw new Error(`Run ${runId} が見つかりません。`);
  }
  if (current.runs[runIndex].generation !== current.currentGeneration) {
    throw new Error("過去世代のRunは変更できません。");
  }

  current.runs[runIndex] = approveRun(current.runs[runIndex], actor);
  current.auditEvents = appendAuditEvent(current.auditEvents, {
    actor,
    action: "RUN_APPROVED",
    target: runId,
    detail: "OPC探索条件を確認し、疑似Proteus Runnerへの投入を承認。",
  });
  persistState(current);
  return getSnapshot();
}

export function approveFinalCandidate(runId: string, actor: string): DemoSnapshot {
  const current = state();
  const run = current.runs.find((candidate) => candidate.id === runId);
  if (!run || run.generation !== current.currentGeneration || run.status !== "completed" || !run.result) {
    throw new Error("完了済みのPareto候補だけを最終承認できます。");
  }
  const existingApproval = current.finalApprovals.find((approval) => approval.generation === current.currentGeneration);
  if (existingApproval) {
    throw new Error(`${existingApproval.runId} はすでに最終承認済みです。`);
  }

  const approvedAt = new Date();
  current.finalApprovals.push({
    runId,
    generation: current.currentGeneration,
    approvedBy: actor,
    approvedAt: approvedAt.toISOString(),
  });
  current.auditEvents = appendAuditEvent(current.auditEvents, {
    actor,
    action: "FINAL_CANDIDATE_APPROVED",
    target: runId,
    detail: `${run.name}をマスクデータ準備への引き渡し候補として最終承認。score=${opcScore(run.result, run.baseline)}`,
  }, approvedAt);
  persistState(current);
  return getSnapshot();
}

export function createFollowUpCampaign(input: FollowUpCampaignInput, actor: string): DemoSnapshot {
  const current = state();
  const currentApproval = current.finalApprovals.find((approval) => approval.generation === current.currentGeneration);
  if (!currentApproval) {
    throw new Error("現在のCampaignを最終承認してから次の探索を作成してください。");
  }
  const parent = current.runs.find((run) => run.id === input.parentRunId && run.generation === current.currentGeneration);
  if (!parent || parent.status !== "completed" || !parent.result) {
    throw new Error("現在世代の完了済みRunを親候補に選択してください。");
  }
  const parameters = input.parameters;
  const numericParameters = [
    parameters.epeMaximumNm,
    parameters.pvBandMaximumNm,
    parameters.processWindowMinimum,
    parameters.maskBiasNm,
    parameters.fragmentLimit,
    parameters.candidateCount,
  ];
  if (numericParameters.some((value) => !Number.isFinite(value))) {
    throw new Error("探索パラメータには有効な数値を指定してください。");
  }
  if (parameters.candidateCount < 3 || parameters.candidateCount > 6) {
    throw new Error("候補数は3から6の範囲で指定してください。");
  }
  if (parameters.epeMaximumNm <= 0 || parameters.pvBandMaximumNm <= 0 || parameters.processWindowMinimum <= 0 || parameters.processWindowMinimum > 100 || parameters.fragmentLimit < 50 || parameters.fragmentLimit > 1000) {
    throw new Error("制約値は0より大きい値を指定してください。");
  }

  const now = new Date();
  const generation = current.currentGeneration + 1;
  const campaign: Campaign = {
    id: `CAMPAIGN-G${generation}`,
    generation,
    name: input.name.trim() || `Generation ${generation} Refinement`,
    parentRunId: parent.id,
    parameters,
    createdAt: now.toISOString(),
  };
  current.campaigns.push(campaign);
  current.runs.push(...createFollowUpRuns(parent, parameters, generation, now));
  current.currentGeneration = generation;
  current.auditEvents = appendAuditEvent(current.auditEvents, {
    actor,
    action: "PARENT_CHECKPOINT_SELECTED",
    target: parent.id,
    detail: `${parent.name}をGeneration ${generation}の親チェックポイントに選択。`,
  }, now);
  current.auditEvents = appendAuditEvent(current.auditEvents, {
    actor,
    action: "CAMPAIGN_PARAMETERS_CHANGED",
    target: campaign.id,
    detail: `EPE<=${parameters.epeMaximumNm}nm, PV Band<=${parameters.pvBandMaximumNm}nm, Process Window>=${parameters.processWindowMinimum}, Mask Bias=${parameters.maskBiasNm}nm, Fragments<=${parameters.fragmentLimit}。`,
  }, now);
  current.auditEvents = appendAuditEvent(current.auditEvents, {
    actor: "eda-orchestrator",
    action: "FOLLOW_UP_CAMPAIGN_CREATED",
    target: campaign.id,
    detail: `${parameters.candidateCount}候補を生成し、Human approvalを要求。親Run=${parent.id}`,
  }, now);
  persistState(current);
  return getSnapshot();
}

export function resetDemo(): DemoSnapshot {
  persistState(createState());
  return getSnapshot();
}