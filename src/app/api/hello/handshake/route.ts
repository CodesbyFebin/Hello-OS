import { NextResponse } from "next/server";
import { handshakeManifest } from "@/lib/mcp/server";

// hello.json handshake, served in-process (no separate MCP service needed).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = process.env.HELLO_PUBLIC_URL || new URL(req.url).origin;
  return NextResponse.json(handshakeManifest(`${origin.replace(/\/$/, "")}/api/hello`));
}
