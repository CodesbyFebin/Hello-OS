import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Record how a failure was resolved; it stops being a dead end.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const resolution = String(b.resolution ?? "").slice(0, 2000);
  if (!resolution) return NextResponse.json({ error: "resolution required" }, { status: 400 });
  const f = await db.failureRecord.update({ where: { id }, data: { resolution, deadEnd: false } }).catch(() => null);
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ failure: f });
}
