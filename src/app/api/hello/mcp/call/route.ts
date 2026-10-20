import { handleMcpRequest } from "@/lib/mcp/server";

// MCP tools/call, executed in-process. Every call is logged with a SHA-256 receipt.
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handleMcpRequest(req, "/tools/call");
}
