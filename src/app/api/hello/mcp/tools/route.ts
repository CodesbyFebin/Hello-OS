import { NextResponse } from "next/server";

// Proxy: list MCP tools. Browser calls this, server fetches from port 3030.
export async function GET() {
  const r = await fetch(`${process.env.HELLO_MCP_URL || "http://localhost:3030"}/tools`);
  const data = await r.json();
  return NextResponse.json(data);
}
