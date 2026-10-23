import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { delegate, tree } from "@/lib/delegation";
import { checkFields, guardWrite } from "@/lib/guard";

// GET ?root=<agentId> returns the delegation tree; without root, lists roots (agents that delegate but aren't delegated to).
export async function GET(req: Request) {
  const root = new URL(req.url).searchParams.get("root");
  if (root) return NextResponse.json({ tree: await tree(root) });
  const all = await db.delegation.findMany({ select: { parentId: true, childId: true } });
  const children = new Set(all.map((d) => d.childId));
  const roots = [...new Set(all.map((d) => d.parentId))].filter((p) => !children.has(p));
  return NextResponse.json({ trees: await Promise.all(roots.map((r) => tree(r))) });
}

export async function POST(req: Request) {
  const g = await guardWrite(req, { bucket: "delegation", agents: (b) => [String(b.parentId ?? "")] });
  if (!g.ok) return g.response;
  const bad = checkFields(g.json, { childName: { maxLen: 60 }, task: { maxLen: 300 }, creditCap: { min: 0, max: 1_000_000 } });
  if (bad) return bad;
  const b = g.json;
  if (!b.parentId) return NextResponse.json({ error: "parentId required" }, { status: 400 });
  const r = await delegate(String(b.parentId), { childName: b.childName ? String(b.childName) : undefined, childId: b.childId ? String(b.childId) : undefined, creditCap: Number(b.creditCap), task: b.task ? String(b.task) : "" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
