import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const txns = await db.transaction.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: { wallet: { include: { agent: { select: { name: true, did: true, avatar: true } } } } },
  });
  return NextResponse.json({ transactions: txns });
}
