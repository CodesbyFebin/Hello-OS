// npm run test:sandbox
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSnippet } from "../src/lib/sandbox.ts";

test("runs code and captures console.log", async () => {
  const r = await runSnippet("console.log('hi', 2); [1,2,3].map(x => x * 2)");
  assert.equal(r.ok, true); assert.deepEqual(r.result, [2, 4, 6]); assert.deepEqual(r.logs, ["hi 2"]);
});

test("infinite loop is interrupted by the deadline", async () => {
  const r = await runSnippet("while (true) {}", { timeoutMs: 200 });
  assert.equal(r.ok, false); assert.match(r.error, /interrupted/i); assert.ok(r.durationMs < 2000);
});

test("memory limit stops runaway allocation", async () => {
  const r = await runSnippet("let a = []; while (true) a.push('x'.repeat(1e5));", { memoryBytes: 2 * 1024 * 1024, timeoutMs: 3000 });
  assert.equal(r.ok, false); assert.match(r.error, /memory|interrupted/i);
});

test("no host access: require, process, fetch, fs, timers are absent", async () => {
  const r = await runSnippet("[typeof require, typeof process, typeof fetch, typeof setTimeout, typeof XMLHttpRequest, typeof globalThis.std, typeof globalThis.os]");
  assert.deepEqual(r.result, ["undefined", "undefined", "undefined", "undefined", "undefined", "undefined", "undefined"]);
  const imp = await runSnippet("import('fs')");
  assert.ok(!imp.ok || typeof imp.result !== "object" || imp.result === null || Object.keys(imp.result).length === 0);
});

test("syntax errors are reported, not thrown", async () => {
  const r = await runSnippet("function (");
  assert.equal(r.ok, false); assert.match(r.error, /SyntaxError/);
});
