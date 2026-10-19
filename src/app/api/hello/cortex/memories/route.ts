import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const memories = await db.cortexMemory.findMany({
    where: kind ? { kind } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const byKind: Record<string, number> = {};
  for (const m of memories) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
  return NextResponse.json({ memories, byKind });
}
