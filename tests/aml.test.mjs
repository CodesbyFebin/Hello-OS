import test from "node:test";
import assert from "node:assert/strict";
import { compileAml } from "../src/lib/aml.ts";

const sample = `mission optimize_sql {
  input: $query_id
  budget: 0.42 USDC
  steps {
    fetch: db.query($query_id) → $query
    if $query.valid {
      emit: verification_receipt
    } else {
      rollback: checkpoint("before")
    }
  }
}`;

test("compiles nested declarations into a deterministic, non-executable graph", () => {
  const first = compileAml(sample);
  const second = compileAml(sample);
  assert.equal(first.ok, true);
  assert.equal(first.executable, false);
  assert.equal(first.ast[0].kind, "mission");
  assert.equal(first.budgets[0].amount, 0.42);
  assert.equal(first.budgets[0].unit, "USDC");
  assert.ok(first.graph.length >= 3);
  assert.equal(first.sourceSha256, second.sourceSha256);
  assert.equal(first.graphSha256, second.graphSha256);
});

test("collects capability requirements and operation graph", () => {
  const result = compileAml(`capability deploy_app {
    requires: [build, deploy]
    flow {
      build($spec) → $artifact
      deploy($artifact) → $receipt
    }
  }`);
  assert.equal(result.ok, true);
  assert.deepEqual(result.requiredCapabilities, ["build", "deploy"]);
  assert.ok(result.graph.some((node) => node.operation === "build"));
});

test("accepts static model routing and bridge declarations without executing them", () => {
  const result = compileAml(`model_matrix universal_router {
    lane_fast: [local/llama, provider/model]
    policy {
      max_cost_per_step: 0.002 USD
    }
  }
  bridge external_agent {
    protocol: a2a
    identity: $agent_did
  }
  intent check($input) {
    route: universal_router.lane_fast → $answer
    quorum {
      proposer: local/llama
      auditor: provider/model
    }
  }`);
  assert.equal(result.ok, true);
  assert.equal(result.executable, false);
  assert.deepEqual(result.ast.map((node) => node.kind), ["model_matrix", "bridge", "intent"]);
});

test("reports unknown declarations and unterminated blocks", () => {
  const result = compileAml(`unknown thing {\n  emit: x\n`);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((d) => d.code === "AML001"));
  assert.ok(result.diagnostics.some((d) => d.code === "AML011" || d.code === "AML006"));
});

test("rejects malformed budgets and unterminated strings", () => {
  const result = compileAml(`mission bad {\n  budget: many credits\n  note: "unfinished\n}`);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((d) => d.code === "AML012"));
  assert.ok(result.diagnostics.some((d) => d.code === "AML007"));
});

test("enforces the bounded source size", () => {
  const result = compileAml(" ".repeat(64_001));
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((d) => d.code === "AML010"));
});
