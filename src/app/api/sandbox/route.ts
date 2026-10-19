import { NextResponse } from "next/server";
import { LIMITS, runSnippet } from "@/lib/sandbox";
import { operatorAllowed } from "@/lib/operator-auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ engine: "quickjs-emscripten@0.32.0 (WebAssembly)", limits: LIMITS, exposed: ["console.log"] });
}

export async function POST(req: Request) {
  // Running code costs CPU; require the operator token when one is configured.
  if (!operatorAllowed(req)) return NextResponse.json({ error: "operator token required" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.code !== "string" || !b.code) return NextResponse.json({ error: "code (string) required" }, { status: 400 });
  return NextResponse.json(await runSnippet(b.code, { timeoutMs: b.timeoutMs, memoryBytes: b.memoryBytes }));
}
