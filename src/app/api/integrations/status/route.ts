import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runStatusChecks } from "@/lib/integrations/status";
import { handleMcpRequest } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runStatusChecks({
    // Without HELLO_MCP_URL the MCP server runs in-process, so check it directly.
    env: { ...process.env, HELLO_MCP_URL: process.env.HELLO_MCP_URL || "inprocess:" },
    fetchImpl: (url, init) => url.startsWith("inprocess:") ? handleMcpRequest(new Request("http://inprocess/tools", init), "/tools") : fetch(url, init),
    countTables: async () => {
      const rows = await db.$queryRawUnsafe<{ n: number | bigint }[]>("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
      return Number(rows[0]?.n ?? 0);
    },
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
