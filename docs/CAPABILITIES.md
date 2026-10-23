# Capability matrix

**Last verified:** `main` @ `972b3e9`, 2026-10-21 (IST), Node v22.23.3. All 18 `tests/*.test.mjs` suites passed against a temporary SQLite file. Rows marked "open PR" are verified on their own branch only.

Status labels: **implemented** (code plus a passing test), **prototype** (works, with stated limits), **simulation** (deterministic or synthetic, not real behavior), **planned** (not built), **vision** (direction only).

| Capability | Status | Evidence (code) | Evidence (test) | Limits |
| --- | --- | --- | --- | --- |
| Agent identity: Ed25519 `did:key` | implemented | `src/lib/crypto.ts`, `src/app/api/agents/route.ts` | `tests/secrets.test.mjs` | Keys are stored server-side in the DB (demo custody, no KMS/HSM). |
| Private keys never returned by the API | implemented | `src/lib/db.ts` (global `omit`) | `tests/secrets.test.mjs` | Signing routes opt in to read the key server-side. |
| Wallet credits (H), daily cap, circuit breaker | implemented | `src/lib/economy.ts` | `tests/gate.test.mjs`, `tests/consensus-treasury.test.mjs` | Prototype units with no monetary value. |
| Approval gate, risk tiers, kill switch | implemented | `src/lib/gate.ts`, `/api/approvals`, `/api/operator` | `tests/gate.test.mjs` | `external.send` and `data.delete` have no executor, so approving them records `failed`. |
| Operator auth | prototype | `src/lib/operator-auth.ts` | `tests/scheduler-delegation.test.mjs` (indirect) | One shared token. Open when unset. Production fail-closed is in PR #36. |
| Audit log | implemented | `AuditLog` model, `/api/audit` | `tests/gate.test.mjs` | Append-only table, **not** tamper-proof. |
| Scheduler (cron-driven tick), delegation with credit caps | implemented | `src/lib/scheduler.ts`, `src/lib/delegation.ts` | `tests/scheduler-delegation.test.mjs` | No background daemon. Something has to call `/api/scheduler/tick`. |
| Role-scoped knowledge search | implemented | `src/lib/knowledge.ts` | `tests/cache-knowledge.test.mjs` | `agentId` is self-asserted (no per-agent auth). |
| Semantic cache with measured hit rate | implemented | `src/lib/semantic-cache.ts` | `tests/cache-knowledge.test.mjs` | Local trigram cosine, not embeddings. |
| Snapshots (sealed) and failure library | implemented | `src/lib/snapshots.ts`, `src/lib/failures.ts` | `tests/snapshots-failures.test.mjs` | App-level DB snapshots. Not VM or filesystem snapshots. |
| Wasm sandbox (QuickJS) | implemented | `src/lib/sandbox.ts` | `tests/sandbox.test.mjs` | `console.log` only. Time and memory limits. Not an OS-level sandbox. |
| Debate/consensus, treasury reallocation | implemented | `src/lib/consensus.ts`, `src/lib/treasury.ts` | `tests/consensus-treasury.test.mjs` | Reputation-weighted voting among local agents. |
| AML compile/validate | implemented | `src/lib/aml.ts` | `tests/aml.test.mjs` | Static parse and intent graph only. Never executes. |
| MCP server (in-process, JSON-RPC + compat routes) | prototype | `src/lib/mcp/server.ts`, `/api/hello/mcp` | `tests/mcp-inprocess.test.mjs` | Not a full MCP conformance claim. No replay protection. Write-tool gating is in PR #36. |
| Read-only MCP connectors (SQL, GitHub, OpenAPI, webhook) | implemented | `src/lib/mcp/connectors/` | `tests/connectors.test.mjs` | Read-only. Not verified against real third-party accounts. |
| MCP receipts | implemented | `logToolCall` in `src/lib/mcp/server.ts` | `tests/mcp-inprocess.test.mjs` | A SHA-256 digest identifying a log row. **Not a signature.** |
| AI provider (OpenRouter, Kilo, custom) with metering | implemented | `src/lib/ai/` | `tests/ai-provider.test.mjs` (mock server) | Off by default (503 `NO_AI_PROVIDER`). Never tested live in CI. Ollama profile is in PR #35. |
| SQLite and Turso/libSQL | implemented | `src/lib/db.ts`, `src/lib/db-config.ts`, `prisma/turso/` | `tests/turso-adapter.test.mjs` | Without `DATABASE_URL`: 503 `DB_NOT_CONFIGURED`. |
| Live dashboard snapshot (SSE) | implemented | `/api/sync` | `tests/sync.test.mjs` | Polling interval `HELLO_SYNC_INTERVAL_MS`. |
| Docs/UGC board with receipts and rate limit | implemented | `/api/docs/posts` | `tests/docs.test.mjs` | In-memory rate limit, per process. |
| Task evaluation loop with human-approved promotion | implemented (open PR #34) | `src/lib/eval/` | `tests/eval-loop.test.mjs` | Small suite, string/regex graders, offline fixtures. No live model results. |
| HELLO Evolve / Evolution Lab gene scoring | **simulation** | `src/lib/evolution.ts`, `/evolve` | `tests/evolution.test.mjs` | Distance to fixed target vectors. Not agent quality, never a promotion gate. |
| `cloud.checkpoint` / `cloud.rollback` MCP tools | **simulation** | `src/lib/mcp/server.ts` | none | Records a status row. Doesn't snapshot or restore any DB or filesystem. |
| Firecracker microVMs, copy-on-write DB branches | **planned / vision** | none | none | Not built. |
| Multi-tenant isolation, per-agent auth, KMS custody, tamper-proof audit | planned | none | none | Not built. |
| Docker Compose (web + MCP) | prototype | `compose.yaml`, `Dockerfile` | not run in this check (no Docker socket access; see `getting-started/QUICKSTART-CHECK.md`) | Ports bound to 127.0.0.1. |

To update this file, re-run the CI steps (`.github/workflows/ci.yml`) and change the commit, date and any row whose evidence changed.
