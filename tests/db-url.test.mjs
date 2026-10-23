// DATABASE_URL resolution for `npm start` (standalone cwd) and the DB_UNAVAILABLE answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDatabaseUrl, projectRoot, fileDbProblem, dbUnavailableResponse } from "../src/lib/db-config.ts";

const root = "/srv/app";
const cases = [
  ["file:./db/custom.db", root, "file:/srv/app/prisma/db/custom.db"],
  ["file:./db/custom.db", `${root}/.next/standalone`, "file:/srv/app/prisma/db/custom.db"],
  ["file:./db/custom.db", `${root}/.next/standalone/`, "file:/srv/app/prisma/db/custom.db"],
  ["file:db/x.db?connection_limit=1", `${root}/.next/standalone`, "file:/srv/app/prisma/db/x.db?connection_limit=1"],
  ["file:../data/x.db", root, "file:/srv/app/data/x.db"],
  ["file:/abs/x.db", `${root}/.next/standalone`, "file:/abs/x.db"],
  ["libsql://db-org.turso.io", root, "libsql://db-org.turso.io"],
  [undefined, root, undefined],
  ["", root, ""],
];

test("relative file: URLs resolve against <project root>/prisma, also from .next/standalone", () => {
  for (const [url, cwd, want] of cases) assert.equal(resolveDatabaseUrl(url, cwd), want, `${url} @ ${cwd}`);
  assert.equal(projectRoot("/a/b/.next/standalone"), "/a/b");
  assert.equal(projectRoot("/a/b"), "/a/b");
});

test("db.ts inlined copy matches db-config", async () => {
  process.env.DATABASE_URL ||= "file:/tmp/hello-dburl-unused.db";
  const { resolveDatabaseUrl: inlined, db } = await import("../src/lib/db.ts");
  for (const [url, cwd, want] of cases) assert.equal(inlined(url, cwd), want, `${url} @ ${cwd}`);
  await db.$disconnect();
});

test("fileDbProblem: missing file, empty file, ok file, non-file modes", () => {
  const dir = mkdtempSync(join(tmpdir(), "hello-dburl-"));
  mkdirSync(join(dir, "prisma", "db"), { recursive: true });
  const missing = fileDbProblem("file:./db/none.db", dir);
  assert.match(missing, /does not exist/); assert.match(missing, /prisma db push/);
  assert.ok(missing.includes(join(dir, "prisma", "db", "none.db")));
  writeFileSync(join(dir, "prisma", "db", "empty.db"), "");
  assert.match(fileDbProblem("file:./db/empty.db", join(dir, ".next", "standalone")), /empty/);
  writeFileSync(join(dir, "prisma", "db", "ok.db"), "SQLite format 3\0");
  assert.equal(fileDbProblem("file:./db/ok.db", join(dir, ".next", "standalone")), null);
  assert.equal(fileDbProblem("libsql://x.turso.io", dir), null);
  assert.equal(fileDbProblem("", dir), null);
});

test("DB_UNAVAILABLE response is 503 JSON with the fix", async () => {
  const r = dbUnavailableResponse("The database file /x does not exist. Run: npx prisma db push");
  assert.equal(r.status, 503);
  assert.equal(r.headers.get("content-type"), "application/json");
  const j = await r.json();
  assert.equal(j.error, "DB_UNAVAILABLE"); assert.match(j.message, /prisma db push/);
});
