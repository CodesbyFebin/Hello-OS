// Per-agent request signatures, replay protection, idempotency, rate limits.
// Run: DATABASE_URL=file:/tmp/hello-agentauth.db npm run test:agent-auth
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { db } from "../src/lib/db.ts";
import { signAgentRequest, parseSignedRequest, canonicalRequest } from "../src/lib/agent-auth.ts";

const TOKEN = "op-agent-auth";
const KEYS = ["HELLO_OPERATOR_TOKEN", "NODE_ENV", "VERCEL", "HELLO_OPERATOR_DEV_MODE", "HELLO_RATE_LIMIT", "HELLO_RATE_LIMIT_SPEND"];
const setEnv = (e) => { for (const k of KEYS) delete process.env[k]; Object.assign(process.env, e); };
beforeEach(() => setEnv({ HELLO_OPERATOR_TOKEN: TOKEN }));
after(async () => { setEnv({}); await db.$disconnect(); });

const nonce = () => randomBytes(12).toString("hex");
const op = { "x-operator-token": TOKEN };
const ctx = (id) => ({ params: Promise.resolve({ id }) });
const agentsRoute = () => import("../src/app/api/agents/route.ts");
const spendRoute = async () => (await import("../src/app/api/agents/[id]/wallet/spend/route.ts")).POST;

async function create(name) {
  const res = await (await agentsRoute()).POST(new Request("http://x/api/agents", { method: "POST", headers: { "content-type": "application/json", ...op }, body: JSON.stringify({ name }) }));
  const j = await res.json();
  return { id: j.agent.id, secret: j.agentAuthKey.authSecretHex };
}
async function signed(a, method, url, bodyObj, extra = {}, opts = {}) {
  const body = bodyObj === undefined ? "" : JSON.stringify(bodyObj);
  const h = await signAgentRequest({ agentId: opts.as ?? a.id, secretHex: a.secret, method, url, body, nonce: opts.nonce ?? nonce(), timestamp: opts.ts });
  return new Request(url, { method, headers: { "content-type": "application/json", ...h, ...extra }, body: body || undefined });
}

test("creation returns the auth secret once; only the public key is stored", async () => {
  const a = await create("SigA");
  assert.match(a.secret, /^[0-9a-f]{64}$/);
  const row = await db.agent.findUnique({ where: { id: a.id } });
  assert.match(row.authPublicKeyHex, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(row).includes(a.secret), "secret not stored");
  const list = await (await (await agentsRoute()).GET(new Request("http://x/api/agents"))).json();
  assert.ok(!JSON.stringify(list).includes(a.secret));
});

test("header parsing: incomplete, bad timestamp, expired, bad nonce", () => {
  const r = (h) => new Request("http://x/p", { headers: h });
  assert.equal(parseSignedRequest(r({}), "").present, false);
  assert.equal(parseSignedRequest(r({ "x-hello-agent-id": "a" }), "").code, "AGENT_SIG_INCOMPLETE");
  const base = { "x-hello-agent-id": "a", "x-hello-nonce": "n".repeat(16), "x-hello-signature": "0".repeat(128) };
  assert.equal(parseSignedRequest(r({ ...base, "x-hello-timestamp": "abc" }), "").code, "AGENT_SIG_BAD_TIMESTAMP");
  assert.equal(parseSignedRequest(r({ ...base, "x-hello-timestamp": String(Date.now() - 10 * 60_000) }), "").code, "AGENT_SIG_EXPIRED");
  assert.equal(parseSignedRequest(r({ ...base, "x-hello-timestamp": String(Date.now()), "x-hello-nonce": "short" }), "").code, "AGENT_SIG_BAD_NONCE");
  assert.notEqual(canonicalRequest("POST", "/p", "1", "n", "a"), canonicalRequest("POST", "/p", "1", "n", "b"), "body is bound");
});

test("signed spend: owner ok; other agent 403; tampered body 401; replay 409; unsigned 401", async () => {
  const a = await create("SigOwner"); const b = await create("SigOther");
  const spend = await spendRoute();
  const url = `http://x/api/agents/${a.id}/wallet/spend`;
  assert.equal((await spend(await signed(a, "POST", url, { amount: 1 }), ctx(a.id))).status, 200);
  assert.equal((await spend(await signed(b, "POST", url, { amount: 1 }), ctx(a.id))).status, 403, "b cannot spend a's wallet");
  const good = await signed(a, "POST", url, { amount: 1 });
  const tampered = new Request(url, { method: "POST", headers: good.headers, body: JSON.stringify({ amount: 2 }) });
  const t = await spend(tampered, ctx(a.id));
  assert.equal(t.status, 401); assert.equal((await t.json()).code, "AGENT_SIG_INVALID");
  const n = nonce();
  assert.equal((await spend(await signed(a, "POST", url, { amount: 1 }, {}, { nonce: n }), ctx(a.id))).status, 200);
  const replay = await spend(await signed(a, "POST", url, { amount: 1 }, {}, { nonce: n }), ctx(a.id));
  assert.equal(replay.status, 409); assert.equal((await replay.json()).code, "REPLAYED");
  const old = await spend(await signed(a, "POST", url, { amount: 1 }, {}, { ts: Date.now() - 6 * 60_000 }), ctx(a.id));
  assert.equal((await old.json()).code, "AGENT_SIG_EXPIRED");
  const unsigned = await spend(new Request(url, { method: "POST", body: JSON.stringify({ amount: 1 }) }), ctx(a.id));
  assert.equal(unsigned.status, 401); assert.equal((await unsigned.json()).code, "AGENT_AUTH_REQUIRED");
  assert.equal((await spend(new Request(url, { method: "POST", headers: op, body: JSON.stringify({ amount: 1 }) }), ctx(a.id))).status, 200, "operator may act");
});

test("dev mode: unsigned works locally; production without token requires signatures", async () => {
  const a = await create("SigDev");
  const spend = await spendRoute();
  const url = `http://x/api/agents/${a.id}/wallet/spend`;
  setEnv({});
  assert.equal((await spend(new Request(url, { method: "POST", body: JSON.stringify({ amount: 1 }) }), ctx(a.id))).status, 200);
  setEnv({ VERCEL: "1" });
  assert.equal((await spend(new Request(url, { method: "POST", body: JSON.stringify({ amount: 1 }) }), ctx(a.id))).status, 401);
  assert.equal((await spend(await signed(a, "POST", url, { amount: 1 }), ctx(a.id))).status, 200, "signed agents still work in production");
});

test("operator revokes and rotates the key", async () => {
  const a = await create("SigRevoke");
  const key = await import("../src/app/api/agents/[id]/auth-key/route.ts");
  const spend = await spendRoute();
  const url = `http://x/api/agents/${a.id}/wallet/spend`;
  assert.equal((await key.DELETE(new Request("http://x", { method: "DELETE" }), ctx(a.id))).status, 401, "operator only");
  assert.equal((await key.DELETE(new Request("http://x", { method: "DELETE", headers: op }), ctx(a.id))).status, 200);
  const r = await spend(await signed(a, "POST", url, { amount: 1 }), ctx(a.id));
  assert.equal(r.status, 401); assert.equal((await r.json()).code, "AGENT_KEY_REVOKED");
  const issued = await (await key.POST(new Request("http://x", { method: "POST", headers: op }), ctx(a.id))).json();
  const a2 = { id: a.id, secret: issued.agentAuthKey.authSecretHex };
  assert.equal((await spend(await signed(a2, "POST", url, { amount: 1 }), ctx(a.id))).status, 200);
  assert.equal((await spend(await signed(a, "POST", url, { amount: 1 }), ctx(a.id))).status, 401, "old key dead");
  assert.ok(await db.auditLog.findFirst({ where: { action: "agent.authkey.revoke", target: a.id } }));
});

test("memory, soul, knowledge search and missions enforce the acting agent", async () => {
  const a = await create("SigMem"); const b = await create("SigMem2");
  const mem = await import("../src/app/api/agents/[id]/memory/route.ts");
  const soul = (await import("../src/app/api/agents/[id]/soul/route.ts")).POST;
  const search = (await import("../src/app/api/knowledge/search/route.ts")).GET;
  const memUrl = `http://x/api/agents/${a.id}/memory`;
  assert.equal((await mem.POST(await signed(b, "POST", memUrl, { content: "x" }), ctx(a.id))).status, 403);
  const created = await (await mem.POST(await signed(a, "POST", memUrl, { content: "note" }), ctx(a.id))).json();
  assert.ok(created.memory.id);
  assert.equal((await mem.POST(await signed(a, "POST", memUrl, { content: "x", confidence: 7 }), ctx(a.id))).status, 400);
  // b deleting a's memory through b's own route: not found (scoped by agent).
  const durl = `http://x/api/agents/${b.id}/memory?memoryId=${created.memory.id}`;
  assert.equal((await mem.DELETE(await signed(b, "DELETE", durl), ctx(b.id))).status, 404);
  assert.equal((await mem.DELETE(await signed(a, "DELETE", `http://x/api/agents/${a.id}/memory?memoryId=${created.memory.id}`), ctx(a.id))).status, 200);
  assert.equal((await soul(await signed(b, "POST", `http://x/api/agents/${a.id}/soul`, { charter: "x" }), ctx(a.id))).status, 403);
  assert.equal((await soul(await signed(a, "POST", `http://x/api/agents/${a.id}/soul`, { charter: "x".repeat(10_001) }), ctx(a.id))).status, 400);
  assert.equal((await soul(await signed(a, "POST", `http://x/api/agents/${a.id}/soul`, { charter: "mine" }), ctx(a.id))).status, 200);
  const surl = `http://x/api/knowledge/search?agentId=${a.id}&q=zebra`;
  assert.equal((await search(await signed(b, "GET", surl))).status, 403, "cannot search as another agent");
  assert.equal((await search(await signed(a, "GET", surl))).status, 200);
  assert.equal((await search(new Request(surl))).status, 401);
});

test("missions: poster signs posting; reward moves from poster to claimer, never minted", async () => {
  const p = await create("Poster"); const c = await create("Claimer");
  const missions = (await import("../src/app/api/missions/route.ts")).POST;
  const claim = await import("../src/app/api/missions/[id]/claim/route.ts");
  const url = "http://x/api/missions";
  assert.equal((await missions(await signed(c, "POST", url, { title: "t", posterId: p.id }))).status, 403);
  assert.equal((await missions(await signed(p, "POST", url, { title: "t", posterId: p.id, reward: -1 }))).status, 400);
  const m = (await (await missions(await signed(p, "POST", url, { title: "Fix", posterId: p.id, reward: 30 }))).json()).mission;
  const curl = `http://x/api/missions/${m.id}/claim`;
  assert.equal((await claim.POST(await signed(p, "POST", curl, { claimerId: p.id }), ctx(m.id))).status, 409, "no self-claim");
  const cl = (await (await claim.POST(await signed(c, "POST", curl, { claimerId: c.id }), ctx(m.id))).json()).claim;
  assert.equal((await claim.PATCH(await signed(c, "PATCH", curl, { claimId: cl.id, action: "accept" }), ctx(m.id))).status, 403, "claimer cannot accept");
  assert.equal((await claim.PATCH(await signed(p, "PATCH", curl, { claimId: cl.id, action: "complete" }), ctx(m.id))).status, 409, "must accept first");
  assert.equal((await claim.PATCH(await signed(p, "PATCH", curl, { claimId: cl.id, action: "accept" }), ctx(m.id))).status, 200);
  const before = await db.wallet.findMany({ where: { agentId: { in: [p.id, c.id] } } });
  const total = before.reduce((s, w) => s + w.balance, 0);
  assert.equal((await claim.PATCH(await signed(p, "PATCH", curl, { claimId: cl.id, action: "complete" }), ctx(m.id))).status, 200);
  const afterW = await db.wallet.findMany({ where: { agentId: { in: [p.id, c.id] } } });
  assert.equal(afterW.reduce((s, w) => s + w.balance, 0), total, "credits conserved");
  assert.equal(afterW.find((w) => w.agentId === c.id).balance, before.find((w) => w.agentId === c.id).balance + 30);
  const m2 = (await (await missions(await signed(p, "POST", url, { title: "Big", posterId: p.id, reward: 10_000 }))).json()).mission;
  const c2 = (await (await claim.POST(await signed(c, "POST", `http://x/api/missions/${m2.id}/claim`, { claimerId: c.id }), ctx(m2.id))).json()).claim;
  await claim.PATCH(await signed(p, "PATCH", `http://x/api/missions/${m2.id}/claim`, { claimId: c2.id, action: "accept" }), ctx(m2.id));
  const broke = await claim.PATCH(await signed(p, "PATCH", `http://x/api/missions/${m2.id}/claim`, { claimId: c2.id, action: "complete" }), ctx(m2.id));
  assert.equal(broke.status, 409); assert.equal((await broke.json()).code, "INSUFFICIENT_FUNDS");
});

test("A2A writes need the sender's signature", async () => {
  const s = await create("A2ASender"); const r = await create("A2AReceiver");
  const { POST } = await import("../src/app/api/a2a/route.ts");
  const msg = { jsonrpc: "2.0", id: 1, method: "message/send", params: { senderId: s.id, receiverId: r.id, message: { role: "user", parts: [{ kind: "text", text: "hi" }] } } };
  assert.equal((await POST(await signed(r, "POST", "http://x/api/a2a", msg))).status, 403);
  const ok = await (await POST(await signed(s, "POST", "http://x/api/a2a", msg))).json();
  assert.ok(ok.result?.id, JSON.stringify(ok));
  const legacy = { senderId: s.id, receiverId: r.id, intent: "query", truthTier: "verified" };
  assert.equal((await POST(await signed(s, "POST", "http://x/api/a2a", legacy))).status, 400, "cannot self-label verified");
  const read = await POST(new Request("http://x/api/a2a", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tasks/list", params: {} }) }));
  assert.equal(read.status, 200, "reads need no signature");
});

test("Idempotency-Key: same request runs once; different body with same key is 422", async () => {
  const a = await create("Idem");
  const spend = await spendRoute();
  const url = `http://x/api/agents/${a.id}/wallet/spend`;
  const key = { "idempotency-key": `k-${nonce()}` };
  const w0 = (await db.wallet.findUnique({ where: { agentId: a.id } })).balance;
  const r1 = await spend(await signed(a, "POST", url, { amount: 2 }, key), ctx(a.id));
  const r2 = await spend(await signed(a, "POST", url, { amount: 2 }, key), ctx(a.id));
  assert.equal(r1.status, 200); assert.equal(r2.status, 200);
  assert.equal(r2.headers.get("idempotent-replayed"), "true");
  assert.equal((await db.wallet.findUnique({ where: { agentId: a.id } })).balance, w0 - 2, "charged once");
  assert.equal((await spend(await signed(a, "POST", url, { amount: 3 }, key), ctx(a.id))).status, 422);
  assert.equal((await spend(await signed(a, "POST", url, { amount: 3 }, { "idempotency-key": "bad key with spaces" }), ctx(a.id))).status, 400);
});

test("MCP: Idempotency-Key replays without re-running; rate limit returns 429", async () => {
  const { handleMcpRequest } = await import("../src/lib/mcp/server.ts");
  const call = (h = {}) => handleMcpRequest(new Request("http://x/api/hello/mcp/call", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", ...h }, body: JSON.stringify({ name: "aml.compile", arguments: { source: "agent idem" } }) }), "/tools/call");
  const before = await db.mcpToolCall.count();
  const k = { "idempotency-key": `mcp-${nonce()}` };
  assert.equal((await call(k)).status, 200);
  const again = await call(k);
  assert.equal(again.headers.get("idempotent-replayed"), "true");
  assert.equal(await db.mcpToolCall.count(), before + 1, "tool ran once");
  setEnv({ HELLO_OPERATOR_TOKEN: TOKEN, HELLO_RATE_LIMIT_MCP: "1" });
  const lim = (h) => handleMcpRequest(new Request("http://x/api/hello/mcp/call", { method: "POST", headers: { "x-forwarded-for": h }, body: JSON.stringify({ name: "aml.compile", arguments: { source: "agent rl" } }) }), "/tools/call");
  const ip = `198.51.100.${Date.now() % 250}`;
  assert.equal((await lim(ip)).status, 200);
  const blocked = await lim(ip);
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  assert.equal((await lim(ip + "1")).status, 200, "other clients unaffected");
  setEnv({ HELLO_OPERATOR_TOKEN: TOKEN, HELLO_RATE_LIMIT_MCP: "1", HELLO_RATE_LIMIT: "off" });
  assert.equal((await lim(ip)).status, 200, "HELLO_RATE_LIMIT=off disables");
});

test("rate limit on agent writes is per agent", async () => {
  const a = await create("RL1"); const b = await create("RL2");
  const spend = await spendRoute();
  setEnv({ HELLO_OPERATOR_TOKEN: TOKEN, HELLO_RATE_LIMIT_SPEND: "2" });
  const go = async (x) => (await spend(await signed(x, "POST", `http://x/api/agents/${x.id}/wallet/spend`, { amount: 1 }), ctx(x.id))).status;
  assert.equal(await go(a), 200); assert.equal(await go(a), 200);
  assert.equal(await go(a), 429);
  assert.equal(await go(b), 200);
});
