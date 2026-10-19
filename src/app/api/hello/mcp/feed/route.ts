import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Recent MCP tool calls — the live audit feed
export async function GET() {
  const calls = await db.mcpToolCall.findMany({
    take: 30,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ calls });
}
