# HELLO OS protocols and API: REST, MCP, and A2A-style routes

HELLO OS exposes Next.js REST routes, a separate local MCP-compatible service, and an A2A-style JSON-RPC task surface. These interfaces operate on the prototype's configured data store. They do not imply a public hosted service, production authentication, general autonomous execution, or full protocol certification.

## Discovery and basic routes

| Route | Current purpose |
| --- | --- |
| `GET /api/hello/handshake` | Service bootstrap information. |
| `GET` / `POST /api/a2a` | A2A-style JSON-RPC task lifecycle. |
| `GET /.well-known/agent-card.json` | Agent card discovery. |
| `GET /.well-known/agent.json` | Agent-card alias. |
| `POST /api/aml/compile` | Static AML compilation. |
| `POST /api/aml/validate` | Static AML validation. |
| `POST /api/hello/tasks/validate` | Static `hello.task/v1` schema and resource-bound validation. |

The repository contains routes for agent, mission, memory, Forge, MCP, economy, traces, attestations, and other prototype areas. Read each route handler for supported methods, schemas, validation, and current status. Do not infer an API contract from a route name alone.

## Static task contracts

The task validator accepts a raw versioned JSON contract (up to 32 KiB) with a goal, included and excluded scope, capability identifiers, constraints, success and failure criteria, token/tool-call/wall-clock limits, approval metadata, and termination rules. It returns HTTP 200 for a valid contract, 422 for contract diagnostics, 400 for malformed JSON, and 413 for an oversized body. Valid contracts receive a deterministic content hash.

Validation is not authorization: capability strings are declarations only, approval metadata is not an approval record, the hash is not a signature, and the endpoint does not persist or execute tasks. See the [JSON Schema](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/schemas/hello-task-v1.schema.json), [validator source](https://github.com/CodesbyFebin/Hello-OS/blob/main/src/lib/task-contract.ts), and run its focused tests with `npm run test:task-contract`.

## MCP service

The primary MCP endpoint runs in the Next.js app at `/api/hello/mcp` without a sidecar. The optional standalone MCP service runs with `npm run mcp` and Bun, listening on port `3030` by default. The MCP tool registry is in [`mini-services/hello-mcp/index.ts`](https://github.com/CodesbyFebin/Hello-OS/blob/main/mini-services/hello-mcp/index.ts). The app also exposes compatibility API routes under `/api/hello/mcp/` for tool listing, calls, and receipt feeds.

Check the tool registry and configuration before connecting clients. A compatible transport is not a guarantee of authentication, user isolation, broad MCP conformance, or safe access from the public internet.

## A2A-style surface

The app publishes an agent card and a JSON-RPC task route. Treat this as a project-specific prototype surface. Validate request schemas and expected task states against `src/app/api/a2a/route.ts` and the agent-card source; interoperability with all A2A implementations has not been certified.

## Safe integration practice

1. Start with a local instance and non-sensitive test data.
2. Read route and tool schemas from the current repository revision.
3. Keep read operations distinct from state-changing calls.
4. Use timeouts, bounded input sizes, and caller-side authentication when wrapping the prototype.
5. Do not expose an unauthenticated development service to the public internet.
6. Do not send secrets or personal data to an instance without an explicit operator security review.

The canonical machine-readable summary is [`public/agents.md`](https://github.com/CodesbyFebin/Hello-OS/blob/main/public/agents.md); the complete setup and security notes are in the [README](https://github.com/CodesbyFebin/Hello-OS#readme).
