import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const agentId = searchParams.get("agentId");
  const golden = searchParams.get("golden");

  const traces = await db.trace.findMany({
    where: {
      AND: [
        status ? { status } : {},
        agentId ? { agentId } : {},
        golden === "true" ? { goldenSet: true } : {},
      ],
    },
    orderBy: { startedAt: "desc" },
    take: 80,
    include: { agent: { select: { id: true, name: true, did: true, avatar: true, guardianTier: true } } },
  });
  return NextResponse.json({ traces });
}
