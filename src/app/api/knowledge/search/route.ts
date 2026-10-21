import { NextResponse } from "next/server";
import { search } from "@/lib/knowledge";
import { authenticate, rateLimit, clientKey } from "@/lib/guard";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const agentId = sp.get("agentId"); const q = sp.get("q");
  if (!agentId || !q) return NextResponse.json({ error: "agentId and q required" }, { status: 400 });
  // Role-scoped results: only the agent itself (signed) or the operator may search as this agent.
  const auth = await authenticate(req, "", [agentId]);
  if (!auth.ok) return auth.response;
  const rl = await rateLimit("search", clientKey(req, auth.principal), 120);
  if (!rl.ok) return rl.response;
  return NextResponse.json(await search(agentId, q.slice(0, 2000)));
}