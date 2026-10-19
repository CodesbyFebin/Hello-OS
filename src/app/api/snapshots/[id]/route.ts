import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Export: the portable document plus its seal.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.agentSnapshot.findUnique({ where: { id } });
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ sha256: s.sha256, snapshot: JSON.parse(s.json) });
}
