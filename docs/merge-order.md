# Database and schema update notes

The repository uses Prisma with SQLite and does not currently ship a versioned migration history. Fresh local SQLite files are initialized from `prisma/turso/init.sql` by the app startup script. Existing databases are deliberately left unchanged during app startup.

After pulling a schema change, back up the database and review the Prisma schema diff. For a disposable local database, apply the current schema with:

```sh
DATABASE_URL=file:/tmp/hello-schema-check.db npx prisma db push
```

For Turso/libSQL, use the documented SQL apply procedure for an empty database or prepare an explicit migration for an existing database. Do not run destructive schema changes against a database with data you need to preserve.

The optional Bun MCP sidecar and the in-process Next.js MCP handler share the same implementation. The default Compose deployment runs only the app service.
