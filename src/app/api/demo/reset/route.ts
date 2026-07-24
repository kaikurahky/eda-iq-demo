import { resetDemo } from "@/lib/demo-store";

export async function POST() {
  return Response.json(resetDemo());
}