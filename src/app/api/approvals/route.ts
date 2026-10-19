import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const approvals = await db.actionApproval.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ approvals });
}
