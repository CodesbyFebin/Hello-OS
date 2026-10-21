# Configuration

Every variable the code reads (`rg "process.env" src mini-services scripts`). Never commit real values: `.env*` files are git-ignored. Secrets (`HELLO_AI_API_KEY`, `HELLO_OPERATOR_TOKEN`, `TURSO_AUTH_TOKEN`, `HELLO_WEBHOOK_SECRET`, `GITHUB_TOKEN`) are read from the environment only. They are never stored in the database and never returned by status endpoints.

## Core

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `file:./db/custom.db` (from `.env.example`) | `file:` = local SQLite. Relative paths resolve from `<project root>/prisma/` (in code too, so `npm start` from `.next/standalone` finds the same file), so the default file is `prisma/db/custom.db`. A missing or empty file: `503 DB_UNAVAILABLE`. `libsql://…` = Turso. **Unset = every DB-backed `/api` route returns `503 DB_NOT_CONFIGURED`**, with the fix in the message. |
| `TURSO_AUTH_TOKEN` | unset | Required with a `libsql://` URL. |
| `HELLO_DB_ADAPTER` | unset | `libsql` forces the libSQL adapter for a `file:` URL (used by tests). |
| `HELLO_PUBLIC_URL` | `http://localhost:3000` | Base URL for links, the agent card and the MCP handshake. |
| `HELLO_ALLOWED_ORIGINS` | localhost:3000/3030 | Comma-separated Origin allow-list for `POST /api/hello/mcp`. |
| `HELLO_MCP_URL` | `http://localhost:3030` | Optional Bun sidecar. MCP also runs in-process at `/api/hello/mcp`. |
| `HELLO_MCP_PORT` | `3030` | Sidecar port. |
| `HELLO_FORGE_ROOT` | `./sample-repo` | Repo that the `forge.*` MCP tools parse and patch. |
| `HELLO_SYNC_INTERVAL_MS` | `3000` (min 500) | Polling interval for `/api/sync`. |

## Operator

| Variable | Default | Notes |
| --- | --- | --- |
| `HELLO_OPERATOR_TOKEN` | unset | Shared secret for operator actions, sent as `x-operator-token`. See [operator-guide.md](operator-guide.md). |

Today, with the token unset, operator routes run in **dev mode** (open to anyone who can reach the port). PR #36 changes this: in production (`NODE_ENV=production` or `VERCEL` set) they fail closed with 503, and `HELLO_OPERATOR_DEV_MODE=1` is the local override. Set a token before exposing the app beyond localhost.

## AI provider (optional, off by default)

Unset = AI features return `503 NO_AI_PROVIDER` with the variables to set. `GET /api/ai/status` shows whether a provider is configured (never the key).

| Variable | Notes |
| --- | --- |
| `HELLO_AI_PROVIDER` | `openrouter`, `kilo` or `custom` (`ollama` is added in PR #35). |
| `HELLO_AI_API_KEY` | Provider key. Required except for `ollama`. |
| `HELLO_AI_MODEL` | Default `google/gemma-4-31b-it:free`. |
| `HELLO_AI_BASE_URL` | Override. Required for `custom`. |
| `HELLO_AI_TIMEOUT_MS` / `HELLO_AI_MAX_RETRIES` | Defaults `30000` / `2`. |
| `HELLO_AI_CREDITS_PER_CALL` | H debited per metered call. Default `1`. |

To turn AI off again, unset `HELLO_AI_PROVIDER`.

## Integrations (optional)

| Variable | Notes |
| --- | --- |
| `HELLO_WEBHOOK_SECRET` | HMAC-SHA256 secret for `POST /api/integrations/webhook`. The route returns 503 until it is set. |
| `GITHUB_TOKEN` | Optional, read-only, for MCP `connector.github.read`. Without it, GitHub's unauthenticated rate limits apply. |

## Database schema and backup

The repo uses `prisma db push` (no migrations directory). After pulling schema changes:

```bash
npx prisma db push      # apply schema to DATABASE_URL (also regenerates the client)
```

For Turso, `npm run db:turso:apply` applies `prisma/turso/init.sql` to an **empty** database. Schema changes for an existing Turso DB ship as separate SQL files in `prisma/turso/`.

To back up local SQLite, stop the app and copy `prisma/db/custom.db`, or run `sqlite3 prisma/db/custom.db ".backup backup.db"`. For Docker, the database lives in the `hello-data` volume at `/app/db/custom.db`. For Turso, use Turso's own backup and point-in-time features.
