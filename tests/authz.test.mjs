// Authorization, input bounds, secret exposure and MCP hardening.
// Run: DATABASE_URL=file:/tmp/hello-authz.db npm run test:authz
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { operatorAuth } from "../src/lib/operator-auth.ts";

const TOKEN = "op-test-token";
const ENV_KEYS = ["HELLO_OPERATOR_TOKEN", "NODE_ENV", "VERCEL", "HELLO_OPERATOR_DEV_MODE"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const setEnv = (e) => { for (const k of ENV_KEYS) delete process.env[k]; Object.assign(process.env, e); };
beforeEach(() => setEnv({}));
after(async () => { setEnv(Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined))); await db.$disconnect(); });

const json = (url, method, body, headers = {}) => new Request(`http://x${url}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const op = { "x-operator-token": TOKEN };
const ctx = (id) => ({ params: Promise.resolve({ id }) });
const noSecret = (o) => { const s = JSON.stringify(o); assert.ok(!/privateKeyHex/.test(s), "privateKeyHex leaked"); };

async function mkAgent(extra = {}) {
  return db.agent.create({ data: { did: `did:key:authz-${Date.now()}-${Math.random()}`, name: "Authz", tagline: "t", avatar: "a", privateKeyHex: "11".repeat(32), wallet: { create: { balance: 100, dailyCap: 80 } }, ...extra } });
}

test("operatorAuth: dev open, production fails closed, token checked", () => {
  const r = (h = {}) => new Request("http://x", { headers: h });
  assert.deepEqual(operatorAuth(r(), {}), { ok: true, devMode: true });
  for (const env of [{ NODE_ENV: "production" }, { VERCEL: "1" }]) {
    const a = operatorAuth(r(), env);
    assert.equal(a.ok, false); assert.equal(a.status, 503); assert.equal(a.code, "OPERATOR_TOKEN_NOT_CONFIGURED");
  }
  assert.equal(operatorAuth(r(), { NODE_ENV: "production", HELLO_OPERATOR_DEV_MODE: "1" }).ok, true, "explicit local override");
  assert.equal(operatorAuth(r(), { VERCEL: "1", HELLO_OPERATOR_DEV_MODE: "yes" }).ok, false, "only exactly 1 enables it");
  const env = { HELLO_OPERATOR_TOKEN: TOKEN };
  assert.equal(operatorAuth(r(), env).status, 401);
  assert.equal(operatorAuth(r({ "x-operator-token": "wrong" }), env).status, 401);
  assert.equal(operatorAuth(r({ "x-operator-token": TOKEN + "x" }), env).ok, false);
  assert.deepEqual(operatorAuth(r(op), env), { ok: true, devMode: false });
  assert.equal(operatorAuth(r({ authorization: `Bearer ${TOKEN}` }), env).ok, true);
});

test("kill switch route: needs operator; production without token is 503; kill switch blocks spends", async () => {
  const { POST } = await import("../src/app/api/operator/route.ts");
  const spend = (await import("../src/app/api/agents/[id]/wallet/spend/route.ts")).POST;
  const agent = await mkAgent();
  try {
    setEnv({ HELLO_OPERATOR_TOKEN: TOKEN });
    assert.equal((await POST(json("/api/operator", "POST", { killSwitch: true }))).status, 401);
    assert.equal((await POST(json("/api/operator", "POST", { approvalThreshold: -1 }, op))).status, 400);
    const on = await POST(json("/api/operator", "POST", { killSwitch: true }, op));
    assert.equal(on.status, 200); assert.equal((await on.json()).control.killSwitch, true);
    assert.equal((await spend(json("/x", "POST", { amount: 1 }), ctx(agent.id))).status, 423, "kill switch blocks");
    await POST(json("/api/operator", "POST", { killSwitch: false, approvalThreshold: 25 }, op));
    assert.equal((await spend(json("/x", "POST", { amount: 1 }), ctx(agent.id))).status, 200);
    setEnv({ NODE_ENV: "production" });
    assert.equal((await POST(json("/api/operator", "POST", { killSwitch: true }))).status, 503);
  } finally { await db.agent.delete({ where: { id: agent.id } }); }
});

test("approvals: deciding needs operator", async () => {
  const { POST } = await import("../src/app/api/approvals/[id]/route.ts");
  setEnv({ HELLO_OPERATOR_TOKEN: TOKEN });
  assert.equal((await POST(json("/x", "POST", { decision: "approve" }), ctx("nope"))).status, 401);
  assert.equal((await POST(json("/x", "POST", { decision: "maybe" }, op), ctx("nope"))).status, 400);
  setEnv({ VERCEL: "1" });
  assert.equal((await POST(json("/x", "POST", { decision: "approve" }), ctx("nope"))).status, 503);
});

test("wallet caps: changing caps/funding needs operator, bounds enforced, spend obeys cap and gate", async () => {
  const w = await import("../src/app/api/agents/[id]/wallet/route.ts");
  const spend = (await import("../src/app/api/agents/[id]/wallet/spend/route.ts")).POST;
  const ctl = (await import("../src/app/api/operator/route.ts")).POST;
  const agent = await mkAgent();
  try {
    setEnv({ HELLO_OPERATOR_TOKEN: TOKEN });
    await ctl(json("/api/operator", "POST", { killSwitch: false, approvalThreshold: 25 }, op));
    assert.equal((await w.PATCH(json("/x", "PATCH", { dailyCap: 1e9 }), ctx(agent.id))).status, 401);
    assert.equal((await w.POST(json("/x", "POST", { amount: 10 }), ctx(agent.id))).status, 401);
    assert.equal((await w.PATCH(json("/x", "PATCH", { dailyCap: 1e9 }, op), ctx(agent.id))).status, 400, "bound");
    assert.equal((await w.POST(json("/x", "POST", { amount: -5 }, op), ctx(agent.id))).status, 400);
    assert.equal((await w.POST(json("/x", "POST", { amount: 5 }, op), ctx("missing"))).status, 404);
    assert.equal((await w.PATCH(json("/x", "PATCH", { dailyCap: 5 }, op), ctx(agent.id))).status, 200);
    assert.notEqual((await spend(json("/x", "POST", { amount: 6 }), ctx(agent.id))).status, 200, "over daily cap");
    // A cap breach trips the circuit breaker; only the operator can close it.
    assert.equal((await spend(json("/x", "POST", { amount: 4 }), ctx(agent.id))).status, 423);
    assert.equal((await w.PATCH(json("/x", "PATCH", { circuitOpen: false }), ctx(agent.id))).status, 401);
    assert.equal((await w.PATCH(json("/x", "PATCH", { circuitOpen: false }, op), ctx(agent.id))).status, 200);
    assert.equal((await spend(json("/x", "POST", { amount: 4 }), ctx(agent.id))).status, 200);
    assert.equal((await spend(json("/x", "POST", { amount: 1e12 }), ctx(agent.id))).status, 400, "bound");
    await w.PATCH(json("/x", "PATCH", { dailyCap: 80 }, op), ctx(agent.id));
    assert.equal((await spend(json("/x", "POST", { amount: 30 }), ctx(agent.id))).status, 202, "above threshold → approval");
    assert.ok(await db.auditLog.findFirst({ where: { action: "wallet.update", target: agent.id } }));
  } finally { await db.actionApproval.deleteMany({ where: { agentId: agent.id } }).catch(() => {}); await db.agent.delete({ where: { id: agent.id } }); }
});

test("role-scoped knowledge: writes need operator; search filters by role", async () => {
  const k = await import("../src/app/api/knowledge/route.ts");
  const roles = await import("../src/app/api/knowledge/roles/route.ts");
  const search = (await import("../src/app/api/knowledge/search/route.ts")).GET;
  const a = await mkAgent(); const b = await mkAgent();
  try {
    setEnv({ HELLO_OPERATOR_TOKEN: TOKEN });
    assert.equal((await k.POST(json("/x", "POST", { title: "t", body: "b", allowedRoles: ["security"] }))).status, 401);
    assert.equal((await roles.POST(json("/x", "POST", { agentId: a.id, role: "security" }))).status, 401);
    const doc = await (await k.POST(json("/x", "POST", { title: "zebra runbook", body: "zebra rotation procedure for incident keys", allowedRoles: ["security"] }, op))).json();
    assert.ok(doc.id);
    assert.equal((await roles.POST(json("/x", "POST", { agentId: a.id, role: "security" }, op))).status, 200);
    const ids = async (agentId) => { const r = await (await search(new Request(`http://x/api/knowledge/search?agentId=${agentId}&q=zebra+rotation`))).json(); return JSON.stringify(r); };
    assert.ok((await ids(a.id)).includes(doc.id), "security role sees it");
    assert.ok(!(await ids(b.id)).includes(doc.id), "no role, no result");
    await db.knowledgeDoc.delete({ where: { id: doc.id } });
  } finally { await db.agentRole.deleteMany({ where: { agentId: { in: [a.id, b.id] } } }); await db.agent.deleteMany({ where: { id: { in: [a.id, b.id] } } }); }
});

test("identity: agent routes never return private keys; tier is not self-assigned; bounds", async () => {
  const agents = await import("../src/app/api/agents/route.ts");
  const one = (await import("../src/app/api/agents/[id]/route.ts")).GET;
  setEnv({ HELLO_OPERATOR_TOKEN: TOKEN });
  assert.equal((await agents.POST(json("/api/agents", "POST", { name: "x".repeat(61) }))).status, 400);
  assert.equal((await agents.POST(json("/api/agents", "POST", { name: "Ok", guardianTier: "God" }))).status, 400);
  assert.equal((await agents.POST(json("/api/agents", "POST", { name: "Ok", guardianTier: "Sovereign" }))).status, 401);
  const res = await agents.POST(json("/api/agents", "POST", { name: "KeyCheck" }));
  assert.equal(res.status, 200);
  const created = await res.json(); noSecret(created);
  assert.equal(created.agent.guardianTier, "Seedling");
  const stored = await db.agent.findUnique({ where: { id: created.agent.id }, omit: { privateKeyHex: false } });
  assert.match(stored.privateKeyHex, /^[0-9a-f]{64}$/, "key exists server-side only");
  try {
    noSecret(await (await agents.GET(new Request("http://x/api/agents"))).json());
    noSecret(await (await one(new Request("http://x"), ctx(created.agent.id))).json());
  } finally { await db.agent.delete({ where: { id: created.agent.id } }); }
});

const mcp = () => import("../src/lib/mcp/server.ts");
const call = async (name, args, headers = {}) => (await mcp()).handleMcpRequest(json("/api/hello/mcp/call", "POST", { name, arguments: args }, headers), "/tools/call");

test("MCP: write/private tools need operator; reads stay open; production fails closed", async () => {
  setEnv({ HELLO_OPERATOR_TOKEN: TOKEN });
  assert.equal((await call("cloud.checkpoint", { name: "x" })).status, 401);
  assert.equal((await call("connector.sql.query", { sql: "SELECT 1" })).status, 401);
  assert.equal((await call("memory.recall", { agentId: "x" })).status, 401);
  assert.equal((await call("aml.compile", { source: "agent t" })).status, 200);
  setEnv({ NODE_ENV: "production" });
  assert.equal((await call("cloud.checkpoint", { name: "x" })).status, 503);
  const { MCP_PROTOCOL_VERSION, handleMcpRequest } = await mcp();
  const rpc = await handleMcpRequest(new Request("http://x/api/hello/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "mcp-protocol-version": MCP_PROTOCOL_VERSION, "mcp-method": "tools/call", "mcp-name": "cloud.rollback" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "cloud.rollback", arguments: { checkpointId: "x" } }, _meta: { "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION } }) }), "/mcp");
  assert.equal(rpc.status, 503);
  assert.equal((await rpc.json()).error.data.code, "OPERATOR_TOKEN_NOT_CONFIGURED");
});

test("MCP: argument validation, body size, accurate receipts, metadata-only feed", async () => {
  assert.equal((await call("aml.compile", "not-an-object")).status, 400);
  assert.equal((await call("aml.compile", { source: 42 })).status, 400);
  assert.equal((await call("forge.readSymbol", {})).status, 400, "missing required");
  const { handleMcpRequest } = await mcp();
  const big = await handleMcpRequest(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "aml.compile", arguments: { source: "x".repeat(1_100_000) } }) }), "/tools/call");
  assert.equal(big.status, 413);
  const bad = await handleMcpRequest(new Request("http://x", { method: "POST", body: "{nope" }), "/tools/call");
  assert.equal(bad.status, 400);
  const r = await (await call("aml.compile", { source: "agent receipt-check" })).json();
  const row = await db.mcpToolCall.findFirst({ where: { receiptHash: r.receiptHash } });
  assert.ok(row, "returned receipt is the logged row's digest");
  assert.equal(r.receipt, r.receiptHash);
  const feed = await (await handleMcpRequest(new Request("http://x/feed"), "/feed")).json();
  assert.ok(feed.calls.length > 0);
  for (const c of feed.calls) { assert.equal("argumentsJson" in c, false); assert.equal("resultJson" in c, false); }
  const m = (await mcp()).handshakeManifest();
  assert.match(m.note, /not a signature/);
  assert.ok(!JSON.stringify(m).includes("signed test receipt"));
});
