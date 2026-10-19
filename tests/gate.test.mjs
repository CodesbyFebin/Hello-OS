// Approval gate: risk tiers, kill switch, queued approvals executing through the wallet.
// Run with a scratch DB: DATABASE_URL=file:/tmp/hello-gate.db npm run test:gate
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { classifyRisk, gate, decide } from "../src/lib/gate.ts";

after(() => db.$disconnect());

test("classifyRisk tiers", () => {
  assert.equal(classifyRisk("data.read", 999, 25), "low");
  assert.equal(classifyRisk("wallet.spend", 25, 25), "medium");
  assert.equal(classifyRisk("wallet.spend", 25.01, 25), "high");
  assert.equal(classifyRisk("skill.install", 0, 25), "medium");
  assert.equal(classifyRisk("external.send", 0, 25), "critical");
  assert.equal(classifyRisk("data.delete", 0, 25), "critical");
});

test("gate allows small spends, queues large ones, kill switch blocks; approval executes spend", async () => {
  await db.operatorControl.upsert({ where: { id: "singleton" }, update: { killSwitch: false, approvalThreshold: 25 }, create: { id: "singleton" } });
  const agent = await db.agent.create({ data: { did: `did:key:gate-${Date.now()}`, name: "GateTest", tagline: "t", avatar: "a", wallet: { create: { balance: 100, dailyCap: 80 } } } });
  try {
    assert.equal((await gate(agent.id, "wallet.spend", 10, {})).decision, "allow");
    const big = await gate(agent.id, "wallet.spend", 40, { agentId: agent.id, amount: 40, reason: "test" });
    assert.equal(big.decision, "pending");

    await db.operatorControl.update({ where: { id: "singleton" }, data: { killSwitch: true } });
    assert.equal((await gate(agent.id, "wallet.spend", 1, {})).decision, "blocked");
    await db.operatorControl.update({ where: { id: "singleton" }, data: { killSwitch: false } });

    const r = await decide(big.approvalId, "approve", "test-operator");
    assert.equal(r.ok && r.approval.status, "executed");
    const w = await db.wallet.findUnique({ where: { agentId: agent.id } });
    assert.equal(w.balance, 60);
    const again = await decide(big.approvalId, "approve", "test-operator");
    assert.equal(again.ok, false, "cannot execute twice");

    const ext = await gate(agent.id, "external.send", 0, {});
    const rx = await decide(ext.approvalId, "approve", "test-operator");
    assert.equal(rx.ok && rx.approval.status, "failed", "no executor for external.send");
    const logs = await db.auditLog.count({ where: { actor: agent.id } });
    assert.ok(logs >= 4);
  } finally {
    await db.agent.delete({ where: { id: agent.id } });
  }
});
