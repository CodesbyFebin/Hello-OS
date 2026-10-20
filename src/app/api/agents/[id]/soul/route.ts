import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";

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
  const soul = {
    agentId: id,
    version,
    personality: personality ?? latest?.personality ?? "",
    values: values ?? latest?.values ?? "",
    charter: charter ?? latest?.charter ?? "",
  };
  // Content hash: sha256 of the canonical (key-sorted) soul JSON, so the same
  // soul content always yields the same hash and any edit changes it.
  const canonical = JSON.stringify(soul, Object.keys(soul).sort());
  const created = await db.soulVersion.create({
    data: { ...soul, hash: createHash("sha256").update(canonical).digest("hex") },
  });
  return NextResponse.json({ soul: created });
}
