import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: {
      guild: true,
      parent: { select: { id: true, name: true, did: true, avatar: true } },
      children: { select: { id: true, name: true, did: true, avatar: true, guardianTier: true } },
      wallet: { include: { transactions: { take: 12, orderBy: { createdAt: "desc" } } } },
      soulVersions: { orderBy: { version: "desc" } },
      _count: {
        select: {
          memories: true,
          tracesAuthored: true,
          skillsAuthored: true,
          skillsInstalled: true,
          missionsPosted: true,
          missionsTaken: true,
        },
      },
    },
  });
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ agent });
}
