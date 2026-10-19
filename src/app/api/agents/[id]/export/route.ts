import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    select: {
      id: true, did: true, name: true, tagline: true, avatar: true, status: true,
      guardianTier: true, parentId: true, reputation: true, publicKeyMultibase: true,
      publicKeyHex: true, keyId: true, createdAt: true, updatedAt: true,
      soulVersions: { orderBy: { version: "asc" } },
      memories: { orderBy: { createdAt: "asc" } },
      wallet: { select: { balance: true, currency: true, spentToday: true, dailyCap: true, circuitOpen: true, transactions: { orderBy: { createdAt: "asc" } } } },
      skillsInstalled: { include: { skill: true } },
      tracesAuthored: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const exportData = {
    format: "hello-agent-export/v1",
    exportedAt: new Date().toISOString(),
    identity: { ...agent, keyCustody: "private signing key is intentionally excluded from export" },
  };
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hello-agent-${agent.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
