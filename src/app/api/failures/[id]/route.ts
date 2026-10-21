import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardWrite } from "@/lib/guard";

// Record how a failure was resolved; it stops being a dead end.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardWrite(req, { bucket: "operator", operatorOnly: true });
  if (!g.ok) return g.response;
  const { id } = await params;
  const b = g.json;
  const resolution = String(b.resolution ?? "").slice(0, 2000);
  if (!resolution) return NextResponse.json({ error: "resolution required" }, { status: 400 });
  const f = await db.failureRecord.update({ where: { id }, data: { resolution, deadEnd: false } }).catch(() => null);
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ failure: f });
}
