import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { operatorAuth } from "@/lib/operator-auth";

export const dynamic = "force-dynamic";

/** Operator (or local dev mode) sees full entries; everyone else gets a redacted view without `detail`. */
export async function GET(req: Request) {
  const full = operatorAuth(req).ok;
  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" }, take: 100,
    ...(full ? {} : { select: { id: true, actor: true, action: true, target: true, createdAt: true } }),
  });
  return NextResponse.json({ entries, redacted: !full });
}
