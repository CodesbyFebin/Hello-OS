import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const moves = await db.transaction.findMany({ where: { reason: { startsWith: "treasury:reallocate:" } }, orderBy: { createdAt: "desc" }, take: 50 });
  const pending = await db.actionApproval.count({ where: { action: "treasury.reallocate", status: "pending" } });
  return NextResponse.json({ moves, pending });
}
