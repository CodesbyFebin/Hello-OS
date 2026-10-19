import { NextResponse } from "next/server";
import { search } from "@/lib/knowledge";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const agentId = sp.get("agentId"); const q = sp.get("q");
  if (!agentId || !q) return NextResponse.json({ error: "agentId and q required" }, { status: 400 });
  return NextResponse.json(await search(agentId, q.slice(0, 2000)));
}
