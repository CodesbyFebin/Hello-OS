import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { operatorAllowed } from "@/lib/operator-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!operatorAllowed(req)) return NextResponse.json({ error: "operator token required" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: { enabled?: boolean; nextRunAt?: Date } = {};
  if (typeof b.enabled === "boolean") data.enabled = b.enabled;
  if (b.runNow === true) data.nextRunAt = new Date();
  const job = await db.scheduledJob.update({ where: { id }, data }).catch(() => null);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!operatorAllowed(req)) return NextResponse.json({ error: "operator token required" }, { status: 401 });
  const { id } = await params;
  await db.scheduledJob.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
