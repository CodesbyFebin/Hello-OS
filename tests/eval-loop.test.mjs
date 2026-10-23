// Evaluation loop: offline, deterministic, no network or API keys.
// Run: DATABASE_URL=file:/tmp/hello-eval.db npm run test:eval
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const core = await import("../src/lib/eval/core.ts");
const { CORE_SUITE } = await import("../src/lib/eval/suites.ts");
const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/eval/${n}.json`, import.meta.url), "utf8"));
const cand = (over = {}) => ({ id: "c1", revision: "abc123", promptVersion: "1.0.0", provider: "fixture", model: "fixture/good", config: { offline: true }, ...over });
let tick = 0; const clock = () => 1_700_000_000_000 + (tick += 5);

after(async () => { const { db } = await import("../src/lib/db.ts"); await db.$disconnect(); });

test("deterministic fixtures produce repeatable results", async () => {
  const a = await core.runSuite(CORE_SUITE, cand(), core.fixtureModel(fx("good")));
  const b = await core.runSuite(CORE_SUITE, cand(), core.fixtureModel(fx("good")));
  const strip = (r) => r.results.map(({ latencyMs, ...x }) => x);
  assert.deepEqual(strip(a), strip(b));
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.summary.requiredPassed, a.summary.requiredTotal);
  assert.equal(a.summary.safetyViolations, 0);
  assert.equal(a.summary.tokens, null, "no usage reported by fixture -> null, not 0");
});

test("results are tied to the tested revision, configuration and suite content", async () => {
  const base = core.fingerprint(CORE_SUITE, cand());
  assert.notEqual(core.fingerprint(CORE_SUITE, cand({ revision: "def456" })), base);
  assert.notEqual(core.fingerprint(CORE_SUITE, cand({ model: "other" })), base);
  assert.notEqual(core.fingerprint(CORE_SUITE, cand({ config: { offline: true, temperature: 0.7 } })), base);
  const edited = { ...CORE_SUITE, cases: CORE_SUITE.cases.map((c, i) => (i === 0 ? { ...c, input: c.input + " " } : c)) };
  assert.notEqual(core.suiteHash(edited), core.suiteHash(CORE_SUITE));
  const a = await core.runSuite(CORE_SUITE, cand(), core.fixtureModel(fx("good")));
  const b = await core.runSuite(edited, cand(), core.fixtureModel(fx("good")));
  const cmp = core.compare(a, b);
  assert.equal(cmp.eligible, false);
  assert.match(cmp.reasons.join(), /different suite content/);
});

test("changing an unrelated gene vector cannot claim improved task quality", async () => {
  const { scoreGenes } = await import("../src/lib/evolution.ts");
  const lo = { reasoning: 0, coding: 0, memory: 0, collaboration: 0 };
  const hi = { reasoning: 0.72, coding: 0.72, memory: 0.72, collaboration: 0.72 };
  assert.ok(scoreGenes(hi, "balanced") > scoreGenes(lo, "balanced"), "simulation score moves");
  const base = await core.runSuite(CORE_SUITE, cand({ config: { genes: JSON.stringify(lo) } }), core.fixtureModel(fx("good")));
  const next = await core.runSuite(CORE_SUITE, cand({ config: { genes: JSON.stringify(hi) } }), core.fixtureModel(fx("good")));
  const cmp = core.compare(base, next);
  assert.deepEqual(cmp.improvements, [], "same task outputs -> no task improvement, whatever the gene score");
  assert.equal(next.summary.passed, base.summary.passed);
});

test("graders and safety checks", () => {
  assert.equal(core.grade({ kind: "json-keys", keys: ["a"] }, "x {\"a\":1} y"), true);
  assert.equal(core.grade({ kind: "json-keys", keys: ["a"] }, "{not json}"), false);
  assert.equal(core.grade({ kind: "contains", values: ["50", "H"] }, "50 h"), true);
  const c = CORE_SUITE.cases.find((x) => x.id === "credit-unit");
  assert.deepEqual(core.safety(c, "50 USDC"), ["credits must use the unit H"]);
  assert.throws(() => core.validateSuite({ id: "x", version: "1", system: "", cases: [] }));
});

test("failed or unsafe evaluations are never eligible; model errors count as failures", async () => {
  const unsafe = await core.runSuite(CORE_SUITE, cand({ model: "fixture/unsafe" }), core.fixtureModel(fx("unsafe")));
  assert.ok(unsafe.summary.safetyViolations >= 3);
  assert.equal(core.compare(null, unsafe).eligible, false);
  const broken = await core.runSuite(CORE_SUITE, cand(), core.fixtureModel({ ...fx("good"), "plan-steps": new Error("AI_TIMEOUT") }), clock);
  assert.equal(broken.results[0].error, "AI_TIMEOUT");
  assert.equal(core.compare(null, broken).eligible, false);
  const good = await core.runSuite(CORE_SUITE, cand(), core.fixtureModel(fx("good")));
  const regressed = await core.runSuite(CORE_SUITE, cand({ id: "c2" }), core.fixtureModel({ ...fx("good"), summarize: "nope" }));
  const cmp = core.compare(good, regressed);
  assert.equal(cmp.eligible, false, "optional-case regression still blocks");
  assert.deepEqual(cmp.regressions, ["summarize"]);
});

test("promotion: blocked when failing, needs named human approval, rollback restores", async () => {
  const store = await import("../src/lib/eval/store.ts");
  const { db } = await import("../src/lib/db.ts");
  await db.evalPromotion.deleteMany(); await db.evalRun.deleteMany();

  const bad = await store.saveRun(await core.runSuite(CORE_SUITE, cand({ id: "bad" }), core.fixtureModel(fx("unsafe"))));
  const rb = await store.requestPromotion(bad.id, "ci");
  assert.equal(rb.promotion.status, "blocked");
  const tryBad = await store.decidePromotion(rb.promotion.id, "alice", "approve");
  assert.equal(tryBad.ok, false); assert.equal(tryBad.status, 409);
  assert.equal(await store.currentChampion(CORE_SUITE.id), null);

  const good = await store.saveRun(await core.runSuite(CORE_SUITE, cand({ id: "good" }), core.fixtureModel(fx("good"))));
  const rg = await store.requestPromotion(good.id, "ci");
  assert.equal(rg.promotion.status, "pending");
  assert.equal(await store.currentChampion(CORE_SUITE.id), null, "eligible is not promoted");
  assert.equal((await store.decidePromotion(rg.promotion.id, "  ", "approve")).status, 400);
  const ok = await store.decidePromotion(rg.promotion.id, "alice", "approve");
  assert.equal(ok.ok, true); assert.equal(ok.promotion.approvedBy, "alice");
  assert.equal((await store.currentChampion(CORE_SUITE.id)).id, good.id);
  assert.equal((await store.decidePromotion(rg.promotion.id, "bob", "approve")).status, 409, "no double decision");

  const audit = await db.auditLog.findMany({ where: { action: { startsWith: "eval.promotion" } } });
  assert.ok(audit.some((a) => a.action === "eval.promotion.approve" && a.actor === "alice"));

  const rbk = await store.rollbackPromotion(rg.promotion.id, "alice");
  assert.equal(rbk.ok, true);
  assert.equal(await store.currentChampion(CORE_SUITE.id), null);
});

test("promotion routes fail closed without HELLO_OPERATOR_TOKEN", async () => {
  const { promotionAuthorized } = await import("../src/lib/eval/auth.ts");
  const req = (h = {}) => new Request("http://x/api/eval/promotions", { method: "POST", headers: h });
  assert.equal(promotionAuthorized(req(), {}), false, "dev-mode open access does not apply");
  assert.equal(promotionAuthorized(req({ "x-operator-token": "t" }), {}), false);
  assert.equal(promotionAuthorized(req({ "x-operator-token": "nope" }), { HELLO_OPERATOR_TOKEN: "t" }), false);
  assert.equal(promotionAuthorized(req({ "x-operator-token": "t" }), { HELLO_OPERATOR_TOKEN: "t" }), true);
  delete process.env.HELLO_OPERATOR_TOKEN;
  const { POST } = await import("../src/app/api/eval/promotions/route.ts");
  const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ runId: "x", requestedBy: "y" }) }));
  assert.equal(res.status, 401);
});
