import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versions = await db.soulVersion.findMany({
    where: { agentId: id },
    orderBy: { version: "asc" },
  });
  return NextResponse.json({ versions });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { personality, values, charter } = body;
  const latest = await db.soulVersion.findFirst({
    where: { agentId: id },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;
  const created = await db.soulVersion.create({
    data: {
      agentId: id,
      version,
      personality: personality ?? latest?.personality ?? "",
      values: values ?? latest?.values ?? "",
      charter: charter ?? latest?.charter ?? "",
      hash: Math.random().toString(16).slice(2, 18),
    },
  });
  return NextResponse.json({ soul: created });
}
