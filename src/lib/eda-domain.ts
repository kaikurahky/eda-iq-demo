import { createHash, randomUUID } from "node:crypto";

export type RunStatus =
  | "awaiting_approval"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type IQSource = "Work IQ" | "Fabric IQ" | "Foundry IQ" | "Web IQ";

export interface OpcMetrics {
  epeP95Nm: number;
  pvBandNm: number;
  defectRiskPpm: number;
  processWindowScore: number;
  runtimeMinutes: number;
  computeCostUsd: number;
}

export interface Evidence {
  source: IQSource;
  title: string;
  detail: string;
  citation: string;
}

export interface DesignRun {
  id: string;
  generation: number;
  parentRunId?: string;
  name: string;
  strategy: string;
  status: RunStatus;
  risk: "low" | "medium" | "high";
  submittedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  progress: number;
  baseline: OpcMetrics;
  result?: OpcMetrics;
  evidence: Evidence[];
}

export interface CampaignParameters {
  epeMaximumNm: number;
  pvBandMaximumNm: number;
  processWindowMinimum: number;
  maskBiasNm: number;
  fragmentLimit: number;
  candidateCount: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  previousHash: string;
  hash: string;
}

export const baselineMetrics: OpcMetrics = {
  epeP95Nm: 4.8,
  pvBandNm: 13.6,
  defectRiskPpm: 780,
  processWindowScore: 71,
  runtimeMinutes: 94,
  computeCostUsd: 0.19,
};

export const iqEvidence: Evidence[] = [
  {
    source: "Work IQ",
    title: "OPCレビュー会議",
    detail: "line-end短縮を抑え、金曜までに検証可能なレシピ候補を提示する。",
    citation: "Teams / OPC review / 2026-07-21 10:00",
  },
  {
    source: "Fabric IQ",
    title: "Metal-2過去Run",
    detail: "同系統パターンではcorner serifと局所biasの組合せがEPE改善に有効。",
    citation: "OneLake / opc_runs / M2-142",
  },
  {
    source: "Foundry IQ",
    title: "社内OPCレシピガイド",
    detail: "密集パターンではfragment数を増やす前にmask biasとsmoothingを探索する。",
    citation: "Engineering KB / OPC-Guide-07 / section 4.2",
  },
  {
    source: "Web IQ",
    title: "公開ツールガイド",
    detail: "公開情報は一般化した検索語のみで照会し、設計識別子は送信しない。",
    citation: "Approved public domains / retrieved 2026-07-23",
  },
];

const candidateDefinitions = [
  {
    name: "Line-end Recovery",
    strategy: "line-end領域のfragmentとserifを増やし、局所mask biasを補正",
    risk: "low" as const,
  },
  {
    name: "PV Band Reduction",
    strategy: "process-window全体のPV Bandを目的関数にしてsmoothingを再探索",
    risk: "medium" as const,
  },
  {
    name: "Runtime Guardrail",
    strategy: "EPE制約を維持しながらfragment上限を絞り、計算時間を短縮",
    risk: "low" as const,
  },
];

export function createCandidateRuns(now = new Date()): DesignRun[] {
  return candidateDefinitions.map((candidate, index) => ({
    id: `RUN-${String(index + 101).padStart(4, "0")}`,
    generation: 1,
    ...candidate,
    status: "awaiting_approval",
    submittedBy: "eda-orchestrator@contoso.example",
    createdAt: new Date(now.getTime() + index * 1000).toISOString(),
    updatedAt: new Date(now.getTime() + index * 1000).toISOString(),
    progress: 0,
    baseline: baselineMetrics,
    evidence: iqEvidence.slice(0, index === 2 ? 4 : 3),
  }));
}

export function createFollowUpRuns(
  parent: DesignRun,
  parameters: CampaignParameters,
  generation: number,
  now = new Date(),
): DesignRun[] {
  if (!parent.result) {
    throw new Error("結果があるRunだけを親候補にできます。");
  }

  const names = ["Bias Balanced", "Line-end Focus", "PV Recovery", "Fragment Limited", "Corner Refine", "Smoothing Polish"];
  return names.slice(0, parameters.candidateCount).map((name, index) => ({
    id: `RUN-${String(generation).padStart(2, "0")}${String(index + 1).padStart(2, "0")}`,
    generation,
    parentRunId: parent.id,
    name: `G${generation} ${name}`,
    strategy: `${parent.name}を起点にmask bias ${parameters.maskBiasNm}nm、fragment上限${parameters.fragmentLimit}で局所再探索`,
    status: "awaiting_approval",
    risk: index === 1 || index === 5 ? "medium" as const : "low" as const,
    submittedBy: "eda-orchestrator@contoso.example",
    createdAt: new Date(now.getTime() + index * 1000).toISOString(),
    updatedAt: new Date(now.getTime() + index * 1000).toISOString(),
    progress: 0,
    baseline: parent.result!,
    evidence: iqEvidence,
  }));
}

export function approveRun(run: DesignRun, actor: string, now = new Date()): DesignRun {
  if (run.status !== "awaiting_approval") {
    throw new Error("承認待ちのRunだけを承認できます。");
  }

  return {
    ...run,
    status: "queued",
    approvedBy: actor,
    updatedAt: now.toISOString(),
    progress: 8,
  };
}

export function advanceRun(run: DesignRun, now = new Date()): DesignRun {
  if (!run.approvedBy) {
    throw new Error("Human approvalなしではEDA Runを開始できません。");
  }

  if (run.status === "queued") {
    return { ...run, status: "running", progress: 42, updatedAt: now.toISOString() };
  }

  if (run.status === "running") {
    const candidateIndex = Number(run.id.slice(-2)) - 1;
    const results: OpcMetrics[] = [
      { epeP95Nm: 2.7, pvBandNm: 9.8, defectRiskPpm: 310, processWindowScore: 86, runtimeMinutes: 71, computeCostUsd: 0.14 },
      { epeP95Nm: 2.4, pvBandNm: 8.9, defectRiskPpm: 260, processWindowScore: 90, runtimeMinutes: 82, computeCostUsd: 0.16 },
      { epeP95Nm: 2.9, pvBandNm: 9.4, defectRiskPpm: 290, processWindowScore: 88, runtimeMinutes: 63, computeCostUsd: 0.13 },
    ];
    const followUpResults: OpcMetrics[] = [
      { epeP95Nm: 2.2, pvBandNm: 8.1, defectRiskPpm: 220, processWindowScore: 92, runtimeMinutes: 61, computeCostUsd: 0.12 },
      { epeP95Nm: 2.0, pvBandNm: 7.8, defectRiskPpm: 190, processWindowScore: 94, runtimeMinutes: 68, computeCostUsd: 0.14 },
      { epeP95Nm: 2.3, pvBandNm: 8.0, defectRiskPpm: 205, processWindowScore: 93, runtimeMinutes: 58, computeCostUsd: 0.12 },
      { epeP95Nm: 2.5, pvBandNm: 8.6, defectRiskPpm: 240, processWindowScore: 91, runtimeMinutes: 49, computeCostUsd: 0.10 },
      { epeP95Nm: 2.1, pvBandNm: 7.9, defectRiskPpm: 198, processWindowScore: 94, runtimeMinutes: 64, computeCostUsd: 0.13 },
      { epeP95Nm: 1.9, pvBandNm: 7.6, defectRiskPpm: 180, processWindowScore: 95, runtimeMinutes: 72, computeCostUsd: 0.15 },
    ];
    const generationResults = run.generation === 1 ? results : followUpResults;

    return {
      ...run,
      status: "completed",
      progress: 100,
      result: generationResults[Math.max(0, Math.min(candidateIndex, generationResults.length - 1))],
      updatedAt: now.toISOString(),
    };
  }

  return run;
}

export function completeRun(run: DesignRun, result: OpcMetrics, now = new Date()): DesignRun {
  if (!run.approvedBy || (run.status !== "queued" && run.status !== "running")) {
    throw new Error("承認済みの実行中Runだけを完了できます。");
  }

  return {
    ...run,
    status: "completed",
    progress: 100,
    result,
    updatedAt: now.toISOString(),
  };
}

export function opcScore(metrics: OpcMetrics, baseline: OpcMetrics): number {
  const epeGain = ((baseline.epeP95Nm - metrics.epeP95Nm) / baseline.epeP95Nm) * 24;
  const pvGain = ((baseline.pvBandNm - metrics.pvBandNm) / baseline.pvBandNm) * 18;
  const processWindowGain = (metrics.processWindowScore - baseline.processWindowScore) * 0.8;
  const runtimeGain = ((baseline.runtimeMinutes - metrics.runtimeMinutes) / baseline.runtimeMinutes) * 12;
  const defectPenalty = Math.max(0, metrics.defectRiskPpm - 300) * 0.04;
  return Math.round(Math.max(0, Math.min(100, 55 + epeGain + pvGain + processWindowGain + runtimeGain - defectPenalty)) * 10) / 10;
}

export function appendAuditEvent(
  events: AuditEvent[],
  input: Omit<AuditEvent, "id" | "timestamp" | "previousHash" | "hash">,
  now = new Date(),
): AuditEvent[] {
  const previousHash = events.at(-1)?.hash ?? "GENESIS";
  const eventWithoutHash = {
    id: randomUUID(),
    timestamp: now.toISOString(),
    previousHash,
    ...input,
  };
  const hash = createHash("sha256").update(JSON.stringify(eventWithoutHash)).digest("hex");
  return [...events, { ...eventWithoutHash, hash }];
}

export function verifyAuditChain(events: AuditEvent[]): boolean {
  return events.every((event, index) => {
    const previousHash = index === 0 ? "GENESIS" : events[index - 1].hash;
    const { hash, ...eventWithoutHash } = event;
    const expected = createHash("sha256").update(JSON.stringify(eventWithoutHash)).digest("hex");
    return event.previousHash === previousHash && hash === expected;
  });
}