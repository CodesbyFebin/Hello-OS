// DATABASE_URL=file:/tmp/hello-e2.db npm run test:consensus
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { argue, closeDebate, openDebate, vote } from "../src/lib/consensus.ts";
import { requestReallocation } from "../src/lib/treasury.ts";
import { decide } from "../src/lib/gate.ts";

after(() => db.$disconnect());
const mk = (name, reputation, balance = 100) => db.agent.create({ data: { did: `did:key:${name}-${Date.now()}-${Math.random()}`, name, tagline: "t", avatar: "a", reputation, wallet: { create: { balance, dailyCap: 60 } } } });

test("debate: voting needs both sides argued, reputation-weighted, quorum enforced", async () => {
  const [sec, ops, jr] = await Promise.all([mk("Skeptic-Sec", 90), mk("Operator-Speed", 40), mk("Junior", 10)]);
  try {
    const d = await openDebate(sec.id, "Adopt schema v2", 100);
    await argue(d.id, ops.id, "for", "Faster queries");
    await assert.rejects(vote(d.id, ops.id, "for"), /both sides/);
    await argue(d.id, sec.id, "against", "Migration lacks rollback");
    await vote(d.id, ops.id, "for"); await vote(d.id, jr.id, "for"); await vote(d.id, sec.id, "against");
    await assert.rejects(vote(d.id, jr.id, "against"));
    const closed = await closeDebate(d.id);
    assert.equal(closed.status, "rejected", "90 against beats 50 for");
    const d2 = await openDebate(sec.id, "tiny", 500);
    await argue(d2.id, ops.id, "for", "a"); await argue(d2.id, sec.id, "against", "b"); await vote(d2.id, sec.id, "for");
    assert.equal((await closeDebate(d2.id)).status, "no_quorum");
  } finally { await db.debate.deleteMany({ where: { proposerId: sec.id } }); await db.agent.deleteMany({ where: { id: { in: [sec.id, ops.id, jr.id] } } }); }
});

test("treasury: small moves execute, large ones queue for approval, kill switch blocks, caps apply", async () => {
  await db.operatorControl.upsert({ where: { id: "singleton" }, update: { killSwitch: false, approvalThreshold: 25 }, create: { id: "singleton" } });
  const [a, b] = await Promise.all([mk("A", 50, 100), mk("B", 50, 0)]);
  const bal = async (x) => (await db.wallet.findUnique({ where: { agentId: x.id } })).balance;
  try {
    const small = await requestReallocation(a.id, b.id, 10, "t");
    assert.equal(small.pending, false); assert.equal(await bal(b), 10); assert.equal(await bal(a), 90);
    const big = await requestReallocation(a.id, b.id, 40, "t");
    assert.equal(big.pending, true); assert.equal(await bal(b), 10);
    const r = await decide(big.approvalId, "approve", "test");
    assert.equal(r.approval.status, "executed"); assert.equal(await bal(b), 50);
    const over = await requestReallocation(a.id, b.id, 20, "t"); // daily cap 60 already used 50
    assert.equal(over.ok, false);
    await db.operatorControl.update({ where: { id: "singleton" }, data: { killSwitch: true } });
    assert.equal((await requestReallocation(b.id, a.id, 1, "t")).status, 423);
  } finally { await db.operatorControl.update({ where: { id: "singleton" }, data: { killSwitch: false } }); await db.agent.deleteMany({ where: { id: { in: [a.id, b.id] } } }); }
});
