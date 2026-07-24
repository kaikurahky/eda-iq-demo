import { approveDemoRun, getSnapshot } from "@/lib/demo-store";
import { dispatchOpcJob } from "@/lib/job-dispatch";

export async function POST(request: Request) {
  const body = (await request.json()) as { runId?: string; actor?: string };
  if (!body.runId || !body.actor) {
    return Response.json({ error: "runIdとactorは必須です。" }, { status: 400 });
  }

  try {
    const run = getSnapshot().runs.find((candidate) => candidate.id === body.runId);
    if (!run || run.status !== "awaiting_approval") {
      return Response.json({ error: "承認待ちのRunが見つかりません。" }, { status: 409 });
    }
    await dispatchOpcJob(run);
    return Response.json(approveDemoRun(body.runId, body.actor));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "承認に失敗しました。" },
      { status: 409 },
    );
  }
}