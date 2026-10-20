import { handleMcpRequest } from "@/lib/mcp/server";

// MCP tools/list, served in-process.
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handleMcpRequest(req, "/tools");
}
