"use client";

import { useEffect, useState } from "react";
import {
  Activity, BadgeCheck, BookOpenText, Bot, Check, ChevronRight, CircleGauge,
  Clock3, Cpu, Database, ExternalLink, Fingerprint, Globe2, History,
  GitBranch, Layers3, Mail, Network, Play, Plus, RefreshCw, ServerCog,
  ShieldCheck, SlidersHorizontal, Sparkles, Trophy, UserCheck,
} from "lucide-react";
import type { DemoSnapshot, FollowUpCampaignInput } from "@/lib/demo-store";
import { opcScore, type CampaignParameters, type DesignRun, type IQSource, type OpcMetrics } from "@/lib/eda-domain";

type View = "runs" | "compare" | "audit";

const iqMeta: Record<IQSource, { icon: typeof Mail; detail: string; tone: string }> = {
  "Work IQ": { icon: Mail, detail: "会議・メール・担当者文脈", tone: "coral" },
  "Fabric IQ": { icon: Database, detail: "Recipe・Run・process window", tone: "teal" },
  "Foundry IQ": { icon: BookOpenText, detail: "OPC標準・過去実験・ガイド", tone: "blue" },
  "Web IQ": { icon: Globe2, detail: "承認済み公開ドメイン", tone: "amber" },
};

const statusLabel: Record<DesignRun["status"], string> = {
  awaiting_approval: "承認待ち", queued: "Queue投入済み", running: "実行中", completed: "完了", failed: "失敗",
};

async function readSnapshot(): Promise<DemoSnapshot> {
  const response = await fetch("/api/demo", { cache: "no-store" });
  if (!response.ok) throw new Error("デモ状態を取得できませんでした。");
  return response.json();
}

function formatSigned(value: number, digits = 3) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function metricDelta(result: OpcMetrics, baseline: OpcMetrics, key: keyof OpcMetrics) {
  return ((result[key] - baseline[key]) / baseline[key]) * 100;
}

function WaferMark() {
  return <div className="wafer-mark" aria-label="EDA IQ Orchestrator"><span className="wafer-grid" /><Sparkles size={19} strokeWidth={2.2} /></div>;
}

function RunCard({ run, busy, onApprove }: { run: DesignRun; busy: boolean; onApprove: (id: string) => void }) {
  const complete = run.status === "completed" && run.result;
  return <article className={`run-card status-${run.status}`}>
    <div className="run-card-head">
      <div><div className="run-id"><span>{run.id}</span><span className="generation-badge">GEN {run.generation}</span><span className={`risk risk-${run.risk}`}>{run.risk} risk</span></div><h3>{run.name}</h3></div>
      <div className={`status-badge status-badge-${run.status}`}>
        {run.status === "completed" ? <Check size={14} /> : run.status === "running" ? <Activity size={14} /> : <Clock3 size={14} />}{statusLabel[run.status]}
      </div>
    </div>
    <p className="strategy">{run.strategy}</p>
    <div className="evidence-row">{run.evidence.map((evidence) => <span key={evidence.source}>{evidence.source}</span>)}</div>
    {run.status !== "awaiting_approval" && <div className="progress-wrap"><div className="progress-label"><span>Azure VM / Mock Proteus</span><strong>{run.progress}%</strong></div><div className="progress-track"><span style={{ width: `${run.progress}%` }} /></div></div>}
    {complete && <div className="result-strip">
      <div><span>EPE p95</span><strong className={run.result!.epeP95Nm <= 3 ? "good" : ""}>{run.result!.epeP95Nm.toFixed(1)} nm</strong></div>
      <div><span>PV Band</span><strong>{run.result!.pvBandNm.toFixed(1)} nm</strong></div>
      <div><span>OPC Score</span><strong className="score">{opcScore(run.result!, run.baseline)}</strong></div>
    </div>}
    {run.status === "awaiting_approval" && <button className="approve-button" disabled={busy} onClick={() => onApprove(run.id)}><UserCheck size={17} />設計条件を承認</button>}
    {run.approvedBy && <p className="approved-by"><BadgeCheck size={14} /> {run.approvedBy} が承認</p>}
  </article>;
}

function CompareView({ runs }: { runs: DesignRun[] }) {
  const completed = runs.filter((run) => run.result);
  if (!completed.length) return <div className="empty-state"><CircleGauge size={38} /><h3>比較可能なRunはまだありません</h3><p>承認したRunが完了すると、OPC品質とtime-to-resultを比較できます。</p></div>;
  const bestScore = Math.max(...completed.map((run) => opcScore(run.result!, run.baseline)));
  return <div className="comparison-table-wrap"><table className="comparison-table">
    <thead><tr><th>Candidate</th><th>EPE p95</th><th>PV Band</th><th>Defect risk</th><th>Process window</th><th>Runtime</th><th>Compute cost</th><th>Score</th></tr></thead>
    <tbody>
      <tr className="baseline-row"><td><strong>Baseline</strong><small>手動パラメータ探索</small></td><td>{runs[0].baseline.epeP95Nm.toFixed(1)} nm</td><td>{runs[0].baseline.pvBandNm.toFixed(1)} nm</td><td>{runs[0].baseline.defectRiskPpm} ppm</td><td>{runs[0].baseline.processWindowScore}</td><td>{runs[0].baseline.runtimeMinutes} min</td><td>${runs[0].baseline.computeCostUsd.toFixed(2)}</td><td>55.0</td></tr>
      {completed.map((run) => { const score = opcScore(run.result!, run.baseline); return <tr key={run.id} className={score === bestScore ? "best-row" : ""}>
        <td><strong>{run.name}</strong><small>Gen {run.generation} · {run.id}{run.parentRunId ? ` · parent ${run.parentRunId}` : ""}</small></td><td className={run.result!.epeP95Nm <= 3 ? "good" : ""}>{run.result!.epeP95Nm.toFixed(1)} nm<small>{formatSigned(metricDelta(run.result!, run.baseline, "epeP95Nm"), 1)}%</small></td><td>{run.result!.pvBandNm.toFixed(1)} nm<small>{formatSigned(metricDelta(run.result!, run.baseline, "pvBandNm"), 1)}%</small></td>
        <td>{run.result!.defectRiskPpm} ppm</td><td>{run.result!.processWindowScore}<small>{formatSigned(metricDelta(run.result!, run.baseline, "processWindowScore"), 1)}%</small></td>
        <td>{run.result!.runtimeMinutes} min</td><td>${run.result!.computeCostUsd.toFixed(2)}</td><td><span className="score-pill">{score}</span>{score === bestScore && <small className="recommended">推奨</small>}</td>
      </tr>; })}
    </tbody>
  </table></div>;
}

function OpcWorkflow({ snapshot }: { snapshot: DemoSnapshot }) {
  const runs = snapshot.runs.filter((run) => run.generation === snapshot.currentGeneration);
  const activeJobs = runs.filter((run) => run.status === "queued" || run.status === "running").length;
  const completedRuns = runs.filter((run) => run.status === "completed").length;
  const campaignStarted = runs.some((run) => run.status !== "awaiting_approval");
  const stages = [
    { name: "Microsoft IQ", icon: Layers3, state: "ready", status: "Context ready", detail: "Work / Fabric / Foundry / Web" },
    { name: "Adaptive Optimizer", icon: Cpu, state: campaignStarted ? "active" : "waiting", status: campaignStarted ? `Generation ${snapshot.currentGeneration} active` : "Awaiting approval", detail: `${runs.length} bounded OPC recipes prepared` },
    { name: "Azure OPC Jobs", icon: ServerCog, state: activeJobs ? "active" : completedRuns ? "ready" : "waiting", status: activeJobs ? `${activeJobs} jobs active` : completedRuns ? "Jobs completed" : "Queue gated", detail: "Linux VM now / CycleCloud Slurm next" },
    { name: "Pareto Candidates", icon: Trophy, state: completedRuns ? "ready" : "waiting", status: `${completedRuns} candidates ready`, detail: "EPE, PV Band, window, time and cost" },
    { name: "Final Approval", icon: UserCheck, state: snapshot.finalApproval ? "approved" : completedRuns ? "action" : "waiting", status: snapshot.finalApproval ? `${snapshot.finalApproval.runId} approved` : completedRuns ? "Decision required" : "Waiting for results", detail: "Human sign-off before downstream handoff" },
  ];

  return <section className="cadence-workflow" aria-label="OPC exploration workflow">
    {stages.map((stage, index) => { const Icon = stage.icon; return <article className={`workflow-stage stage-${stage.state}`} key={stage.name}>
      <div className="stage-index">0{index + 1}</div>
      <div className="stage-icon"><Icon size={19} /></div>
      <div className="stage-copy"><h2>{stage.name}</h2><strong>{stage.status}</strong><p>{stage.detail}</p></div>
      {index < stages.length - 1 && <ChevronRight className="stage-arrow" size={17} />}
    </article>; })}
  </section>;
}

function FinalApprovalPanel({ snapshot, busy, onApprove, onCreateFollowUp }: {
  snapshot: DemoSnapshot;
  busy: boolean;
  onApprove: (id: string) => void;
  onCreateFollowUp: (input: FollowUpCampaignInput) => void;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const candidates = snapshot.runs.filter((run) => run.generation === snapshot.currentGeneration && run.status === "completed" && run.result);
  const [parentRunId, setParentRunId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [parameters, setParameters] = useState<CampaignParameters>({
    epeMaximumNm: 3,
    pvBandMaximumNm: 10,
    processWindowMinimum: 85,
    maskBiasNm: 1.5,
    fragmentLimit: 240,
    candidateCount: 3,
  });
  const bestScore = candidates.length ? Math.max(...candidates.map((run) => opcScore(run.result!, run.baseline))) : null;
  const openBuilder = () => {
    setParentRunId(snapshot.finalApproval?.runId ?? candidates[0]?.id ?? "");
    setCampaignName(`Generation ${snapshot.currentGeneration + 1} Refinement`);
    setBuilderOpen(true);
  };
  const updateNumber = (key: keyof CampaignParameters, value: string) => {
    setParameters((current) => ({ ...current, [key]: Number(value) }));
  };
  return <section className="panel final-approval-panel">
    <div className="panel-title"><div><h2>Final Approval <span className="inline-generation">GEN {snapshot.currentGeneration}</span></h2><p>Pareto候補を比較し、次工程へ引き渡すチェックポイントを人が最終承認します。</p></div><UserCheck size={20} /></div>
    {!candidates.length && <div className="approval-waiting"><Clock3 size={20} /><span>Azure HPC Jobsの完了後に候補が表示されます。</span></div>}
    {!!candidates.length && <div className="final-candidate-list">{candidates.map((run) => {
      const score = opcScore(run.result!, run.baseline);
      const selected = snapshot.finalApproval?.runId === run.id;
      return <article className={selected ? "selected" : ""} key={run.id}>
        <div><span>{run.id}</span><strong>{run.name}</strong></div>
        <div className="candidate-score"><span>OPC score</span><strong>{score}</strong>{score === bestScore && <small>推奨</small>}</div>
        <button disabled={busy || !!snapshot.finalApproval} onClick={() => onApprove(run.id)}>
          {selected ? <><BadgeCheck size={16} />承認済み</> : <><UserCheck size={16} />最終承認</>}
        </button>
      </article>;
    })}</div>}
    {snapshot.finalApproval && <div className="approval-checkpoint"><p className="final-approval-meta"><ShieldCheck size={15} />{snapshot.finalApproval.approvedBy} · {new Date(snapshot.finalApproval.approvedAt).toLocaleString("ja-JP")}</p>{!builderOpen && <button className="next-campaign-button" disabled={busy} onClick={openBuilder}><Plus size={17} />次の探索を作成</button>}</div>}
    {builderOpen && <div className="campaign-builder">
      <div className="builder-heading"><div><SlidersHorizontal size={18} /><div><strong>Generation {snapshot.currentGeneration + 1} Campaign</strong><span>承認済みチェックポイントから派生探索を作成</span></div></div><button onClick={() => setBuilderOpen(false)}>閉じる</button></div>
      <div className="campaign-fields">
        <label className="wide-field"><span>Campaign名</span><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} /></label>
        <label className="wide-field"><span>親候補</span><select value={parentRunId} onChange={(event) => setParentRunId(event.target.value)}>{candidates.map((run) => <option key={run.id} value={run.id}>{run.id} · {run.name}</option>)}</select></label>
        <label><span>EPE maximum (nm)</span><input type="number" step="0.1" min="0.1" value={parameters.epeMaximumNm} onChange={(event) => updateNumber("epeMaximumNm", event.target.value)} /></label>
        <label><span>PV Band maximum (nm)</span><input type="number" step="0.1" min="0.1" value={parameters.pvBandMaximumNm} onChange={(event) => updateNumber("pvBandMaximumNm", event.target.value)} /></label>
        <label><span>Process window minimum</span><input type="number" step="1" min="1" max="100" value={parameters.processWindowMinimum} onChange={(event) => updateNumber("processWindowMinimum", event.target.value)} /></label>
        <label><span>Mask bias (nm)</span><input type="number" step="0.1" value={parameters.maskBiasNm} onChange={(event) => updateNumber("maskBiasNm", event.target.value)} /></label>
        <label><span>Fragment limit</span><input type="number" step="10" min="50" max="1000" value={parameters.fragmentLimit} onChange={(event) => updateNumber("fragmentLimit", event.target.value)} /></label>
        <label><span>Candidate count</span><input type="number" min="3" max="6" value={parameters.candidateCount} onChange={(event) => updateNumber("candidateCount", event.target.value)} /></label>
      </div>
      <div className="builder-footer"><p><GitBranch size={15} />親Runとパラメータ、世代関係を監査チェーンへ記録します。</p><button disabled={busy || !parentRunId || !campaignName.trim()} onClick={() => onCreateFollowUp({ parentRunId, name: campaignName, parameters })}><Play size={16} />Campaignを作成</button></div>
    </div>}
  </section>;
}

export default function EdaDashboard() {
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [view, setView] = useState<View>("runs");
  const [busyRun, setBusyRun] = useState<string | null>(null);
  const [busyFinalApproval, setBusyFinalApproval] = useState(false);
  const [busyFollowUp, setBusyFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const update = async () => { try { const next = await readSnapshot(); if (active) setSnapshot(next); } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "状態取得に失敗しました。"); } };
    update(); const timer = window.setInterval(update, 900);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function approve(runId: string) {
    setBusyRun(runId); setError(null);
    const response = await fetch("/api/demo/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, actor: "Yuki Sato / Silicon Lead" }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "承認に失敗しました。"); else setSnapshot(result);
    setBusyRun(null);
  }

  async function reset() {
    const response = await fetch("/api/demo/reset", { method: "POST" });
    setSnapshot(await response.json()); setView("runs"); setError(null);
  }

  async function approveFinal(runId: string) {
    setBusyFinalApproval(true); setError(null);
    const response = await fetch("/api/demo/final-approval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, actor: "Yuki Sato / Silicon Lead" }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "最終承認に失敗しました。"); else setSnapshot(result);
    setBusyFinalApproval(false);
  }

  async function createFollowUp(input: FollowUpCampaignInput) {
    setBusyFollowUp(true); setError(null);
    const response = await fetch("/api/demo/follow-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, actor: "Yuki Sato / Silicon Lead" }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "次の探索の作成に失敗しました。"); else setSnapshot(result);
    setBusyFollowUp(false);
  }

  if (!snapshot) return <div className="loading-screen"><WaferMark /><span>EDA intelligenceを準備中...</span></div>;
  const currentRuns = snapshot.runs.filter((run) => run.generation === snapshot.currentGeneration);
  const completed = snapshot.runs.filter((run) => run.status === "completed").length;
  const active = currentRuns.filter((run) => run.status === "queued" || run.status === "running").length;

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><WaferMark /><div><strong>OPC IQ Orchestrator</strong><span>Azure Lithography Optimization Lab</span></div></div><div className="top-actions"><span className="environment"><span /> DEMO / JAPAN EAST</span><a className="icon-button" href="/api/mcp" title="MCP endpoint"><Network size={18} /></a><button className="icon-button" onClick={reset} title="デモをリセット"><RefreshCw size={18} /></button><div className="avatar">YS</div></div></header>
    <main>
      <section className="command-header"><div><p className="eyebrow">AI-GUIDED OPC RECIPE EXPLORATION</p><h1>OPC Simulation Portal (Azure EDA + Data/AI で解析を効率化)</h1><p>Work IQ、Fabric IQ、Foundry IQが根拠を統合。人が承認した候補だけをAzureの疑似Proteusへ投入します。</p></div><div className="objective"><span>OPC objective</span><strong>EPE p95 ≤ 3.0 nm</strong><strong>PV Band ≤ 10.0 nm</strong></div></section>
      <section className="iq-grid">{(Object.keys(iqMeta) as IQSource[]).map((source) => { const meta = iqMeta[source]; const Icon = meta.icon; return <article className={`iq-card iq-${meta.tone}`} key={source}><div className="iq-icon"><Icon size={20} /></div><div><strong>{source}</strong><span>{meta.detail}</span></div><span className="connected"><Check size={12} /> connected</span></article>; })}</section>
      <section className="summary-strip"><div><Bot size={18} /><span>Adaptive campaign</span><strong>GEN {snapshot.currentGeneration} / {currentRuns.length} runs</strong></div><div><Play size={18} /><span>Azure VM jobs</span><strong>{active}</strong></div><div><Clock3 size={18} /><span>Baseline runtime</span><strong>94 min / run</strong></div><div><ShieldCheck size={18} /><span>Audit chain</span><strong className={snapshot.auditChainValid ? "verified" : "invalid"}>{snapshot.auditChainValid ? "Verified" : "Invalid"}</strong></div></section>
      <section className="cloud-value-strip"><div><span>Exploration model</span><strong>Adaptive, not exhaustive</strong></div><div><span>Compute evolution</span><strong>1 VM → CycleCloud Slurm</strong></div><div><span>Data plane</span><strong>Fabric OneLake lineage</strong></div><div><span>Expected outcome</span><strong>Fewer runs, faster decisions</strong></div></section>
      <OpcWorkflow snapshot={snapshot} />
      <nav className="view-tabs" aria-label="デモ表示"><button className={view === "runs" ? "active" : ""} onClick={() => setView("runs")}><CircleGauge size={17} /> Run control</button><button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}><Activity size={17} /> OPC comparison <span>{completed}</span></button><button className={view === "audit" ? "active" : ""} onClick={() => setView("audit")}><History size={17} /> Audit trail <span>{snapshot.auditEvents.length}</span></button></nav>
      {error && <div className="error-banner">{error}</div>}
      {view === "runs" && <><FinalApprovalPanel key={snapshot.currentGeneration} snapshot={snapshot} busy={busyFinalApproval || busyFollowUp} onApprove={approveFinal} onCreateFollowUp={createFollowUp} /><div className="workspace-grid"><section className="panel run-panel"><div className="panel-title"><div><h2>Campaign launch approval <span className="inline-generation">GEN {snapshot.currentGeneration}</span></h2><p>OPCレシピと予測根拠を確認し、Azure VMへ投入する前段承認です。</p></div><span>{currentRuns.filter((run) => run.status === "awaiting_approval").length} pending</span></div><div className="run-list">{currentRuns.map((run) => <RunCard key={run.id} run={run} busy={busyRun === run.id} onApprove={approve} />)}</div></section>
        <aside className="panel evidence-panel"><div className="panel-title"><div><h2>Grounding evidence</h2><p>エージェントが判断に使用した根拠</p></div><Fingerprint size={20} /></div><div className="evidence-list">{currentRuns[0].evidence.map((evidence) => { const meta = iqMeta[evidence.source]; const Icon = meta.icon; return <article key={evidence.source}><div className={`source-icon iq-${meta.tone}`}><Icon size={17} /></div><div><strong>{evidence.title}</strong><span className="source-name">{evidence.source}</span><p>{evidence.detail}</p><small>{evidence.citation} <ExternalLink size={11} /></small></div></article>; })}</div><div className="guardrail"><ShieldCheck size={20} /><div><strong>Protected compute boundary</strong><p>GDS、PDK、mask contour、ライセンス情報をLLMやWeb検索へ送信しません。</p></div></div></aside></div></>}
      {view === "compare" && <section className="panel"><div className="panel-title"><div><h2>OPC candidate comparison</h2><p>画像忠実度、process window、欠陥リスク、time-to-result、コストを同時評価</p></div><CircleGauge size={21} /></div><CompareView runs={snapshot.runs} /></section>}
      {view === "audit" && <section className="panel"><div className="panel-title"><div><h2>Immutable audit trail</h2><p>各イベントは直前のSHA-256ハッシュを含み、改ざんを検知します。</p></div><span className={snapshot.auditChainValid ? "chain-ok" : "chain-bad"}><ShieldCheck size={15} /> {snapshot.auditChainValid ? "Chain verified" : "Chain invalid"}</span></div><div className="audit-list">{[...snapshot.auditEvents].reverse().map((event) => <article key={event.id}><div className="audit-line"><span /></div><div className="audit-time">{new Date(event.timestamp).toLocaleTimeString("ja-JP")}</div><div className="audit-body"><div><strong>{event.action.replaceAll("_", " ")}</strong><span>{event.actor}</span></div><p>{event.detail}</p><small>{event.target} · hash {event.hash.slice(0, 12)}…</small></div><ChevronRight size={16} /></article>)}</div></section>}
    </main>
    <footer><span>Synthetic OPC demo</span><span>Synopsys software, GDS, mask data, PDK and production data are not used.</span><a href="/api/mcp">MCP endpoint <ChevronRight size={12} /></a></footer>
  </div>;
}
