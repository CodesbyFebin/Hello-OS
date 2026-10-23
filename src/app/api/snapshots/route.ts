import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSnapshot } from "@/lib/snapshots";
import { checkFields, guardWrite } from "@/lib/guard";

export async function GET() {
  const snapshots = await db.agentSnapshot.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, agentId: true, label: true, sha256: true, createdAt: true, resumedAt: true } });
  return NextResponse.json({ snapshots });
}

export async function POST(req: Request) {
  const g = await guardWrite(req, { bucket: "snapshots", agents: (b) => [String(b.agentId ?? "")] });
  if (!g.ok) return g.response;
  const bad = checkFields(g.json, { label: { maxLen: 120 } });
  if (bad) return bad;
  const b = g.json;
  if (!b.agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  if (JSON.stringify(b.task ?? null).length > 20000) return NextResponse.json({ error: "task state too large (20 KB max)" }, { status: 413 });
  const s = await createSnapshot(String(b.agentId), b.task, String(b.label ?? ""));
  if (!s) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  return NextResponse.json(s);
}
