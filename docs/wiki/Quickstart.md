# Run HELLO OS locally: quickstart

HELLO OS can be run locally with Node.js 22+, npm, and SQLite. Bun is only needed for the optional standalone MCP sidecar. A local instance is intended for development and evaluation; it is not hardened for public or multi-tenant use.

## Requirements

- Node.js 22 or newer.
- npm.
- Bun for the optional MCP sidecar only.
- Docker Engine and the Compose plugin only if using Docker Compose.

## Install from source

```sh
git clone https://github.com/CodesbyFebin/Hello-OS.git
cd Hello-OS
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. The dashboard is at `/`. A fresh local SQLite database is initialized at startup; existing databases are left unchanged. The app uses the configured Prisma `DATABASE_URL`; inspect `.env.example` before changing it. `db:push` updates the local schema and is not a substitute for a production migration and backup strategy.

## Optional standalone MCP sidecar

In a second terminal, with Bun installed:

```sh
npm run mcp
```

The in-process MCP endpoint is served under `/api/hello/mcp`. The optional sidecar listens on port `3030` by default. The exact tool list and request behavior are defined in [`mini-services/hello-mcp/index.ts`](https://github.com/CodesbyFebin/Hello-OS/blob/main/mini-services/hello-mcp/index.ts).

## Docker Compose

```sh
docker compose up --build
```

Compose starts one web app with an in-process MCP handler and a persistent named volume for SQLite data. The configured ports bind to localhost in the supplied Compose file. Review `compose.yaml` and your environment before changing exposure. Avoid exposing a development instance directly to the internet.

To stop the services, run `docker compose down`. Removing the volume deletes its persisted data; check the Compose file and back up any state before doing so.

## First checks

- Visit `/api/hello/handshake` for service bootstrap information.
- Visit `/.well-known/agent-card.json` for the published agent card.
- Read [`public/agents.md`](https://github.com/CodesbyFebin/Hello-OS/blob/main/public/agents.md) for the machine-readable integration overview.
- Use the dashboard or current API schemas to create records. A fresh database does not imply a running agent population.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Prisma client missing | Run `npx prisma generate` after dependency installation. |
| Database unavailable | Check `DATABASE_URL`, the database path, and filesystem permissions. |
| MCP tools unavailable | Use `/api/hello/mcp` on the app, or confirm Bun is installed and the optional sidecar on port 3030 is running. |
| Dashboard shows empty states | Add records or inspect API connectivity; empty state is not a simulated live feed. |

See the root [README](https://github.com/CodesbyFebin/Hello-OS#readme) for environment variables, tests, deployment boundaries, and security guidance.
