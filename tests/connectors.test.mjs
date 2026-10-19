import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { assertReadOnlySelect, readOnlyQuery, reflectSchema } from "../src/lib/mcp/connectors/sql.ts";
import { schemaFingerprint, diffSchemas } from "../src/lib/mcp/connectors/fingerprint.ts";
import { githubRead, githubUrl } from "../src/lib/mcp/connectors/github.ts";
import { reflectOpenApi } from "../src/lib/mcp/connectors/openapi.ts";
import { verifySignature, signPayload, transpileWebhook, handleWebhook } from "../src/lib/mcp/connectors/webhook.ts";
import { createAgentCard } from "../src/lib/a2a-card.ts";

// Minimal Prisma-compatible adapter over a real in-memory SQLite database.
function sqliteClient() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE Agent (id TEXT PRIMARY KEY, name TEXT NOT NULL, privateKeyHex TEXT);
          CREATE TABLE Skill (id INTEGER PRIMARY KEY, title TEXT);`);
  const ins = d.prepare("INSERT INTO Agent VALUES (?, ?, ?)");
  for (let i = 0; i < 300; i++) ins.run(`a${i}`, `agent ${i}`, "secret");
  return { raw: d, $queryRawUnsafe: async (q) => d.prepare(q).all() };
}

test("SELECT guard rejects writes, multi-statements and non-SELECT", () => {
  for (const bad of ["DELETE FROM Agent", "select 1; drop table Agent", "UPDATE Agent SET name='x'", "PRAGMA table_info(Agent)", "WITH x AS (SELECT 1) INSERT INTO Skill VALUES (1,'a')", "ATTACH DATABASE 'x' AS y", "SELECT * INTO t FROM Agent", ""]) {
    assert.throws(() => assertReadOnlySelect(bad), undefined, bad);
  }
  assert.equal(assertReadOnlySelect("select 'drop; table' as s;"), "select 'drop; table' as s");
  assert.ok(assertReadOnlySelect("WITH t AS (SELECT 1 AS n) SELECT n FROM t -- comment"));
});

test("read-only query caps rows and reports truncation", async () => {
  const db = sqliteClient();
  const r = await readOnlyQuery(db, "SELECT id, name FROM Agent ORDER BY id", 1000);
  assert.equal(r.limit, 200);
  assert.equal(r.rows.length, 200);
  assert.equal(r.truncated, true);
  const small = await readOnlyQuery(db, "SELECT count(*) AS n FROM Agent");
  assert.deepEqual(small.rows, [{ n: 300 }]);
  assert.equal(small.truncated, false);
  await assert.rejects(readOnlyQuery(db, "DELETE FROM Agent"));
  await assert.rejects(readOnlyQuery(db, "SELECT privateKeyHex AS k FROM Agent"), /secret-bearing/);
  const star = await readOnlyQuery(db, "SELECT * FROM Agent", 2);
  assert.equal(star.rows[0].privateKeyHex, "[redacted]");
  assert.equal(JSON.stringify(star).includes("secret"), false);
  assert.equal(db.raw.prepare("SELECT count(*) AS n FROM Agent").get().n, 300);
});

test("schema reflection + SHA-256 fingerprint detects drift", async () => {
  const db = sqliteClient();
  const before = await reflectSchema(db, "sqlite");
  assert.deepEqual(before.map((t) => t.name), ["Agent", "Skill"]);
  assert.deepEqual(before[0].columns.find((c) => c.name === "id"), { name: "id", type: "TEXT", nullable: true, primaryKey: true });
  const fp1 = schemaFingerprint(before);
  assert.match(fp1.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(schemaFingerprint([...before].reverse()).fingerprint, fp1.fingerprint, "order independent");
  db.raw.exec("ALTER TABLE Skill ADD COLUMN price REAL");
  const after = await reflectSchema(db, "sqlite");
  assert.notEqual(schemaFingerprint(after).fingerprint, fp1.fingerprint);
  assert.deepEqual(diffSchemas(before, after), { added: [], removed: [], changed: ["Skill"] });
});

test("GitHub connector is GET-only, validates names, never leaks the token", async () => {
  assert.throws(() => githubUrl("repo", "bad/owner", "x"));
  assert.equal(githubUrl("pulls", "o", "r", { state: "bogus", perPage: 999 }), "https://api.github.com/repos/o/r/pulls?state=open&per_page=50");
  const calls = [];
  const fake = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, headers: { get: () => "59" }, json: async () => [{ number: 1, title: "Bug", state: "open", user: { login: "u" }, html_url: "h", labels: [{ name: "bug" }] }, { number: 2, title: "PR", pull_request: {}, labels: [] }] };
  };
  const r = await githubRead({ resource: "issues", owner: "o", repo: "r" }, fake, "ghp_SECRET");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.Authorization, "Bearer ghp_SECRET");
  assert.deepEqual(r.data.map((i) => i.number), [1], "PRs filtered out of issues");
  assert.equal(JSON.stringify(r).includes("ghp_SECRET"), false);
  const anon = await githubRead({ resource: "repo", owner: "o", repo: "r" }, async (u, i) => { assert.equal(i.headers.Authorization, undefined); return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) }; }, undefined);
  assert.equal(anon.status, 404);
});

const spec = {
  openapi: "3.0.3", info: { title: "Pets", version: "1" },
  components: { schemas: { Pet: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  paths: {
    "/pets/{id}": { parameters: [{ name: "id", in: "path", schema: { type: "integer" } }], get: { operationId: "getPet", summary: "Get a pet" }, delete: { operationId: "deletePet" } },
    "/pets": { get: { parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }] }, post: { operationId: "createPet", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } } } } },
  },
};

test("OpenAPI reflector emits read tools; writes excluded or approval-gated", () => {
  const r = reflectOpenApi(spec, { prefix: "pets" });
  assert.deepEqual(r.tools.map((t) => t.name).sort(), ["pets.getPet", "pets.get_pets"]);
  assert.equal(r.skipped.length, 2);
  const get = r.tools.find((t) => t.name === "pets.getPet");
  assert.deepEqual(get.inputSchema.required, ["id"]);
  assert.equal(get.annotations.enabled, true);
  const w = reflectOpenApi(JSON.stringify(spec), { includeWrites: true });
  const create = w.tools.find((t) => t.name === "createPet");
  assert.deepEqual(create.inputSchema.properties.body.required, ["name"], "$ref resolved");
  assert.equal(create.annotations.requiresApproval, true);
  assert.equal(create.annotations.enabled, false);
  assert.equal(w.tools.find((t) => t.name === "deletePet").annotations.destructiveHint, true);
  assert.throws(() => reflectOpenApi({ swagger: "2.0" }));
});

test("webhook HMAC verification and intent mapping", () => {
  const body = JSON.stringify({ action: "opened", repository: { full_name: "o/r" }, pull_request: { number: 7, title: "Add X", html_url: "u" } });
  const sig = signPayload("s3cret", body);
  assert.equal(verifySignature("s3cret", body, sig), true);
  assert.equal(verifySignature("s3cret", body + " ", sig), false);
  assert.equal(verifySignature("other", body, sig), false);
  assert.equal(verifySignature("s3cret", body, null), false);
  assert.equal(verifySignature(undefined, body, sig), false);
  assert.equal(handleWebhook(undefined, body, sig, "pull_request")[0], 503);
  assert.equal(handleWebhook("s3cret", body, "sha256=00", "pull_request")[0], 401);
  const [status, out] = handleWebhook("s3cret", body, sig, "pull_request");
  assert.equal(status, 200);
  assert.equal(out.intent.kind, "pull_request.opened");
  assert.equal(out.intent.executed, false);
  assert.equal(transpileWebhook("workflow_run", { workflow_run: { name: "CI", status: "completed", conclusion: "failure", head_branch: "main" } }).kind, "ci.failure");
});

test("agent card advertises connectors with no write tools", () => {
  const card = createAgentCard("https://example.test/");
  assert.equal(card["x-hello-connectors"].webhookIntake, "https://example.test/api/integrations/webhook");
  assert.deepEqual(card["x-hello-connectors"].writeTools, []);
  assert.equal(JSON.stringify(card).toLowerCase().includes("privatekey"), false);
});

test("live status checks are real and never echo secrets", async () => {
  const { runStatusChecks } = await import("../src/lib/integrations/status.ts");
  const ok = await runStatusChecks({
    env: { GITHUB_TOKEN: "ghp_TOPSECRET", HELLO_WEBHOOK_SECRET: "whsec_X", DATABASE_URL: "file:x" },
    fetchImpl: async () => new Response(JSON.stringify({ tools: [{ name: "connector.sql.query" }, { name: "forge.x" }] })),
    countTables: async () => 30,
  });
  const by = Object.fromEntries(ok.checks.map((c) => [c.id, c]));
  assert.equal(by.mcp.state, "connected");
  assert.equal(by.mcp.detail, "1 connector tool(s) listed");
  assert.equal(by.db.detail, "30 table(s) reflected");
  assert.equal(by["github-token"].state, "configured");
  assert.equal(JSON.stringify(ok).includes("TOPSECRET") || JSON.stringify(ok).includes("whsec_X"), false);
  const down = await runStatusChecks({ env: {}, fetchImpl: async () => { throw new Error("ECONNREFUSED"); }, countTables: async () => { throw new Error("no db"); } });
  const d = Object.fromEntries(down.checks.map((c) => [c.id, c.state]));
  assert.deepEqual(d, { mcp: "unreachable", db: "not-configured", "github-token": "not-configured", "webhook-secret": "not-configured" });
});
