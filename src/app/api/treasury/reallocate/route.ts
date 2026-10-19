import { NextResponse } from "next/server";
import { requestReallocation } from "@/lib/treasury";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.fromAgentId || !b.toAgentId) return NextResponse.json({ error: "fromAgentId and toAgentId required" }, { status: 400 });
  const r = await requestReallocation(String(b.fromAgentId), String(b.toAgentId), Number(b.amount), String(b.reason ?? "").slice(0, 120));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r, { status: r.status });
}
