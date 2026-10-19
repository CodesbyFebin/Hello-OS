import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spendWallet } from "@/lib/economy";

// Install (graft) a skill onto an agent
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agentId } = await req.json();
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

  const skill = await db.skill.findUnique({ where: { id } });
  if (!skill) return NextResponse.json({ error: "skill not found" }, { status: 404 });

  try {
    const result = await spendWallet(agentId, skill.price, `skill:install:${skill.name}`, undefined, async (tx) => {
      const existing = await tx.skillInstallation.findUnique({ where: { skillId_agentId: { skillId: id, agentId } } });
      if (existing) throw new Error("already installed");
      const installation = await tx.skillInstallation.create({ data: { skillId: id, agentId } });
      await tx.skill.update({ where: { id }, data: { installs: { increment: 1 } } });
      return installation;
    });
    if (!result.ok) return NextResponse.json({ error: result.error, wallet: result.wallet }, { status: result.status });
    return NextResponse.json({ installation: result.extra, wallet: result.wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "install failed";
    return NextResponse.json({ error: message }, { status: message === "already installed" ? 409 : 500 });
  }
}
