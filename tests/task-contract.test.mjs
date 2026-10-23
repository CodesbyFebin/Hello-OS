import test from "node:test";
import assert from "node:assert/strict";
import { validateTaskContract } from "../src/lib/task-contract.ts";
import * as route from "../src/app/api/hello/tasks/validate/route.ts";

const valid = {
  schema: "hello.task/v1",
  goal: "Compile and validate an AML source file.",
  scope: { include: ["read the provided source", "return compiler diagnostics"], exclude: ["execute AML", "write files"] },
  capabilities: ["aml.compile"],
  constraints: ["Do not execute source code."],
  success: { kind: "measurable", criteria: ["Return a valid response shape and diagnostics."] },
  failureCriteria: ["Reject malformed source or unknown symbols."],
  budgets: {
    tokens: { perStep: 4096, total: 16384 },
    toolCalls: { perStep: 2, total: 8 },
    wallClockSeconds: { perStep: 10, total: 60 },
  },
  approval: "required",
  termination: { onSuccess: "report", onFailure: "escalate", onTimeout: "fail" },
};

test("validates a bounded contract without making it executable", () => {
  const result = validateTaskContract(valid);
  assert.equal(result.valid, true);
  assert.equal(result.executable, false);
  assert.equal(result.contract.schema, "hello.task/v1");
  assert.match(result.contractHash, /^[0-9a-f]{64}$/);
  assert.deepEqual(result.diagnostics, []);
});

test("contract hash is stable across object-key ordering", () => {
  const reversed = Object.fromEntries(Object.entries(valid).reverse());
  assert.equal(validateTaskContract(valid).contractHash, validateTaskContract(reversed).contractHash);
});

test("rejects scope conflicts, inconsistent budgets, and unknown fields", () => {
  const invalid = structuredClone(valid);
  invalid.scope.exclude.push(invalid.scope.include[0]);
  invalid.budgets.tokens = { perStep: 500, total: 100 };
  invalid.extra = "ignored data must not be silently accepted";
  const result = validateTaskContract(invalid);
  assert.equal(result.valid, false);
  assert.equal(result.executable, false);
  assert.ok(result.diagnostics.some((d) => d.code === "CONTRACT_SCOPE_CONFLICT"));
  assert.ok(result.diagnostics.some((d) => d.code === "CONTRACT_BUDGET_ORDER"));
  assert.ok(result.diagnostics.some((d) => d.code === "CONTRACT_UNKNOWN_FIELD"));
});

test("rejects malformed capability names and out-of-range limits", () => {
  const invalid = structuredClone(valid);
  invalid.capabilities = ["Shell exec"];
  invalid.budgets.toolCalls.perStep = 10001;
  const result = validateTaskContract(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((d) => d.code === "CONTRACT_CAPABILITY_NAME"));
  assert.ok(result.diagnostics.some((d) => d.path === "$.budgets.toolCalls.perStep"));
  assert.equal(result.contractHash, undefined);
});

test("rejects duplicate capability declarations", () => {
  const invalid = structuredClone(valid);
  invalid.capabilities = ["memory.read", "MEMORY.READ"];
  const result = validateTaskContract(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((d) => d.code === "CONTRACT_DUPLICATE"));
});

test("HTTP validator returns a static validation result and rejects malformed JSON", async () => {
  const validResponse = await route.POST(new Request("http://localhost/api/hello/tasks/validate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(valid),
  }));
  assert.equal(validResponse.status, 200);
  const result = await validResponse.json();
  assert.equal(result.executable, false);
  assert.equal(result.contractHash, validateTaskContract(valid).contractHash);

  const invalidResponse = await route.POST(new Request("http://localhost/api/hello/tasks/validate", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{",
  }));
  assert.equal(invalidResponse.status, 400);

  const largeResponse = await route.POST(new Request("http://localhost/api/hello/tasks/validate", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "33000" },
    body: "{}",
  }));
  assert.equal(largeResponse.status, 413);
});
