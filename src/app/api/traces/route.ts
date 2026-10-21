import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { operatorAuth } from "@/lib/operator-auth";

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
  // Public view hides titles (they can describe private tasks); operator / local dev sees everything.
  const full = operatorAuth(req).ok;
  return NextResponse.json({ traces: full ? traces : traces.map((t) => ({ ...t, title: "[redacted]" })), redacted: !full });
}
