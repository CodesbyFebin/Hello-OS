import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { guardWrite, idempotent, principalScope } from "@/lib/guard";

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
  const g = await guardWrite(req, { bucket: "soul", agents: [id] });
  if (!g.ok) return g.response;
  return idempotent(req, `soul:${id}:${principalScope(g.principal)}`, g.text, async () => {
  const { personality, values, charter } = g.json;
  for (const [k, v] of Object.entries({ personality, values, charter })) {
    if (v !== undefined && (typeof v !== "string" || v.length > 10_000)) return NextResponse.json({ error: `${k} must be a string of at most 10000 characters` }, { status: 400 });
  }
  if (!(await db.agent.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "agent not found" }, { status: 404 });
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
  });
}
