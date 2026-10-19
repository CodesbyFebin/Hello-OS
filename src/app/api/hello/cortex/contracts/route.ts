import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const contracts = await db.contractLock.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ contracts });
}
