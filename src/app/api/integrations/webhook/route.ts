import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/mcp/connectors/webhook";

// Technique 9: signed webhook -> typed intent. Observe-only; nothing is executed.
// Disabled (503) unless HELLO_WEBHOOK_SECRET is set.
export async function POST(req: Request) {
  const raw = await req.text();
  const [status, body] = handleWebhook(process.env.HELLO_WEBHOOK_SECRET, raw, req.headers.get("x-hub-signature-256"), req.headers.get("x-github-event"));
  return NextResponse.json(body, { status });
}
