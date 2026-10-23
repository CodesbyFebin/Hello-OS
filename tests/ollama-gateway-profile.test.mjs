// Optional local/gateway profiles (Ollama, LiteLLM via custom) against a local
// mock OpenAI-compatible server. No real Ollama/LiteLLM, no network.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

let server, base, last = null;
before(async () => {
  server = createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      last = { url: req.url, auth: req.headers.authorization, body: JSON.parse(b || "{}") };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ model: last.body.model, choices: [{ message: { content: "ok" } }] }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/v1`;
});
after(() => server.close());
const P = () => import("../src/lib/ai/provider.ts");

test("disabled by default: no provider env means not configured", async () => {
  const { resolveAIConfig } = await P();
  assert.equal(resolveAIConfig({}).ok, false);
});

test("ollama: default base URL is loopback, key optional, model required", async () => {
  const { resolveAIConfig, PROVIDERS } = await P();
  assert.equal(PROVIDERS.ollama.baseURL, "http://127.0.0.1:11434/v1");
  const noModel = resolveAIConfig({ HELLO_AI_PROVIDER: "ollama" });
  assert.equal(noModel.ok, false);
  assert.match(noModel.reason, /HELLO_AI_MODEL/);
  const r = resolveAIConfig({ HELLO_AI_PROVIDER: "ollama", HELLO_AI_MODEL: "llama3.2" });
  assert.equal(r.ok, true);
  assert.equal(r.config.apiKey, "");
});

test("ollama profile: chat sends no authorization header when no key", async () => {
  const { resolveAIConfig, chat } = await P();
  const r = resolveAIConfig({ HELLO_AI_PROVIDER: "ollama", HELLO_AI_BASE_URL: base, HELLO_AI_MODEL: "llama3.2", HELLO_AI_MAX_RETRIES: "0" });
  const out = await chat([{ role: "user", content: "hi" }], { config: r.config });
  assert.equal(out.output, "ok");
  assert.equal(last.url, "/v1/chat/completions");
  assert.equal(last.auth, undefined);
  assert.equal(last.body.model, "llama3.2");
});

test("LiteLLM-style gateway via custom: bearer sent, key never in status", async () => {
  const { resolveAIConfig, chat, aiStatus } = await P();
  const env = { HELLO_AI_PROVIDER: "custom", HELLO_AI_BASE_URL: base + "/", HELLO_AI_API_KEY: "sk-litellm-test", HELLO_AI_MODEL: "ollama/llama3.2", HELLO_AI_MAX_RETRIES: "0" };
  assert.equal(resolveAIConfig({ ...env, HELLO_AI_API_KEY: "" }).ok, false, "custom still needs a key");
  const r = resolveAIConfig(env);
  await chat([{ role: "user", content: "hi" }], { config: r.config });
  assert.equal(last.auth, "Bearer sk-litellm-test");
  assert.equal(JSON.stringify(aiStatus(env)).includes("sk-litellm-test"), false);
});
