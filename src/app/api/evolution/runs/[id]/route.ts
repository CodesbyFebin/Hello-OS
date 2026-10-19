import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await db.evolutionRun.findUnique({
    where: { id },
    include: { generations: { orderBy: { generation: "desc" }, take: 50 } },
  });
  if (!run) return NextResponse.json({ error: "Evolution run not found." }, { status: 404 });
  return NextResponse.json({ run });
}
