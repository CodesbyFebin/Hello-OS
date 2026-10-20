import { handleMcpRequest } from "@/lib/mcp/server";

// MCP Streamable HTTP JSON-RPC endpoint (initialize, tools/list, tools/call,
// resources/*), served in-process at /api/hello/mcp.
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handleMcpRequest(req, "/mcp");
}

export function OPTIONS(req: Request) {
  return handleMcpRequest(req, "/mcp");
}
