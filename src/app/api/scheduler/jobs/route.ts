import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { JOB_KINDS } from "@/lib/scheduler";
import { operatorAllowed } from "@/lib/operator-auth";

export async function GET() {
  const jobs = await db.scheduledJob.findMany({ orderBy: { createdAt: "asc" }, include: { runs: { orderBy: { createdAt: "desc" }, take: 3 } } });
  return NextResponse.json({ jobs, kinds: JOB_KINDS });
}

export async function POST(req: Request) {
  if (!operatorAllowed(req)) return NextResponse.json({ error: "operator token required" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!JOB_KINDS.includes(b.kind)) return NextResponse.json({ error: `kind must be one of ${JOB_KINDS.join(", ")}` }, { status: 400 });
  const intervalSec = Math.round(Number(b.intervalSec ?? 3600));
  if (!Number.isFinite(intervalSec) || intervalSec < 10 || intervalSec > 30 * 86400) return NextResponse.json({ error: "intervalSec must be 10..2592000" }, { status: 400 });
  const job = await db.scheduledJob.create({ data: { name: String(b.name || b.kind).slice(0, 80), kind: b.kind, intervalSec, agentId: b.agentId ? String(b.agentId) : null } });
  return NextResponse.json({ job });
}
