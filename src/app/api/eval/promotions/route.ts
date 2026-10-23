import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promotionAuthorized } from "@/lib/eval/auth";
import { requestPromotion } from "@/lib/eval/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const promotions = await db.evalPromotion.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ promotions });
}

/** Request promotion of a recorded run. Creates a pending (eligible) or blocked request; never promotes by itself. */
export async function POST(req: Request) {
  if (!promotionAuthorized(req)) return NextResponse.json({ error: "operator token required (HELLO_OPERATOR_TOKEN must be set)" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const runId = typeof body?.runId === "string" ? body.runId.slice(0, 64) : "";
  const requestedBy = typeof body?.requestedBy === "string" ? body.requestedBy.trim().slice(0, 80) : "";
  if (!runId || !requestedBy) return NextResponse.json({ error: "runId and requestedBy are required" }, { status: 400 });
  const r = await requestPromotion(runId, requestedBy);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r, { status: 201 });
}
