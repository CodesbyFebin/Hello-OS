// Offline tests for the optional Google Stax format adapter. No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv, toCsv, exportSuiteCsv, importStaxCsv, expectedFromGrader, STAX_DATASET_COLUMNS } from "../src/lib/eval/stax.ts";
import { CORE_SUITE } from "../src/lib/eval/suites.ts";
import { runSuite, fixtureModel, summarize } from "../src/lib/eval/core.ts";

const good = JSON.parse(readFileSync("tests/fixtures/eval/good.json", "utf8"));
const cand = { id: "fixture:good", revision: "t", promptVersion: "1", provider: "fixture", model: "fixture/good", config: { offline: true } };

test("CSV round-trip keeps quotes, commas and newlines", () => {
  const rows = [["a", 'he said "hi"', "x,y", "line1\nline2"], ["", "2", "", ""]];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv("\uFEFFa\n"), [["a"]]);
  assert.throws(() => parseCsv('"open'), /unterminated/);
});

test("suite export has Stax dataset columns, one row per case, grader kept verbatim", () => {
  const rows = parseCsv(exportSuiteCsv(CORE_SUITE));
  assert.deepEqual(rows[0], [...STAX_DATASET_COLUMNS]);
  assert.equal(rows.length, CORE_SUITE.cases.length + 1);
  const plan = rows.find((r) => r[4] === "plan-steps");
  assert.equal(plan[1], CORE_SUITE.cases[0].input);
  assert.deepEqual(JSON.parse(plan[6]), CORE_SUITE.cases[0].grader);
  assert.equal(plan[3], ""); assert.equal(plan[7], "");
  assert.equal(expectedFromGrader({ kind: "exact", value: "v" }), "v");
  assert.match(expectedFromGrader({ kind: "json-keys", keys: ["a"] }), /keys: a/);
});

test("run export includes outputs and HELLO pass/fail; refuses a run from another suite version", async () => {
  const run = await runSuite(CORE_SUITE, cand, fixtureModel(good));
  const rows = parseCsv(exportSuiteCsv(CORE_SUITE, { run, outputs: good }));
  const json = rows.find((r) => r[4] === "json-task");
  assert.equal(json[3], good["json-task"]); assert.equal(json[7], "true");
  assert.throws(() => exportSuiteCsv({ ...CORE_SUITE, version: "9" }, { run }), /suiteHash mismatch/);
});

test("import maps a Stax chat export to case ids as advisory annotations", () => {
  const r = importStaxCsv(readFileSync("tests/fixtures/stax/chat-export.csv", "utf8"), CORE_SUITE);
  assert.equal(r.advisory, true);
  assert.equal(r.annotations.length, 2);
  const [plan, secret] = r.annotations;
  assert.equal(plan.caseId, "plan-steps"); assert.equal(plan.humanEvaluation, 1); assert.equal(plan.llmEvaluations.TextQuality.score, 1);
  assert.equal(secret.caseId, "secret-refusal"); assert.equal(secret.humanEvaluation, -1); assert.ok(secret.llmEvaluations._unparsed);
  assert.deepEqual(r.unmatched.map((u) => u.row), [4]);
});

test("import prefers hello_case_id from our own export; rejects non-Stax CSV", () => {
  const csv = exportSuiteCsv(CORE_SUITE).replace(CORE_SUITE.cases[1].input, "edited in Stax");
  const r = importStaxCsv(csv, CORE_SUITE);
  assert.equal(r.annotations.length, CORE_SUITE.cases.length);
  assert.ok(r.annotations.some((a) => a.caseId === "json-task"));
  assert.throws(() => importStaxCsv("foo,bar\n1,2\n", CORE_SUITE), /no "input" column/);
});

test("Stax ratings never change HELLO results", async () => {
  const run = await runSuite(CORE_SUITE, cand, fixtureModel(good));
  const before = JSON.stringify(run);
  importStaxCsv(readFileSync("tests/fixtures/stax/chat-export.csv", "utf8"), CORE_SUITE);
  assert.equal(JSON.stringify(run), before);
  assert.deepEqual(summarize(run.results), run.summary);
});

test("adapter has no network or dependency imports", () => {
  const src = readFileSync("src/lib/eval/stax.ts", "utf8") + readFileSync("scripts/stax.mjs", "utf8");
  assert.doesNotMatch(src, /fetch\(|https?:\/\/(?!github\.com\/google-labs-code)|from "(?!\.|node:)[^"]+"/);
});
