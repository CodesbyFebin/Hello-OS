import { NextResponse } from "next/server";

// Proxy to the hello-mcp mini-service (port 3030) for the handshake manifest.
// Browser → /api/hello/handshake?XTransformPort=3030 → Caddy → localhost:3030/
export async function GET() {
  const r = await fetch(`${process.env.HELLO_MCP_URL || "http://localhost:3030"}/`);
  const data = await r.json();
  return NextResponse.json(data);
}
