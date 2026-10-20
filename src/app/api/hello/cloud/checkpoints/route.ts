import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const records = await db.checkpoint.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, repoId: true, name: true, agentDid: true, receiptHash: true, createdAt: true },
  });
  const checkpoints = records.map((record) => ({ ...record, status: "recorded" }));
  return NextResponse.json({ checkpoints });
}
