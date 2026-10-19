import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openDebate } from "@/lib/consensus";

export async function GET() {
  const debates = await db.debate.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { arguments: { orderBy: { createdAt: "asc" } }, votes: true } });
  return NextResponse.json({ debates });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try { return NextResponse.json({ debate: await openDebate(String(b.proposerId ?? ""), String(b.topic ?? ""), Number(b.quorumWeight ?? 100)) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 }); }
}