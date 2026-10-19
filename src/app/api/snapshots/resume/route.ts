import { NextResponse } from "next/server";
import { resumeSnapshot } from "@/lib/snapshots";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.snapshot || typeof b.sha256 !== "string") return NextResponse.json({ error: "expected { snapshot, sha256 }" }, { status: 400 });
  const r = await resumeSnapshot(b.snapshot, b.sha256);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
