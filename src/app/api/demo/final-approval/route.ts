import { approveFinalCandidate } from "@/lib/demo-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { runId?: string; actor?: string };
  if (!body.runId || !body.actor) {
    return Response.json({ error: "runIdとactorは必須です。" }, { status: 400 });
  }

  try {
    return Response.json(approveFinalCandidate(body.runId, body.actor));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "最終承認に失敗しました。" },
      { status: 409 },
    );
  }
}