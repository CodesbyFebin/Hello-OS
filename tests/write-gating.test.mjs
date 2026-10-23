// Operator gating, agent-scoped writes, input bounds and public redaction on the remaining write routes.
// Run: DATABASE_URL=file:/tmp/hello-gating.db node ... --test tests/write-gating.test.mjs
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { db } from "../src/lib/db.ts";
import { signAgentRequest } from "../src/lib/agent-auth.ts";

const TOKEN = "op-gating";
const KEYS = ["HELLO_OPERATOR_TOKEN", "NODE_ENV", "VERCEL", "HELLO_OPERATOR_DEV_MODE", "HELLO_RATE_LIMIT", "HELLO_RATE_LIMIT_ATTESTATIONS"];
const setEnv = (e) => { for (const k of KEYS) delete process.env[k]; Object.assign(process.env, e); };
beforeEach(() => setEnv({ HELLO_OPERATOR_TOKEN: TOKEN }));
after(async () => { setEnv({}); await db.$disconnect(); });

const op = { "x-operator-token": TOKEN };
const req = (url, method, body, headers = {}) => new Request(`http://x${url}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : (typeof body === "string" ? body : JSON.stringify(body)) });
const ctx = (id) => ({ params: Promise.resolve({ id }) });

async function create(name) {
  const { POST } = await import("../src/app/api/agents/route.ts");
  const j = await (await POST(req("/api/agents", "POST", { name }, op))).json();
  return { id: j.agent.id, secret: j.agentAuthKey.authSecretHex };
}
async function signed(a, url, bodyObj) {
  const body = JSON.stringify(bodyObj);
  const full = `http://x${url}`;
  const h = await signAgentRequest({ agentId: a.id, secretHex: a.secret, method: "POST", url: full, body, nonce: randomBytes(12).toString("hex") });
  return new Request(full, { method: "POST", headers: { "content-type": "application/json", ...h }, body });
}

const OPERATOR_ONLY = [
  ["observations", "../src/app/api/observations/route.ts", "POST"],
  ["cache", "../src/app/api/cache/route.ts", "POST"],
  ["failures", "../src/app/api/failures/route.ts", "POST"],
  ["traces/golden-replay", "../src/app/api/traces/golden-replay/route.ts", "POST"],
  ["evolution/runs", "../src/app/api/evolution/runs/route.ts", "POST"],
];

for (const [name, path, method] of OPERATOR_ONLY) {
  test(`${name}: 401 without operator token, 503 in production with no token configured`, async () => {
    const mod = await import(path).catch(() => null);
    if (!mod) return assert.fail(`missing ${path}`);
    const r = await mod[method](req(`/api/${name}`, method, {}));
    assert.equal(r.status, 401);
    assert.equal((await r.json()).code, "OPERATOR_TOKEN_REQUIRED");
    setEnv({ VERCEL: "1" });
    const r2 = await mod[method](req(`/api/${name}`, method, {}));
    assert.equal(r2.status, 503);
  });
}

test("attestations: unsigned 401, wrong signer 403, signed by fromId passes auth, oversized fields 400", async () => {
  const { POST } = await import("../src/app/api/attestations/route.ts");
  const a = await create("GateA"), b = await create("GateB");
  const body = { fromId: a.id, toId: b.id, claim: "reliable" };
  assert.equal((await POST(req("/api/attestations", "POST", body))).status, 401);
  assert.equal((await POST(await signed(b, "/api/attestations", body))).status, 403);
  const ok = await POST(await signed(a, "/api/attestations", body));
  assert.equal(ok.status, 200, await ok.clone().text());
  const big = await POST(await signed(a, "/api/attestations", { ...body, claim: "x".repeat(201) }));
  assert.equal(big.status, 400);
  assert.equal((await big.json()).code, "BAD_FIELD");
});

test("operator token passes an agent-scoped route; body over the cap is 413", async () => {
  const { POST } = await import("../src/app/api/attestations/route.ts");
  const a = await create("GateC"), b = await create("GateD");
  assert.equal((await POST(req("/api/attestations", "POST", { fromId: a.id, toId: b.id, claim: "helpful" }, op))).status, 200);
  const huge = await POST(req("/api/attestations", "POST", JSON.stringify({ fromId: a.id, note: "x".repeat(300_000) }), op));
  assert.equal(huge.status, 413);
});

test("rate limit returns 429 once the bucket is exhausted", async () => {
  setEnv({ HELLO_OPERATOR_TOKEN: TOKEN, HELLO_RATE_LIMIT_ATTESTATIONS: "1" });
  const { POST } = await import("../src/app/api/attestations/route.ts");
  const hdr = { ...op, "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.1` };
  await POST(req("/api/attestations", "POST", {}, hdr));
  const r = await POST(req("/api/attestations", "POST", {}, hdr));
  assert.equal(r.status, 429);
});

test("audit and traces: public view redacted, operator view full", async () => {
  await db.auditLog.create({ data: { actor: "operator", action: "test.redact", target: "t", detail: "SECRET-DETAIL" } });
  const audit = await import("../src/app/api/audit/route.ts");
  const pub = await (await audit.GET(req("/api/audit", "GET"))).json();
  assert.equal(pub.redacted, true);
  assert.ok(!JSON.stringify(pub).includes("SECRET-DETAIL"));
  const full = await (await audit.GET(req("/api/audit", "GET", undefined, op))).json();
  assert.equal(full.redacted, false);
  assert.ok(JSON.stringify(full).includes("SECRET-DETAIL"));
  const traces = await import("../src/app/api/traces/route.ts");
  const t = await (await traces.GET(req("/api/traces", "GET"))).json();
  assert.equal(t.redacted, true);
  const t2 = await (await traces.GET(req("/api/traces", "GET", undefined, op))).json();
  assert.equal(t2.redacted, false);
});

test("/api/operator GET reports auth state for the dashboard", async () => {
  const { GET } = await import("../src/app/api/operator/route.ts");
  assert.deepEqual((await (await GET(req("/api/operator", "GET"))).json()).auth.status, 401);
  assert.equal((await (await GET(req("/api/operator", "GET", undefined, op))).json()).auth.authorized, true);
  setEnv({ VERCEL: "1" });
  const j = await (await GET(req("/api/operator", "GET"))).json();
  assert.equal(j.auth.status, 503); assert.equal(j.auth.code, "OPERATOR_TOKEN_NOT_CONFIGURED");
  setEnv({});
  assert.equal((await (await GET(req("/api/operator", "GET"))).json()).auth.devMode, true);
});
