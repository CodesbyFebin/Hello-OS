// DATABASE_URL=file:/tmp/hello-e1.db npm run test:cache
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db.ts";
import { lookup, stats, store } from "../src/lib/semantic-cache.ts";
import { addDoc, search } from "../src/lib/knowledge.ts";

after(() => db.$disconnect());

test("cache: near-duplicate hits, unrelated misses, hit rate is counted from lookups", async () => {
  await db.cacheLookup.deleteMany({}); await db.cacheEntry.deleteMany({});
  assert.equal((await stats()).measuredHitRate, null);
  await store("How do I run Postgres in a Docker container?", "docker run -e POSTGRES_PASSWORD=x postgres:16");
  const near = await lookup("how do i run postgres in a docker container");
  assert.equal(near.hit, true);
  const far = await lookup("Explain the borrow checker in Rust");
  assert.equal(far.hit, false);
  const s = await stats();
  assert.deepEqual([s.lookups, s.hits, s.measuredHitRate], [2, 1, 0.5]);
});

test("knowledge: RBAC filters before ranking; admin sees all", async () => {
  await db.knowledgeDoc.deleteMany({}); await db.agentRole.deleteMany({});
  await addDoc("Payments DB credentials rotation", "Rotate the payments database password every 30 days", ["security"]);
  await addDoc("Payments API retry policy", "Retries use exponential backoff with idempotency keys", ["engineer"]);
  await db.agentRole.create({ data: { agentId: "eng", role: "engineer" } });
  await db.agentRole.create({ data: { agentId: "boss", role: "admin" } });
  const e = await search("eng", "payments database password");
  assert.equal(e.hidden, 1);
  assert.ok(e.results.every((r) => !r.title.includes("credentials")));
  assert.equal((await search("nobody", "payments")).visible, 0);
  assert.equal((await search("boss", "payments database password")).results[0].title, "Payments DB credentials rotation");
  await assert.rejects(addDoc("x", "y", ["root"]));
});