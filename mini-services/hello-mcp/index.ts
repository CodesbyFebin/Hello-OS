/// <reference types="bun-types" />
// hello-mcp sidecar (optional). The same MCP server now runs in-process inside
// Next at /api/hello/*; this Bun wrapper is kept for agents that want a
// standalone port. Run: npm run mcp
import { handleMcpRequest, tools, handshakeManifest } from "../../src/lib/mcp/server";

const PORT = Number(process.env.HELLO_MCP_PORT || 3030);
process.env.HELLO_PUBLIC_URL ||= `http://localhost:${PORT}`;
void handshakeManifest;

Bun.serve({
  port: PORT,
  fetch(req) {
    return handleMcpRequest(req, new URL(req.url).pathname);
  },
});


console.log(`🔨 hello-mcp server running on http://localhost:${PORT}`);
console.log(`   handshake:  GET /              (hello.json manifest)`);
console.log(`   tools/list: GET /tools         (${tools.length} tools)`);
console.log(`   tools/call: POST /tools/call   (invoke a tool)`);
console.log(`   feed:       GET /feed          (recent tool calls)`);
