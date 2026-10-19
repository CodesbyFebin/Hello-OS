// DATABASE_URL=file:/tmp/hello-d.db npm run test:snapshots
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { createSnapshot, resumeSnapshot } from "../src/lib/snapshots.ts";
import { ingest, parseLog, similar } from "../src/lib/failures.ts";

after(() => db.$disconnect());

test("snapshot seals, detects tampering, resumes missing memories without moving credits", async () => {
  const a = await db.agent.create({ data: { did: `did:key:snap-${Date.now()}`, name: "Snap", tagline: "t", avatar: "a", wallet: { create: { balance: 40 } }, memories: { create: [{ tier: "CORE", kind: "semantic", content: "schema v2 uses uuid keys" }] } } });
  try {
    const s = await createSnapshot(a.id, { step: 3 });
    assert.equal(s.doc.memories.length, 1);
    assert.equal(JSON.stringify(s.doc).includes("privateKeyHex"), false);
    const tampered = structuredClone(s.doc); tampered.task.step = 4;
    assert.equal((await resumeSnapshot(tampered, s.sha256)).status, 422);
    await db.memory.deleteMany({ where: { agentId: a.id } });
    await db.wallet.update({ where: { agentId: a.id }, data: { balance: 5 } });
    const r = await resumeSnapshot(s.doc, s.sha256);
    assert.equal(r.ok, true); assert.equal(r.restoredMemories, 1); assert.deepEqual(r.task, { step: 3 });
    assert.equal((await db.wallet.findUnique({ where: { agentId: a.id } })).balance, 5, "resume never moves credits");
    assert.equal((await resumeSnapshot(s.doc, s.sha256)).restoredMemories, 0, "idempotent");
  } finally { await db.agentSnapshot.deleteMany({ where: { agentId: a.id } }); await db.agent.delete({ where: { id: a.id } }); }
});

test("failure library parses tsc/test logs, dedupes recurrences, retrieves similar", async () => {
  const log = [
    "src/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.",
    "src/b.ts(10,1): error TS2322: Type 'boolean' is not assignable to type 'number'.",
    "not ok 2 - wallet spend respects daily cap",
    "  random noise line",
  ].join("\n");
  const parsed = parseLog(log);
  assert.equal(parsed.length, 2, "the two TS2322 lines normalise to one signature");
  await db.failureRecord.deleteMany({});
  await ingest(log); await ingest(log);
  const rows = await db.failureRecord.findMany();
  assert.equal(rows.length, 2); assert.ok(rows.every((r) => r.count === 2 && r.deadEnd));
  const m = await similar("error TS2322: Type 'Date' is not assignable to type 'number'");
  assert.ok(m[0].message.includes("TS2322"));
});
