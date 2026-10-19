# Integrations registry, MCP connector tools and bridges

**Status: in PR #7.** Available once PR #7 merges. The static [integration catalog](../integrations/README.md) on Pages is already published as a planning reference.

- **`/integrations`:** a registry of 100 connectors. 3 are working (GitHub read, SQLite, GitHub Actions webhook), 82 planned and 15 vision (payments/crypto, which are disabled by default and would need operator approval).
- **`docs/bridges.md`:** 50 bridge techniques, tagged implemented or planned. The merge arbiter requires human approval.
- **Read-only MCP connector tools** in `mini-services/hello-mcp` (6 tools):
  - `connector.sql.query`: a single SELECT/WITH only, wrapped LIMIT (default 50, max 200). Secret columns such as `privateKeyHex` are rejected and redacted.
  - `connector.sql.schema` and `connector.sql.fingerprint`: schema reflection plus SHA-256.
  - `connector.github.read`: GET-only repo, issues and PRs. `GITHUB_TOKEN` is optional, env only and never returned.
  - `connector.openapi.reflect`: OpenAPI 3 to candidate tools. Write operations are excluded or disabled with `requiresApproval: true`.
  - `connector.webhook.transpile`: webhook payloads to observe-only intents.
- **`POST /api/integrations/webhook`:** HMAC-SHA256 verified. It returns 503 until `HELLO_WEBHOOK_SECRET` is set.
- **Agent card** (`/.well-known/agent.json`): lists the connectors under `x-hello-connectors` with `writeTools: []`.
- **`HELLO_MCP_PORT`:** overrides the MCP port (default 3030).

**Not done:**
- The Postgres path is untested.
- There's no webhook replay or timestamp protection yet.
- There are no write connectors.

**Tests:** `npm run test:connectors` (Node ≥ 22).
