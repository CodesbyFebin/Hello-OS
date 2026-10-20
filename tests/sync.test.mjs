// Live sync: snapshot comes only from the DB; the SSE stream pushes changes.
// Run with a scratch DB: DATABASE_URL=file:/tmp/hello-sync.db npm run test:sync
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { buildSnapshot, snapshotStream, SEED_MARKER } from "../src/lib/sync.ts";

const TAG = `sync-test-${Date.now()}`;
async function cleanup() {
  await db.mission.deleteMany({ where: { title: { startsWith: TAG } } });
  await db.agent.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.auditLog.deleteMany({ where: { action: SEED_MARKER, detail: TAG } });
}
before(cleanup);
after(async () => { await cleanup(); await db.$disconnect(); });

async function readEvent(reader, dec, buf) {
  for (;;) {
    const i = buf.value.indexOf("\n\n");
    if (i >= 0) { const raw = buf.value.slice(0, i); buf.value = buf.value.slice(i + 2); if (raw.startsWith("event: snapshot")) return JSON.parse(raw.split("\ndata: ")[1]); continue; }
    const { value, done } = await reader.read();
    if (done) throw new Error("stream ended");
    buf.value += dec.decode(value, { stream: true });
  }
}

test("snapshot reflects DB state; seeded flag only with the seed marker", async () => {
  const before = await buildSnapshot(db);
  assert.equal(typeof before.version, "string");
  assert.equal(before.tracesPerHour.length, 12);
  assert.equal(before.counts.agents, await db.agent.count());
  const wasSeeded = before.seeded;
  if (!wasSeeded) {
    await db.auditLog.create({ data: { actor: "system", action: SEED_MARKER, detail: TAG } });
    assert.equal((await buildSnapshot(db)).seeded, true);
    await db.auditLog.deleteMany({ where: { action: SEED_MARKER, detail: TAG } });
    assert.equal((await buildSnapshot(db)).seeded, false);
  }
  assert.equal(JSON.stringify(before).includes("privateKeyHex"), false, "no key material in snapshot");
});

test("SSE stream pushes a new snapshot when a mission is created", async () => {
  const ac = new AbortController();
  const reader = snapshotStream(db, ac.signal, 200).getReader();
  const dec = new TextDecoder(); const buf = { value: "" };
  const first = await readEvent(reader, dec, buf);
  const agent = await db.agent.create({ data: { did: `did:key:${TAG}`, name: `${TAG}-poster`, tagline: "t", avatar: "x" } });
  await db.mission.create({ data: { title: `${TAG} mission`, description: "", posterId: agent.id, reward: 7 } });
  const next = await readEvent(reader, dec, buf);
  ac.abort();
  assert.notEqual(next.version, first.version);
  assert.equal(next.counts.missions, first.counts.missions + 1);
  assert.equal(next.counts.agents, first.counts.agents + 1);
  assert.equal(next.missions[0].title, `${TAG} mission`);
  assert.equal(next.missions[0].poster.name, `${TAG}-poster`);
});

