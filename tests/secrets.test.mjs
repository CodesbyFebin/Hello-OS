// Verifies agent private keys are never returned by default queries.
// Run: DATABASE_URL=file:/tmp/hello-secrets.db npx prisma db push --skip-generate && node --experimental-strip-types --test tests/secrets.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db.ts";

test("agent queries omit privateKeyHex unless explicitly requested", async () => {
  const did = `did:key:test-${Date.now()}`;
  const created = await db.agent.create({ data: { did, name: "SecretTest", tagline: "t", avatar: "a", privateKeyHex: "ab".repeat(32) } });
  try {
    assert.equal("privateKeyHex" in created, false, "create() result leaked key");
    const many = await db.agent.findMany({ where: { did } });
    assert.equal("privateKeyHex" in many[0], false, "findMany leaked key");
    const one = await db.agent.findUnique({ where: { did }, include: { wallet: true } });
    assert.equal("privateKeyHex" in one, false, "findUnique+include leaked key");
    const signer = await db.agent.findUnique({ where: { did }, omit: { privateKeyHex: false } });
    assert.equal(signer.privateKeyHex, "ab".repeat(32));
  } finally {
    await db.agent.delete({ where: { did } });
    await db.$disconnect();
  }
});

test("only signing routes opt in to key material", () => {
  const allowed = new Set(["a2a/route.ts", "attestations/route.ts", "observations/route.ts"]);
  const root = "src/app/api";
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8");
    const rel = f.slice(root.length + 1);
    if (/privateKeyHex:\s*(false|true)/.test(src.replace(/privateKeyHex:\s*km\.privateKeyHex/g, ""))) {
      assert.ok(allowed.has(rel), `${rel} opts in to privateKeyHex; review before allowing`);
    }
    assert.ok(!/NextResponse\.json\([^)]*privateKeyHex/.test(src), `${rel} returns privateKeyHex`);
  }
});
