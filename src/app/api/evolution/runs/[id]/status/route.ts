import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (body.action !== "pause" && body.action !== "resume") {
    return NextResponse.json({ error: "Action must be pause or resume." }, { status: 400 });
  }
  const from = body.action === "pause" ? "active" : "paused";
  const to = body.action === "pause" ? "paused" : "active";
  const changed = await db.evolutionRun.updateMany({
    where: { id, status: from },
    data: { status: to },
  });
  if (changed.count !== 1) {
    const current = await db.evolutionRun.findUnique({ where: { id }, select: { status: true } });
    if (!current) return NextResponse.json({ error: "Evolution run not found." }, { status: 404 });
    return NextResponse.json({ error: `Cannot ${body.action} a run that is ${current.status}.` }, { status: 409 });
  }
  return NextResponse.json({ run: await db.evolutionRun.findUnique({ where: { id } }) });
}
