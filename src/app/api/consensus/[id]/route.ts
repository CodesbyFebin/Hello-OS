import { NextResponse } from "next/server";
import { argue, closeDebate, vote } from "@/lib/consensus";
import { checkFields, guardWrite } from "@/lib/guard";

// POST { op: "argue", agentId, stance, text } | { op: "vote", agentId, stance } | { op: "close" }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardWrite(req, { bucket: "consensus", agents: (b) => (b.op === "close" ? [] : [String(b.agentId ?? "")]) });
  if (!g.ok) return g.response;
  const bad = checkFields(g.json, { text: { maxLen: 5000 } });
  if (bad) return bad;
  const { id } = await params;
  const b = g.json;
  try {
    if (b.op === "argue") return NextResponse.json({ argument: await argue(id, String(b.agentId ?? ""), b.stance, String(b.text ?? "")) });
    if (b.op === "vote") return NextResponse.json({ vote: await vote(id, String(b.agentId ?? ""), b.stance) });
    if (b.op === "close") return NextResponse.json({ debate: await closeDebate(id) });
    return NextResponse.json({ error: "op must be argue, vote or close" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: msg.includes("Unique constraint") ? "agent already voted" : msg }, { status: 409 });
  }
}
