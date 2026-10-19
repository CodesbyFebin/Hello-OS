import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { STEPS, LAYERS, PHASES, PIPELINE } from "../src/lib/roadmap/steps.ts";
import { resolveStatus, parseEvidence, fetchEvidence } from "../src/lib/roadmap/github.ts";

test("100 steps, numbered 1-100, 10 per phase, every phase on exactly one layer", () => {
  assert.equal(STEPS.length, 100);
  assert.deepEqual(STEPS.map((s) => s.n), Array.from({ length: 100 }, (_, i) => i + 1));
  assert.equal(PHASES.length, 10);
  assert.equal(LAYERS.length, 7);
  assert.deepEqual(LAYERS.flatMap((l) => l.phases).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const s of STEPS) assert.ok(LAYERS.find((l) => l.id === s.layer).phases.includes(s.phase), `step ${s.n} layer`);
  assert.deepEqual(PIPELINE.map((p) => p.label), ["Intent", "Policy", "Execution", "Evidence", "Verified"]);
});

test("every shipped step cites paths that exist on this branch; in-pr steps cite a PR", () => {
  for (const s of STEPS) {
    if (s.status === "shipped") {
      assert.ok(s.paths?.length, `step ${s.n} needs evidence paths`);
      for (const p of s.paths) assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), `step ${s.n}: missing ${p}`);
    }
    if (s.status === "in-pr") assert.ok(Number.isInteger(s.pr), `step ${s.n} needs a PR`);
  }
});

test("no invented metrics in roadmap data", () => {
  const blob = JSON.stringify(STEPS) + JSON.stringify(PIPELINE);
  for (const bad of ["0.3ms", "47ms", "284B", "847", "50ms", "Apache 2.0", "3/3", "100%", "100,000"]) assert.equal(blob.includes(bad), false, bad);
});

test("PR state upgrades in-pr steps and falls back gracefully", async () => {
  const step = { n: 1, phase: 1, layer: "hub", title: "x", status: "in-pr", pr: 5 };
  const { prs, events } = parseEvidence(
    [{ number: 5, title: "Gate", state: "closed", merged_at: "2026-10-20T00:00:00Z", html_url: "u5" }, { number: 6, title: "Sched", state: "closed", merged_at: null, closed_at: "2026-10-19T00:00:00Z", html_url: "u6" }],
    [{ sha: "abcdef123", html_url: "c", commit: { message: "Fix thing\n\nbody", committer: { date: "2026-10-21T00:00:00Z" } } }]);
  assert.equal(resolveStatus(step, prs).status, "shipped");
  assert.equal(resolveStatus({ ...step, pr: 6 }, prs).status, "planned");
  assert.equal(resolveStatus({ ...step, pr: 99 }, prs).status, "in-pr");
  assert.equal(resolveStatus({ ...step, status: "vision", pr: undefined }, prs).status, "vision");
  assert.deepEqual(events.map((e) => e.ref), ["abcdef1", "#5", "#6"]);
  assert.equal(events[0].label, "Fix thing");
  const down = await fetchEvidence("o/r", async () => { throw new Error("offline"); });
  assert.equal(down.source, "unavailable");
  assert.deepEqual(down.prs, {});
});
