import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { operatorAuth } from "@/lib/operator-auth";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const approvals = await db.actionApproval.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100 });
  // Payloads (amounts, reasons, targets) are operator-only.
  const full = operatorAuth(req).ok;
  return NextResponse.json({ approvals: full ? approvals : approvals.map((a) => ({ ...a, payload: "[redacted]", note: a.note ? "[redacted]" : a.note })), redacted: !full });
}
