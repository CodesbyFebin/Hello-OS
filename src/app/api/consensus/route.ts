import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openDebate } from "@/lib/consensus";
import { checkFields, guardWrite } from "@/lib/guard";

export async function GET() {
  const debates = await db.debate.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { arguments: { orderBy: { createdAt: "asc" } }, votes: true } });
  return NextResponse.json({ debates });
}

export async function POST(req: Request) {
  const g = await guardWrite(req, { bucket: "consensus", agents: (b) => [String(b.proposerId ?? "")] });
  if (!g.ok) return g.response;
  const bad = checkFields(g.json, { topic: { maxLen: 300 }, quorumWeight: { min: 1, max: 1_000_000 } });
  if (bad) return bad;
  const b = g.json;
  try { return NextResponse.json({ debate: await openDebate(String(b.proposerId ?? ""), String(b.topic ?? ""), Number(b.quorumWeight ?? 100)) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 }); }
}
