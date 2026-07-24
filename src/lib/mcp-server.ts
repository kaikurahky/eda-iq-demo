import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { approveDemoRun, getSnapshot } from "@/lib/demo-store";
import { opcScore } from "@/lib/eda-domain";

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function createServer() {
  const server = new McpServer({ name: "eda-iq-demo", version: "0.1.0" });

  server.registerTool("list_opc_runs", {
    title: "List OPC runs",
    description: "疑似Proteus OPC Runと承認・実行状態を一覧します。",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => text(getSnapshot().runs));

  server.registerTool("approve_opc_run", {
    title: "Approve OPC run",
    description: "設計者の明示承認を記録し、型付きOPC RunをQueueへ投入します。",
    inputSchema: z.object({
      runId: z.string().describe("RUN-0101形式のRun ID"),
      actor: z.string().describe("承認者の表示名またはUPN"),
    }),
    annotations: { destructiveHint: false, idempotentHint: false },
  }, async ({ runId, actor }) => text(approveDemoRun(runId, actor)));

  server.registerTool("compare_completed_runs", {
    title: "Compare completed runs",
    description: "完了したRunのEPE、PV Band、process window、実行時間、コストを比較します。",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => {
    const completed = getSnapshot().runs
      .filter((run) => run.result)
      .map((run) => ({
        id: run.id,
        name: run.name,
        metrics: run.result,
        score: opcScore(run.result!, run.baseline),
      }));
    return text(completed);
  });

  server.registerTool("read_audit_log", {
    title: "Read audit log",
    description: "承認と実行履歴、および監査ハッシュチェーンの検証状態を返します。",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => {
    const snapshot = getSnapshot();
    return text({ valid: snapshot.auditChainValid, events: snapshot.auditEvents });
  });

  return server;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}