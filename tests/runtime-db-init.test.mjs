import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";

test("runtime startup initializes an empty SQLite database and leaves existing schema untouched", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hello-runtime-db-"));
  const url = `file:${join(dir, "hello.db")}`;
  try {
    const env = { ...process.env, DATABASE_URL: url };
    const script = "scripts/runtime-db-init.mjs";
    execFileSync(process.execPath, [script], { env, stdio: "pipe" });
    const client = createClient({ url });
    const first = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Agent'");
    assert.equal(first.rows.length, 1);
    await client.execute("CREATE TABLE startup_sentinel (id TEXT PRIMARY KEY)");
    execFileSync(process.execPath, [script], { env, stdio: "pipe" });
    const sentinel = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='startup_sentinel'");
    assert.equal(sentinel.rows.length, 1);
    client.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
