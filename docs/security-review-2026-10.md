# Security review: authorization, inputs, MCP (2026-10-21)

Scope: API routes under `src/app/api`, `src/lib/operator-auth.ts`, `src/lib/gate.ts` and the MCP server `src/lib/mcp/server.ts`, at `main` @ `972b3e9`. This is a self-review, not an independent audit, and it does not make HELLO OS secure. Tests: `tests/authz.test.mjs`.

## Fixed in this change

| # | Finding | Fix |
| --- | --- | --- |
| 1 | With no `HELLO_OPERATOR_TOKEN`, every operator route was open on any deployment, including Vercel. | In production (`NODE_ENV=production` or `VERCEL`) these routes now fail closed with 503 `OPERATOR_TOKEN_NOT_CONFIGURED`. Local dev stays open. `HELLO_OPERATOR_DEV_MODE=1` is an explicit override. |
| 2 | The token was compared with `===`. | Now a constant-time comparison of SHA-256 digests. `Authorization: Bearer` is also accepted. |
| 3 | `PATCH`/`POST /api/agents/:id/wallet` (daily cap, circuit breaker, top-up) had no auth. | These are operator-only now, with an amount bound of 1,000,000 H, a 404 for an unknown wallet, and an audit row for cap and circuit changes. |
| 4 | `POST /api/agents` accepted any `guardianTier` (e.g. self-assigned `Sovereign`), an unbounded name and malformed JSON. | Tier must be one of the 5 labels, and anything other than `Seedling` needs the operator. Name is limited to 60 characters, tagline to 160 and guildSlug to 64. Bad JSON returns 400. |
| 5 | MCP write tools (`forge.patchSymbol`, `cloud.rollback`, `memory.write`, …), plus `memory.recall` and `connector.sql.query`, could be called by anyone. `/tools/call` had no origin check and sent `CORS *`. | These tools are operator-only on both `/mcp` and `/tools/call`. |
| 6 | The MCP feed (`/feed`, `hello://mcp/feed`) returned the arguments and results of every call. | Metadata only now. |
| 7 | `/tools/call` returned `receipt: sha256(name:now)`, which didn't match the logged row. | It returns the logged row's `receiptHash`; `receipt` is kept as an alias. |
| 8 | MCP arguments weren't validated: a string was spread into an object, and there was no size limit. | Arguments must be an object, required fields must be present, declared types are checked, strings are capped at 200 KB and request bodies at 1 MB (413). Invalid JSON returns 400 or JSON-RPC -32700. |
| 9 | The handshake said "signed test receipt". The crypto comment said canonicalization "prevents tampering". | Both reworded to say what the code actually does. |
| 10 | `/api/agents/:id/wallet/spend` had no upper bound on the amount. | Capped at 1,000,000 H. |

## Verified, unchanged

- `privateKeyHex` is omitted from every Agent query by default (`src/lib/db.ts`). Only the signing routes opt in, and none of them return it. Tested on `POST`/`GET /api/agents` and `GET /api/agents/:id`.
- `connector.sql.query` rejects queries that name secret columns and redacts them from `SELECT *`.
- `aiStatus` never returns the provider key (`tests/ai-provider.test.mjs`).
- The kill switch blocks gated spends with 423, and an approval can only execute once (`tests/gate.test.mjs`, `tests/authz.test.mjs`).

## Open gaps (not fixed)

- **No per-agent authentication.** Agent-side routes (`/wallet/spend`, `/memory`, `/soul`, `/knowledge/search?agentId=`, A2A, missions) trust the `agentId` or `agentDid` the caller sends. Role-scoped knowledge filtering is correct for the agent named in the request, but anyone can name any agent. Closing this needs agent credentials, for example requests signed with the agent's key.
- **No MCP replay protection or idempotency keys.**
- Read routes like `/api/audit` and `/api/traces` are public, and audit `detail` can contain action payloads.
- `/tools/call` still sends `CORS *`. Browser-origin writes are now blocked by the operator check, but reads stay cross-origin.
- **Rate limiting:** none.
- **Key custody:** keys are stored server-side in the database, with no KMS/HSM.
- **Remaining routes:** the other mutating routes (evolution, governance, missions, marketplace, failures, snapshots, cache, consensus, treasury) still have only basic validation, and none of them have operator gating.
