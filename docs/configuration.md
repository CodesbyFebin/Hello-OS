# Configuration

| Variable | Used by | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Prisma | `file:./db/custom.db` | SQLite file. Use a disposable file for tests, e.g. `file:/tmp/hello-test.db`. |
| `HELLO_MCP_URL` | dashboard | `http://localhost:3030` | Where the dashboard reaches the MCP service. |
| `HELLO_PUBLIC_URL` | app | `http://localhost:3000` | Public base URL for links and the agent card. |
| `HELLO_ALLOWED_ORIGINS` | app, MCP | localhost origins | Comma-separated CORS allow-list. |
| `HELLO_OPERATOR_TOKEN` | operator routes | unset | **Available once PR #5 / #6 / #12 / #14 merge.** When set, operator actions need header `x-operator-token: <value>`: approving or rejecting actions, the kill switch, the threshold, scheduler jobs and ticks, knowledge docs and roles, and sandbox runs. When unset, the app runs in **dev mode**: anyone who can reach the server can act as operator, and `/ops/approvals` shows a warning. Always set it before exposing the app beyond localhost. |
| `HELLO_WEBHOOK_SECRET` | `POST /api/integrations/webhook` | unset | **Available once PR #7 merges.** HMAC-SHA256 secret for inbound webhooks. The route returns 503 until it is set. |
| `GITHUB_TOKEN` | MCP `connector.github.read` | unset | **Available once PR #7 merges.** Optional and read-only. It's read from the environment only and never returned in responses. Without it, the unauthenticated GitHub rate limits apply. |
| `HELLO_MCP_PORT` | `mini-services/hello-mcp` | `3030` | **Available once PR #7 merges.** Overrides the MCP service port. |

Never commit real values. `.env*` files are git-ignored.

## Database schema
The repo uses `prisma db push` (no migrations directory). After pulling or merging schema changes, run:

```bash
npx prisma db push      # apply schema to DATABASE_URL
npx prisma generate     # refresh the client (db push also does this)
```
