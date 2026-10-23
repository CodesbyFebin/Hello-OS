// Run an evaluation suite and print the run record as JSON.
//   Offline (default, no network): node --experimental-strip-types --import ./tests/register.mjs scripts/eval-run.mjs
//     Uses tests/fixtures/eval/<candidate>.json as scripted replies. This checks the
//     harness and graders; it says nothing about any real model.
//   Live (opt-in): HELLO_EVAL_LIVE=1 plus HELLO_AI_* env. Calls the configured provider.
//   Add --save to store the run in DATABASE_URL.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const { runSuite, fixtureModel } = await import("../src/lib/eval/core.ts");
const { SUITES } = await import("../src/lib/eval/suites.ts");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const suite = SUITES[arg("--suite", "hello-core")];
if (!suite) { console.error("unknown suite"); process.exit(1); }
let revision = "unknown";
try { revision = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch {}
const live = process.env.HELLO_EVAL_LIVE === "1";
let model, candidate;
if (live) {
  const { resolveAIConfig, chat } = await import("../src/lib/ai/provider.ts");
  const r = resolveAIConfig();
  if (!r.ok) { console.error(`HELLO_EVAL_LIVE=1 but no provider: ${r.reason}`); process.exit(1); }
  model = async (messages) => chat(messages, { config: r.config, maxTokens: 256 });
  candidate = { id: arg("--candidate", "live"), revision, promptVersion: suite.version, provider: r.config.provider, model: r.config.model, config: { maxTokens: 256, temperature: 0 } };
} else {
  const name = arg("--candidate", "good");
  const replies = JSON.parse(readFileSync(new URL(`../tests/fixtures/eval/${name}.json`, import.meta.url), "utf8"));
  model = fixtureModel(replies);
  candidate = { id: `fixture:${name}`, revision, promptVersion: suite.version, provider: "fixture", model: `fixture/${name}`, config: { offline: true } };
}
const run = await runSuite(suite, candidate, model);
if (process.argv.includes("--save")) {
  const { saveRun } = await import("../src/lib/eval/store.ts");
  const row = await saveRun(run);
  run.savedId = row.id;
  const { db } = await import("../src/lib/db.ts"); await db.$disconnect();
}
console.log(JSON.stringify({ mode: live ? "live" : "offline-fixture", ...run }, null, 2));
