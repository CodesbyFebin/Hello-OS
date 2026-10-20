// Turso / libSQL driver adapter.
// Default: applies prisma/turso/init.sql to a scratch file: DB and runs Prisma through the
// libSQL adapter (HELLO_DB_ADAPTER=libsql). Set HELLO_TEST_LIBSQL_URL (e.g. libsql://127.0.0.1:8080?tls=0
// from `turso dev` or sqld) to run the same checks against a libSQL server; the DB must be empty.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dbMode, isDbConfigured, DB_FREE_API_PATHS } from "../src/lib/db-config.ts";

test("dbMode picks the driver from DATABASE_URL", () => {
  assert.equal(dbMode("libsql://hello-os-me.turso.io"), "libsql");
  assert.equal(dbMode("file:./db/custom.db"), "file");
  assert.equal(dbMode(""), "missing");
  assert.equal(isDbConfigured("  "), false);
  assert.ok(DB_FREE_API_PATHS.has("/api/aml/validate"));
  assert.ok(!DB_FREE_API_PATHS.has("/api/sync"));
});

test("proxy and /api/sync answer 503 DB_NOT_CONFIGURED without DATABASE_URL", async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const { proxy } = await import("../src/proxy.ts");
    const mk = (p) => ({ nextUrl: new URL(`http://x${p}`) });
    const r = proxy(mk("/api/agents"));
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, "DB_NOT_CONFIGURED");
    assert.notEqual(proxy(mk("/api/aml/validate")).status, 503);
    // Separate process so this module graph's cached Prisma client doesn't leak into the next test.
    const code = 'const { GET } = await import("./src/app/api/sync/route.ts"); const r = await GET(new Request("http://x/api/sync?once=1")); console.log(r.status, (await r.json()).error);';
    const env = { ...process.env }; delete env.DATABASE_URL;
    const out = execFileSync(process.execPath, ["--experimental-strip-types", "--import", "./tests/register.mjs", "--input-type=module", "-e", code], { env, encoding: "utf8" });
    assert.match(out, /503 DB_NOT_CONFIGURED/);
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL = saved;
  }
});

const remote = process.env.HELLO_TEST_LIBSQL_URL;
const url = remote || `file:${join(mkdtempSync(join(tmpdir(), "hello-turso-")), "t.db")}`;
let db;
after(async () => { await db?.$disconnect(); });

test(`schema applies and Prisma reads/writes through the libSQL adapter (${remote ? "server" : "file"})`, async () => {
  execFileSync(process.execPath, ["scripts/turso-apply.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  // A second apply must refuse (non-empty DB).
  assert.throws(() => execFileSync(process.execPath, ["scripts/turso-apply.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" }));

  process.env.DATABASE_URL = url;
  if (!remote) process.env.HELLO_DB_ADAPTER = "libsql";
  ({ db } = await import("../src/lib/db.ts"));
  assert.ok(db._engineConfig?.adapter, "client was built with the libSQL driver adapter");
  const a = await db.agent.create({ data: { did: `did:key:zTurso${Date.now()}`, name: "turso-test", tagline: "t", avatar: "t", privateKeyHex: "00", publicKeyHex: "00" } });
  const m = await db.mission.create({ data: { title: "turso-mission", description: "d", posterId: a.id, reward: 2.5 } });
  const got = await db.mission.findUnique({ where: { id: m.id }, include: { poster: true } });
  assert.equal(got.poster.name, "turso-test");
  assert.equal(got.reward, 2.5);
  assert.ok(got.createdAt instanceof Date);
  const hidden = await db.agent.findUnique({ where: { id: a.id } });
  assert.equal(hidden.privateKeyHex, undefined, "privateKeyHex stays omitted");
  await db.$transaction([db.mission.delete({ where: { id: m.id } }), db.agent.delete({ where: { id: a.id } })]);
  const { buildSnapshot } = await import("../src/lib/sync.ts");
  const snap = await buildSnapshot(db);
  assert.equal(typeof snap.version, "string");
});
