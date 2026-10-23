import { NextResponse } from "next/server";
import { DEFAULT_THRESHOLD, lookup } from "@/lib/semantic-cache";
import { clientKey, rateLimit } from "@/lib/guard";

export async function POST(req: Request) {
  const rl = await rateLimit("cache_lookup", clientKey(req), 300);
  if (!rl.ok) return rl.response;
  const b = await req.json().catch(() => ({}));
  if (typeof b.prompt !== "string" || !b.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  const t = Number(b.threshold ?? DEFAULT_THRESHOLD);
  if (!(t > 0 && t <= 1)) return NextResponse.json({ error: "threshold must be in (0, 1]" }, { status: 400 });
  return NextResponse.json(await lookup(b.prompt.slice(0, 8000), typeof b.scope === "string" ? b.scope.slice(0, 60) : "global", t));
}