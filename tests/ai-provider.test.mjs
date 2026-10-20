// AI provider against a local mock OpenAI-compatible server (test-only).
// Run: DATABASE_URL=file:/tmp/hello-ai.db npm run test:ai
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

let server, base, mode = "ok", hits = 0, lastBody = null, lastAuth = "";
before(async () => {
  server = createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      hits++; lastBody = JSON.parse(b || "{}"); lastAuth = req.headers.authorization;
      if (mode === "ratelimit") { res.writeHead(429, { "retry-after": "0" }); return res.end("{}"); }
      if (mode === "flaky" && hits === 1) { res.writeHead(503); return res.end("{}"); }
      if (mode === "slow") return setTimeout(() => res.end("{}"), 500);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ model: lastBody.model, choices: [{ message: { content: "1. read\n2. write" } }], usage: { prompt_tokens: 5, completion_tokens: 4 } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/v1`;
  Object.assign(process.env, { HELLO_AI_PROVIDER: "custom", HELLO_AI_BASE_URL: base, HELLO_AI_API_KEY: "test-key", HELLO_AI_MODEL: "mock/model:free", HELLO_AI_TIMEOUT_MS: "200", HELLO_AI_MAX_RETRIES: "1" });
});
after(async () => { server.close(); const { db } = await import("../src/lib/db.ts"); await db.$disconnect(); });

const P = () => import("../src/lib/ai/provider.ts");

test("unconfigured -> NoAIProviderError / status without secrets", async () => {
  const { resolveAIConfig, aiStatus, PROVIDERS, DEFAULT_MODEL } = await P();
  assert.equal(resolveAIConfig({}).ok, false);
  assert.equal(resolveAIConfig({ HELLO_AI_PROVIDER: "openrouter" }).ok, false, "key required");
  const r = resolveAIConfig({ HELLO_AI_PROVIDER: "kilo", HELLO_AI_API_KEY: "k" });
  assert.equal(r.ok && r.config.baseURL, PROVIDERS.kilo.baseURL);
  assert.equal(r.ok && r.config.model, DEFAULT_MODEL);
  assert.match(DEFAULT_MODEL, /:free$/);
  assert.equal(JSON.stringify(aiStatus()).includes("test-key"), false);
});

test("chat sends model + bearer and parses content", async () => {
  mode = "ok"; const { chat } = await P();
  const r = await chat([{ role: "user", content: "hi" }]);
  assert.equal(r.output, "1. read\n2. write");
  assert.equal(lastBody.model, "mock/model:free");
  assert.equal(lastAuth, "Bearer test-key");
  assert.deepEqual(r.usage, { promptTokens: 5, completionTokens: 4 });
});

test("retries 5xx once, then succeeds", async () => {
  mode = "flaky"; hits = 0; const { chat } = await P();
  const r = await chat([{ role: "user", content: "hi" }]);
  assert.equal(r.attempts, 2);
});

test("429 after retries -> AI_RATE_LIMITED", async () => {
  mode = "ratelimit"; const { chat } = await P();
  await assert.rejects(chat([{ role: "user", content: "hi" }]), (e) => e.code === "AI_RATE_LIMITED" && e.status === 429);
});

test("timeout -> AI_TIMEOUT", async () => {
  mode = "slow"; const { chat } = await P();
  await assert.rejects(chat([{ role: "user", content: "hi" }]), (e) => e.code === "AI_TIMEOUT");
});

test("meteredChat debits credits (H), writes receipt, refunds failures", async () => {
  const { db } = await import("../src/lib/db.ts");
  const { meteredChat } = await import("../src/lib/ai/metered.ts");
  const tag = `ai-test-${Date.now()}`;
  const agent = await db.agent.create({ data: { name: tag, did: `did:key:${tag}`, tagline: "t", avatar: "a", wallet: { create: { balance: 10, dailyCap: 50 } } } });
  try {
    mode = "ok";
    const r = await meteredChat([{ role: "user", content: "x" }], { purpose: tag, agentId: agent.id });
    assert.equal(r.credits, 1);
    assert.match(r.receipt, /^[0-9a-f]{64}$/);
    assert.equal((await db.wallet.findUnique({ where: { agentId: agent.id } })).balance, 9);
    mode = "ratelimit";
    await assert.rejects(meteredChat([{ role: "user", content: "x" }], { purpose: tag, agentId: agent.id }));
    assert.equal((await db.wallet.findUnique({ where: { agentId: agent.id } })).balance, 9, "failed call refunded");
    const logs = await db.auditLog.findMany({ where: { action: "ai.call", target: tag } });
    assert.equal(logs.length, 2);
    assert.equal(logs.some((l) => l.detail.includes("test-key")), false, "no key in audit");
  } finally {
    await db.auditLog.deleteMany({ where: { target: tag } });
    await db.agent.delete({ where: { id: agent.id } });
  }
});
