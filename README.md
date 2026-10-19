# HELLO OS

HELLO is an agent-native operating system prototype: cryptographic agent identities, persistent memory, a mission economy, a typed code graph, and an MCP-compatible tool surface. The human interface is an observation deck for monitoring and review.

## Run locally

Requirements: Node.js 20 or newer, npm, and Bun for the separate MCP service.

### One-command local deployment

Requirements: Docker Engine with the Compose plugin.

```sh
docker compose up --build
```

Open `http://localhost:3000`. The app is bound to localhost, the MCP endpoint is available at `http://localhost:3030/mcp`, and the SQLite database persists in the `hello-data` volume. Stop it with `docker compose down`; keep the volume to preserve data. The optional `HELLO_PUBLIC_URL` value in the environment controls URLs advertised by the agent card.

```sh
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`. To load the included demo workspace, keep `db/custom.db` and set `DATABASE_URL="file:./db/custom.db"` in `.env`. To start the MCP service in a second terminal, run `npm run mcp`; it listens on port `3030`.

For a production build, run `npm run build` and then `npm start`. Set `DATABASE_URL` to the database used by the server process.

## What works in this prototype

- Agent creation generates an Ed25519 key and `did:key`, and creates an initial soul version and wallet.
- Agents, missions, balances, traces, memories, and MCP receipts are persisted in SQLite through Prisma.
- Mission claims are written through the mission API.
- The MCP service exposes forge, cortex, tiered-memory, and checkpoint tools at the Streamable HTTP JSON-RPC endpoint `/mcp`; the older `/tools` and `/tools/call` routes remain available for the dashboard. Tool calls produce audit receipts.
- Agent discovery is available at `/.well-known/agent-card.json` (and the brief's `/.well-known/agent.json` alias). A2A JSON-RPC supports `message/send`, `tasks/get`, `tasks/list`, `tasks/update`, and `tasks/cancel`, with durable task states and signed message/result intents.
- Agent memory supports CORE, RECALL, and ARCHIVE tiers, TTL expiry, valid-time filters, and query retrieval budgets. Wallet debits and skill installs pass through a transactional daily cap and circuit breaker.
- `GET /api/agents/{id}/export` downloads an identity, soul, memory, wallet history, skills, and trace bundle. Private signing keys are excluded.
- Forge parses the sample TypeScript repository and returns structured compiler diagnostics.
- The dashboard reads the REST APIs, refreshes periodically, and falls back to an explicitly labeled demo snapshot when the services are unavailable.
- The `/universe` route retains the longer HELLO platform and feature overview.

## Prototype boundaries

This is a runnable local-first prototype, not a hardened production control plane. The generated private key is stored by the demo server; use an HSM/KMS and isolate key custody before handling production identities or funds. MCP implements the JSON Streamable HTTP request path and core tool/resource methods; SSE streaming, OAuth, and broader protocol features are not implemented. A2A implements the JSON-RPC task lifecycle and discovery card, without streaming or push notifications. Cloud checkpoints are records in this prototype; they do not fork a live database or launch Firecracker microVMs.
