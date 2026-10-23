import { NextResponse } from "next/server";
import { promotionAuthorized } from "@/lib/eval/auth";
import { decidePromotion, rollbackPromotion } from "@/lib/eval/store";

export const dynamic = "force-dynamic";

/** Human decision on a pending promotion: { decision: "approve"|"reject"|"rollback", approver: "<name>" }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!promotionAuthorized(req)) return NextResponse.json({ error: "operator token required (HELLO_OPERATOR_TOKEN must be set)" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const decision = body?.decision;
  const approver = typeof body?.approver === "string" ? body.approver.slice(0, 80) : "";
  if (decision !== "approve" && decision !== "reject" && decision !== "rollback") return NextResponse.json({ error: "decision must be approve, reject or rollback" }, { status: 400 });
  const r = decision === "rollback" ? await rollbackPromotion(id, approver) : await decidePromotion(id, approver, decision);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
