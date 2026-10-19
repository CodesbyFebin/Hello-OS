import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gate } from "@/lib/gate";
import { installSkill } from "@/lib/skills";

// Install (graft) a skill onto an agent. Passes through the approval gate first.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agentId } = await req.json().catch(() => ({}));
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  const skill = await db.skill.findUnique({ where: { id } });
  if (!skill) return NextResponse.json({ error: "skill not found" }, { status: 404 });

  const g = await gate(String(agentId), "skill.install", skill.price, { agentId, skillId: id });
  if (g.decision === "blocked") return NextResponse.json({ error: g.reason, tier: g.tier }, { status: 423 });
  if (g.decision === "pending") return NextResponse.json({ status: "pending_approval", approvalId: g.approvalId, tier: g.tier }, { status: 202 });

  const r = await installSkill(String(agentId), id);
  if (!r.ok) return NextResponse.json({ error: r.error, wallet: "wallet" in r ? r.wallet : undefined }, { status: r.status });
  return NextResponse.json({ installation: r.installation, wallet: r.wallet, tier: g.tier });
}
