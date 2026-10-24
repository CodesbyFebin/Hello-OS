import { NextResponse } from "next/server";
import { MAX_TASK_CONTRACT_BYTES, validateTaskContract } from "@/lib/task-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_TASK_CONTRACT_BYTES) {
    return NextResponse.json({ error: "Task contract exceeds the 32 KB request limit.", executable: false }, { status: 413 });
  }
  if (!request.body) return NextResponse.json({ error: "Request body is required.", executable: false }, { status: 400 });

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_TASK_CONTRACT_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Task contract exceeds the 32 KB request limit.", executable: false }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: "Could not read the request body.", executable: false }, { status: 400 });
  } finally {
    reader.releaseLock();
  }

  let input: unknown;
  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return NextResponse.json({ error: "Request body must be valid UTF-8 JSON.", executable: false }, { status: 400 });
  }

  const result = validateTaskContract(input);
  return NextResponse.json(result, { status: result.valid ? 200 : 422 });
}
