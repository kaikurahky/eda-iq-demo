import { applyOpcResults, getSnapshot } from "@/lib/demo-store";
import { fetchOpcResults } from "@/lib/job-dispatch";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = getSnapshot();
  const activeRuns = snapshot.runs.filter((run) => run.status === "queued" || run.status === "running");
  const results = await fetchOpcResults(activeRuns);
  return Response.json(applyOpcResults(results), {
    headers: { "Cache-Control": "no-store" },
  });
}