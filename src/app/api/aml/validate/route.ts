import { NextResponse } from "next/server";
import { compileAml } from "@/lib/aml";

const MAX_BODY_BYTES = 64_000;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "AML source exceeds the 64 KB request limit." }, { status: 413 });
  }

  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "AML request exceeds the 64 KB request limit." }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  } finally {
    reader.releaseLock();
  }

  let body: unknown;
  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof (body as { source?: unknown }).source !== "string") {
    return NextResponse.json({ error: "Expected JSON with a string 'source' field." }, { status: 400 });
  }

  const result = compileAml((body as { source: string }).source);
  return NextResponse.json({
    valid: result.ok,
    executable: false,
    programHash: `0x${result.sourceSha256}`,
    diagnostics: result.diagnostics,
    graph: result.graph,
    requiredCapabilities: result.requiredCapabilities,
  }, { status: result.ok ? 200 : 422 });
}
