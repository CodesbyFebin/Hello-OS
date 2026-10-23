// Initialize a fresh local SQLite file from the checked-in Prisma schema SQL.
// Existing databases are never rewritten at startup; schema changes remain an
// explicit operator action (`npx prisma db push` or the documented Turso flow).
import { createClient } from "@libsql/client";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is required. Set it before starting HELLO OS.");
  process.exit(1);
}

if (!/^file:/i.test(url)) {
  console.log("Skipping automatic schema initialization for remote database; apply prisma/turso/init.sql before first start.");
  process.exit(0);
}

const client = createClient({ url });
try {
  const databasePath = fileURLToPath(new URL(url));
  await mkdir(dirname(databasePath), { recursive: true });
  const existing = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  if (existing.rows.length > 0) {
    console.log(`Database already has ${existing.rows.length} table(s); leaving it unchanged.`);
  } else {
    const sqlPath = fileURLToPath(new URL("../prisma/turso/init.sql", import.meta.url));
    const sql = await readFile(sqlPath, "utf8");
    await client.executeMultiple(sql);
    console.log("Initialized empty SQLite database from prisma/turso/init.sql.");
  }
} finally {
  client.close();
}
