import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Recorded evaluation runs (task results, not gene-vector simulation). Outputs are stored only as hashes. */
export async function GET() {
  const runs = await db.evalRun.findMany({
    orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, suiteId: true, suiteVersion: true, suiteHash: true, fingerprint: true, candidateId: true, revision: true, promptVersion: true, provider: true, model: true, requiredPassed: true, requiredTotal: true, safetyViolations: true, summaryJson: true, createdAt: true },
  });
  return NextResponse.json({ runs: runs.map(({ summaryJson, ...r }) => ({ ...r, summary: JSON.parse(summaryJson) })) });
}
