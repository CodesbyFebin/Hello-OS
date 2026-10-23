# Security policy

HELLO OS is an experimental prototype. It is not hardened for public or multi-tenant deployment; see the README's limitations before exposing it beyond localhost.

## Reporting a vulnerability
Please report vulnerabilities **privately** through GitHub's private vulnerability reporting:
https://github.com/CodesbyFebin/Hello-OS/security/advisories/new

If that form is not available yet, contact the maintainer privately through the [CodesbyFebin](https://github.com/CodesbyFebin) GitHub profile and ask for a private channel.

Do not open a public issue, pull request or discussion for a suspected vulnerability. Include the affected route or file, reproduction steps, and the impact you observed. You will get a reply through the advisory thread; there is no paid bug bounty.

## Supported versions
Only the `main` branch is supported. There are no maintained release branches yet.

## Known limitations (not vulnerabilities by themselves)
- Demo agent private keys are stored by the server in SQLite. They are excluded from API responses, but this is not production key custody.
- If `HELLO_OPERATOR_TOKEN` is unset, operator routes run in dev mode locally (anyone who can reach the server can act as operator) and fail closed with 503 in production (`NODE_ENV=production` or `VERCEL` set). See [docs/operator-guide.md](docs/operator-guide.md) and [docs/security-review-2026-10.md](docs/security-review-2026-10.md).
- MCP tool-call receipts are SHA-256 hashes for traceability, not signatures, and the audit log is not tamper-proof.
- Wallets hold prototype credits only; no real money is moved.

Reports showing a way around these documented boundaries (for example, an API that returns `privateKeyHex`, or a gated action that skips approval when a token is set) are in scope.

## Agent authentication, replay and rate limits

Agent-scoped writes need an Ed25519 request signature from the acting agent, or the operator token. Nonces and a ±5 minute timestamp window block replays. `Idempotency-Key` prevents double execution. DB-backed rate limits apply per agent or IP. See [docs/agent-auth.md](docs/agent-auth.md). Local dev mode still accepts unsigned requests. Request-auth secrets are shown once and only public keys are stored, but agents' DID signing keys are still held by the server (no KMS/HSM).


## Write gating, redaction and the dashboard token

- The remaining write routes go through `guardWrite` (`src/lib/guard.ts`): body size cap (413 `BODY_TOO_LARGE`), DB-backed rate limit (429), and either operator-only access or a signature from the acting agent (for example `fromId` on attestations, `proposerId` on consensus and governance, `authorId` on marketplace). Field bounds return 400 `BAD_FIELD`.
- Operator-only: observations, snapshot resume, cache writes, failures, golden replay, evolution curriculum, apprenticeships and runs.
- `GET /api/audit` hides `detail`, `GET /api/traces` replaces titles with `[redacted]`, and `GET /api/approvals` hides payload and note unless the caller is the operator (or local dev mode). Each response includes `redacted: true|false`.
- The dashboard and `/ops` pages have an operator token form. The token stays in `sessionStorage` for that tab only; it is not in the client bundle. It is sent as `x-operator-token`. The form shows the server's real state from `GET /api/operator`: dev mode, accepted, 401 (missing or wrong) or 503 (not configured in production).
- Limits: `sessionStorage` can be read by any script running on the page, so an XSS bug would expose the token. The AML routes and `/api/docs/posts` are not changed by this; the AML routes don't touch the DB, and `/api/docs/posts` has its own limiter.

## Database availability errors

When the SQLite file named by `DATABASE_URL` is missing or empty, `/api` routes return 503 `DB_UNAVAILABLE` with the resolved path and the fix (`npx prisma db push`). That path is a server filesystem path. A schema mismatch still gives a generic 500, and the Prisma message is written only to the server log.
