# HELLO OS architecture: local-first agent control prototype

HELLO OS is composed of a Next.js application, a Prisma persistence layer, and an in-process MCP handler (with an optional Bun sidecar). The current application stores agent and workflow records locally and exposes selected APIs for inspection and interaction. The named HELLO domains describe product areas; they are not independently deployed cloud services.

## Components

| Component | Current role | Main source |
| --- | --- | --- |
| Next.js App Router | Pages, dashboard, API routes, discovery metadata | `src/app/` |
| Prisma + SQLite | Local persistence for supported records | `prisma/schema.prisma` |
| MCP handler | Exposes selected tools and records call results in the Next.js app | `src/lib/mcp/server.ts` |
| AML engine | Static parse, validation, graph, metrics, and hashes | `src/lib/aml.ts` |
| Dashboard | Operator observation and review UI | `src/components/hello/dashboard.tsx` |

## Data and workflow path

The UI and API routes read and mutate application state through the server-side data layer. The optional Bun sidecar wraps the same in-process handler for standalone clients. Agent cards and APIs describe capabilities; a descriptor does not imply that the application is autonomously executing work. Inspect the route handlers and tool registry before relying on a behavior.

## Current module mapping

| Domain label | What exists | What remains beyond this prototype |
| --- | --- | --- |
| `hello.id` | Ed25519 identity creation and `did:key` records | Production key custody, operator rotation and revocation controls |
| `hello.cortex` | Persistent memory records and retrieval endpoints | Automated consolidation, vector search, and hardened tenancy boundaries |
| `hello.ledger` | Internal wallet and transaction records with configured controls | Payment rails, crypto settlement, and audited financial ledger |
| `hello.mesh` | MCP service and A2A-style JSON-RPC task routes | Broad interoperability certification and a hosted mesh |
| `hello.forge` | Symbol and diagnostic surfaces for the included sample repository | AST-based version control or production speculative CI |
| `hello.cloud` | Checkpoint records and simulated snapshot references | VM execution, real snapshots, and production isolation |
| AML | Static compiler and validator | Execution runtime, tool authorization, or deployment |

## Trust boundaries

- A browser UI is not an authorization boundary. Review server-side route checks before exposing state to untrusted callers.
- Local key storage and SQLite are development choices, not production custody or multi-tenant isolation.
- A SHA-256 source hash identifies source content; it is not a signature or proof that work completed.
- Tool names, AML statements, and agent-card descriptions do not cause execution by themselves.
- The dashboard is an observation surface. Concept images and the standalone EVOLVE simulation are synthetic, not telemetry.

## Architecture direction

The cloud architecture page records a proposed build sequence: version schemas; add request identity and workspace isolation; define a bounded durable execution lifecycle; authorize every capability; harden receipts and recovery; evaluate sandbox choices; and only then consider hosted operations. Read [`docs/hello-cloud-architecture.md`](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/hello-cloud-architecture.md) for the detailed gap list.

## Verify before citing

When describing a capability, cite a source file, route, test, or reproducible local command. When reporting performance, record revision, hardware, workload, method, sample count, and raw results. The current project has no verified 50 ms microVM start or production service SLA.
