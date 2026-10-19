// Run with a scratch DB: DATABASE_URL=file:/tmp/hello-sched.db npm run test:scheduler
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { tick } from "../src/lib/scheduler.ts";
import { delegate, recall, tree } from "../src/lib/delegation.ts";

after(() => db.$disconnect());

test("tick runs only due jobs, once, and reschedules", async () => {
  const now = new Date();
  const due = await db.scheduledJob.create({ data: { name: "hb", kind: "heartbeat", intervalSec: 60, nextRunAt: new Date(now.getTime() - 1000) } });
  const later = await db.scheduledJob.create({ data: { name: "audit", kind: "wallet.audit", intervalSec: 60, nextRunAt: new Date(now.getTime() + 600000) } });
  const bad = await db.scheduledJob.create({ data: { name: "bad", kind: "nope", intervalSec: 60, nextRunAt: new Date(now.getTime() - 1000) } });
  try {
    const r = await tick(now);
    const ids = r.results.map((x) => x.jobId);
    assert.ok(ids.includes(due.id) && ids.includes(bad.id) && !ids.includes(later.id));
    assert.equal(r.results.find((x) => x.jobId === bad.id).ok, false);
    const again = await tick(now);
    assert.ok(!again.results.some((x) => x.jobId === due.id), "not run twice in same window");
    const j = await db.scheduledJob.findUnique({ where: { id: due.id } });
    assert.equal(j.runCount, 1);
    assert.equal(j.nextRunAt.getTime(), now.getTime() + 60000);
  } finally {
    await db.scheduledJob.deleteMany({ where: { id: { in: [due.id, later.id, bad.id] } } });
  }
});

test("delegation enforces parent balance, bounds child cap, recall returns unspent", async () => {
  const p = await db.agent.create({ data: { did: `did:key:dp-${Date.now()}`, name: "Parent", tagline: "t", avatar: "a", wallet: { create: { balance: 30, dailyCap: 50 } } } });
  const created = [p.id];
  try {
    const d1 = await delegate(p.id, { childName: "W1", creditCap: 20, task: "lint" });
    assert.equal(d1.ok, true); created.push(d1.childId);
    const cw = await db.wallet.findUnique({ where: { agentId: d1.childId } });
    assert.equal(cw.balance, 20); assert.equal(cw.dailyCap, 20);
    assert.equal((await db.wallet.findUnique({ where: { agentId: p.id } })).balance, 10);
    const d2 = await delegate(p.id, { childName: "W2", creditCap: 15 });
    assert.equal(d2.ok, false, "cannot over-allocate");
    // grandchild bounded by child's balance
    const g = await delegate(d1.childId, { childName: "G1", creditCap: 25 });
    assert.equal(g.ok, false);
    const g2 = await delegate(d1.childId, { childName: "G1", creditCap: 5 });
    assert.equal(g2.ok, true); created.push(g2.childId);
    const t = await tree(p.id);
    assert.equal(t.children[0].children[0].name, "G1");
    await db.wallet.update({ where: { agentId: d1.childId }, data: { balance: { decrement: 3 } } }); // child spent 3
    const r = await recall(d1.delegationId);
    assert.equal(r.ok && r.returned, 12);
    assert.equal((await db.wallet.findUnique({ where: { agentId: p.id } })).balance, 22);
  } finally {
    await db.delegation.deleteMany({ where: { parentId: { in: created } } });
    await db.agent.deleteMany({ where: { id: { in: created.reverse() } } });
  }
});
