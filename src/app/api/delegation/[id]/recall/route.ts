import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { recall } from "@/lib/delegation";
import { guardWrite } from "@/lib/guard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardWrite(req, { bucket: "delegation", agents: async () => { const d = await db.delegation.findUnique({ where: { id }, select: { parentId: true } }); return d ? [d.parentId] : []; } });
  if (!g.ok) return g.response;
  const r = await recall(id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
