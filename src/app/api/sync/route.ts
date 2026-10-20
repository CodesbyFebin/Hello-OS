import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildSnapshot, snapshotStream } from "@/lib/sync";

export const dynamic = "force-dynamic";

// GET /api/sync         → text/event-stream of dashboard snapshots (pushed on change)
// GET /api/sync?once=1  → one JSON snapshot (polling fallback)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("once")) {
    return NextResponse.json(await buildSnapshot(db), { headers: { "Cache-Control": "no-store" } });
  }
  const interval = Math.max(500, Number(process.env.HELLO_SYNC_INTERVAL_MS) || 3000);
  return new Response(snapshotStream(db, req.signal, interval), {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
