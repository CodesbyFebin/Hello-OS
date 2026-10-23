import { NextResponse } from "next/server";
import { resumeSnapshot } from "@/lib/snapshots";
import { guardWrite } from "@/lib/guard";

export async function POST(req: Request) {
  const g = await guardWrite(req, { bucket: "operator", operatorOnly: true });
  if (!g.ok) return g.response;
  const b = g.json;
  if (!b.snapshot || typeof b.sha256 !== "string") return NextResponse.json({ error: "expected { snapshot, sha256 }" }, { status: 400 });
  const r = await resumeSnapshot(b.snapshot, b.sha256);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
