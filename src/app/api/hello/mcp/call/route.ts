import { NextResponse } from "next/server";

// Proxy: invoke an MCP tool. The browser POSTs here; the server forwards to
// the hello-mcp mini-service on port 3030 and returns the real result.
// This is how the in-browser Agent Console calls real tools.
export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch(`${process.env.HELLO_MCP_URL || "http://localhost:3030"}/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
