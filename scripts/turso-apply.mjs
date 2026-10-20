// Applies prisma/turso/init.sql to the database in DATABASE_URL (libsql://, http(s)://, or file:).
// Usage: DATABASE_URL=libsql://<db>.turso.io TURSO_AUTH_TOKEN=... npm run db:turso:apply
// Refuses to run against a database that already has tables unless --force is given.
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set."); process.exit(1); }
const force = process.argv.includes("--force");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
const existing = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%'");
if (existing.rows.length && !force) {
  console.error(`Database already has ${existing.rows.length} table(s); not applying. Pass --force only on an empty or disposable database.`);
  process.exit(2);
}
const sql = readFileSync(new URL("../prisma/turso/init.sql", import.meta.url), "utf8");
await client.executeMultiple(sql);
const after = await client.execute("SELECT count(*) AS n FROM sqlite_master WHERE type='table'");
console.log(`Applied prisma/turso/init.sql (${after.rows[0].n} tables).`);
client.close();
