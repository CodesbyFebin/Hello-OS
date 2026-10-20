# Deploying HELLO OS on Vercel with Turso

On Vercel the filesystem is read-only and per-request, so a local SQLite file cannot hold data.
HELLO OS uses [Turso](https://turso.tech) (hosted libSQL, the same SQLite dialect) through
Prisma's libSQL driver adapter. Nothing in the schema changes.

| `DATABASE_URL`          | Driver                                                      | Used for            |
|-------------------------|-------------------------------------------------------------|---------------------|
| `libsql://...`          | `@prisma/adapter-libsql` + `@libsql/client`, `TURSO_AUTH_TOKEN` | Vercel / Turso      |
| `file:./db/custom.db`   | Prisma's built-in SQLite engine (unchanged)                 | Local development   |
| *(unset)*               | none: DB-backed `/api/*` routes answer `503 DB_NOT_CONFIGURED` | Misconfigured deploy |

Routes that never touch the database (`/api`, `/api/aml/compile`, `/api/aml/validate`,
`/api/integrations/webhook`, `/api/sandbox`) keep working without it.

## 1. Create the Turso database

Install the CLI (macOS: `brew install tursodatabase/tap/turso`; Linux/WSL: `curl -sSfL https://get.tur.so/install.sh | bash`), then:

```bash
turso auth login                 # or: turso auth signup
turso db create hello-os         # pick a region near your Vercel region if asked
turso db show hello-os --url     # → libsql://hello-os-<your-org>.turso.io
turso db tokens create hello-os  # → the auth token (keep it secret)
```

## 2. Apply the schema (once, on the empty database)

From a checkout of this repo:

```bash
npm ci
DATABASE_URL="libsql://hello-os-<your-org>.turso.io" \
TURSO_AUTH_TOKEN="<token>" \
npm run db:turso:apply
```

This runs `prisma/turso/init.sql` (generated with
`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`). The script
refuses to run if the database already has tables. Alternative without Node:
`turso db shell hello-os < prisma/turso/init.sql`.

When `prisma/schema.prisma` changes, regenerate with `npm run db:turso:sql`. For an existing
database, write the change as an incremental SQL diff
(`prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel prisma/schema.prisma --script`)
and apply it with `turso db shell`. Do not re-run the init script on a database with data.

## 3. Set Vercel environment variables

Vercel → project **hello-os** → Settings → Environment Variables (Production, and Preview if wanted):

| Name                | Value                                           | Required |
|---------------------|-------------------------------------------------|----------|
| `DATABASE_URL`      | `libsql://hello-os-<your-org>.turso.io`         | yes      |
| `TURSO_AUTH_TOKEN`  | token from `turso db tokens create hello-os`    | yes      |
| `HELLO_AI_PROVIDER` | `openrouter` or `kilo`                          | for AI features |
| `HELLO_AI_API_KEY`  | your OpenRouter / Kilo key                      | for AI features |
| `HELLO_AI_MODEL`    | e.g. `google/gemma-4-31b-it:free` (set it for Kilo) | optional |

Paste the secrets into Vercel yourself; they never need to be shared with anyone else.

## 4. Redeploy and check

Env var changes apply on the next deployment: Deployments → latest → **Redeploy**. Then:

```bash
curl -s https://hello-os-bice.vercel.app/api/agents        # {"agents":[]} on a fresh DB, not 503
curl -s "https://hello-os-bice.vercel.app/api/sync?once=1" # JSON snapshot
```

A `503 {"error":"DB_NOT_CONFIGURED"}` means `DATABASE_URL` is not set for that environment.

## Build notes

- `postinstall` and `build` both run `prisma generate`, so the client exists on Vercel's build cache too.
- No route writes to the local filesystem at runtime (`/ops` only reads checked-in files).
- Seeding is optional and manual; there is no automatic demo data.

## Testing locally against a libSQL server

```bash
# sqld from https://github.com/tursodatabase/libsql/releases (libsql-server) or `turso dev --port 8080`
sqld --db-path /tmp/hello-sqld --http-listen-addr 127.0.0.1:8080 &
HELLO_TEST_LIBSQL_URL="libsql://127.0.0.1:8080?tls=0" npm run test:turso
```

Without `HELLO_TEST_LIBSQL_URL`, `npm run test:turso` drives the adapter against a scratch `file:` database.
