import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const traces = await db.trace.findMany({
    where: { agentId: id },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ traces });
}
