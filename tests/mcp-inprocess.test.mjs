// In-process MCP: the handshake, tools/list, tools/call and JSON-RPC paths
// work through handleMcpRequest without any separate Bun service.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { db } from "../src/lib/db.ts";
import { handleMcpRequest, handshakeManifest, tools, MCP_PROTOCOL_VERSION } from "../src/lib/mcp/server.ts";

after(() => db.$disconnect());
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("handshake manifest uses package.json version and the given base URL", () => {
  const m = handshakeManifest("http://example.test/api/hello");
  assert.equal(m.version, pkg.version);
  assert.equal(m.endpoint, "http://example.test/api/hello/mcp");
  assert.equal(m.toolCount, tools.length);
});

test("GET /tools lists every tool with a schema", async () => {
  const r = await handleMcpRequest(new Request("http://x/api/hello/mcp/tools"), "/tools");
  assert.equal(r.status, 200);
  const { tools: list } = await r.json();
  assert.ok(list.length >= 20);
  for (const t of list) assert.ok(t.name && t.inputSchema);
});

test("POST /tools/call runs a tool and logs a receipt", async () => {
  const before = await db.mcpToolCall.count();
  const r = await handleMcpRequest(new Request("http://x/api/hello/mcp/call", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "aml.compile", arguments: { source: "agent test" } }),
  }), "/tools/call");
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.isError, false);
  assert.equal(await db.mcpToolCall.count(), before + 1);
});

test("unknown tool returns 404", async () => {
  const r = await handleMcpRequest(new Request("http://x/c", { method: "POST", body: JSON.stringify({ name: "nope" }) }), "/tools/call");
  assert.equal(r.status, 404);
});

test("JSON-RPC initialize + tools/list over /mcp", async () => {
  const rpc = (method, id) => handleMcpRequest(new Request("http://x/api/hello/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "mcp-protocol-version": MCP_PROTOCOL_VERSION, "mcp-method": method },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params: {}, _meta: { "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION } }),
  }), "/mcp");
  const init = await (await rpc("initialize", 1)).json();
  assert.equal(init.result.serverInfo.version, pkg.version);
  const list = await (await rpc("tools/list", 2)).json();
  assert.equal(list.result.tools.length, tools.length);
});
