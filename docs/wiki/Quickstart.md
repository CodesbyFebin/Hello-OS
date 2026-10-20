# Run HELLO OS locally: quickstart

HELLO OS can be run locally with Node.js, npm, and SQLite. The optional MCP service also requires Bun. A local instance is intended for development and evaluation; it is not hardened for public or multi-tenant use.

## Requirements

- Node.js 20 or newer.
- npm.
- Bun for the separate MCP service.
- Docker Engine and the Compose plugin only if using Docker Compose.

## Install from source

```sh
git clone https://github.com/CodesbyFebin/Hello-OS.git
cd Hello-OS
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`. The dashboard is at `/dashboard`. The app uses the configured Prisma `DATABASE_URL`; inspect `.env.example` before changing it. `db:push` updates the local schema and is not a substitute for a production migration and backup strategy.

## Start the MCP service

In a second terminal, with Bun installed:

```sh
npm run mcp
```

The local MCP service listens on port `3030` by default. The exact tool list and request behavior are defined in [`mini-services/hello-mcp/index.ts`](https://github.com/CodesbyFebin/Hello-OS/blob/main/mini-services/hello-mcp/index.ts).

## Docker Compose

```sh
docker compose up --build
```

Compose starts the web app and MCP service with a persistent named volume for SQLite data. The configured ports bind to localhost in the supplied Compose file. Review `compose.yaml` and your environment before changing exposure. Avoid exposing a development instance directly to the internet.

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
| MCP tools unavailable | Confirm Bun is installed and the service on port 3030 is running. |
| Dashboard shows empty states | Add records or inspect API connectivity; empty state is not a simulated live feed. |

See the root [README](https://github.com/CodesbyFebin/Hello-OS#readme) for environment variables, tests, deployment boundaries, and security guidance.
