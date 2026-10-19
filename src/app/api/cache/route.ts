import { NextResponse } from "next/server";
import { stats, store } from "@/lib/semantic-cache";

// Stats are counted from logged lookups; measuredHitRate is null until there are lookups.
export async function GET() {
  return NextResponse.json(await stats());
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.prompt !== "string" || typeof b.response !== "string" || !b.prompt) return NextResponse.json({ error: "prompt and response strings required" }, { status: 400 });
  const e = await store(b.prompt, b.response, typeof b.scope === "string" ? b.scope.slice(0, 60) : "global");
  return NextResponse.json({ id: e.id });
}