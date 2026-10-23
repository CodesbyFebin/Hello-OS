import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { operatorAuth, operatorDenied } from "@/lib/operator-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = operatorAuth(req); if (!op.ok) return operatorDenied(op);
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
  const op = operatorAuth(req); if (!op.ok) return operatorDenied(op);
  const { id } = await params;
  await db.scheduledJob.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
