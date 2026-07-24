import { createFollowUpCampaign, type FollowUpCampaignInput } from "@/lib/demo-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { input?: FollowUpCampaignInput; actor?: string };
  if (!body.input || !body.actor) {
    return Response.json({ error: "inputとactorは必須です。" }, { status: 400 });
  }

  try {
    return Response.json(createFollowUpCampaign(body.input, body.actor));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "次の探索の作成に失敗しました。" },
      { status: 409 },
    );
  }
}