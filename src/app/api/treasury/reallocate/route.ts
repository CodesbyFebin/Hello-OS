import { NextResponse } from "next/server";
import { requestReallocation } from "@/lib/treasury";
import { checkFields, guardWrite } from "@/lib/guard";

export async function POST(req: Request) {
  const g = await guardWrite(req, { bucket: "treasury", agents: (b) => [String(b.fromAgentId ?? "")] });
  if (!g.ok) return g.response;
  const bad = checkFields(g.json, { amount: { min: 0, max: 1_000_000 } });
  if (bad) return bad;
  const b = g.json;
  if (!b.fromAgentId || !b.toAgentId) return NextResponse.json({ error: "fromAgentId and toAgentId required" }, { status: 400 });
  const r = await requestReallocation(String(b.fromAgentId), String(b.toAgentId), Number(b.amount), String(b.reason ?? "").slice(0, 120));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r, { status: r.status });
}
