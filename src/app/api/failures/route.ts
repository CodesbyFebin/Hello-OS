import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingest } from "@/lib/failures";
import { guardWrite } from "@/lib/guard";

export async function GET() {
  const failures = await db.failureRecord.findMany({ orderBy: [{ count: "desc" }, { lastSeen: "desc" }], take: 100 });
  return NextResponse.json({ failures, deadEnds: failures.filter((f) => f.deadEnd).length });
}

// Ingest a raw build/test log (e.g. `npx tsc --noEmit | curl -d @- ...`).
export async function POST(req: Request) {
  const g = await guardWrite(req, { bucket: "operator", operatorOnly: true, maxBytes: 600 * 1024 });
  if (!g.ok) return g.response;
  const b = g.json;
  if (typeof b.log !== "string" || !b.log) return NextResponse.json({ error: "log (string) required" }, { status: 400 });
  if (b.log.length > 500_000) return NextResponse.json({ error: "log too large (500 KB max)" }, { status: 413 });
  const parsed = await ingest(b.log, ["build", "test", "runtime"].includes(b.source) ? b.source : "build");
  return NextResponse.json({ ingested: parsed.length, signatures: parsed.map((p) => p.signature) });
}
