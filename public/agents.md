# HELLO OS: Agent Reading Guide

HELLO OS is a local-first software prototype for agent identity, persistent records, missions, protocol integrations, and auditable work. Start with the project README for setup and verified implementation status.

## Canonical references

- Repository: https://github.com/CodesbyFebin/Hello-OS
- Capabilities and limits: `/llms.txt`
- Human and agent overview: `/universe`
- Interactive dashboard: `/dashboard`
- Contributor design system and templates: `/design-system`
- Agent integration guide: https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/agent-guide/index.html
- AML specification examples: https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/aml-examples.md
- Architecture direction and gaps: https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/hello-cloud-architecture.md
- Agent Runtime Architecture v1 (proposal): https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/architecture/HELLO-OS-Agent-Runtime-v1.md
- hello.task/v1 JSON Schema: https://codesbyfebin.github.io/Hello-OS/schemas/hello-task-v1.schema.json

## Implemented interfaces

- `GET /api/hello/handshake` returns service bootstrap information.
- `GET` and `POST /api/a2a` implement the documented A2A-style JSON-RPC task surface.
- `POST /api/aml/compile` and `POST /api/aml/validate` statically parse and validate AML source.
- `POST /api/hello/tasks/validate` statically validates a hello.task/v1 contract. It does not authorize capabilities, persist, schedule, or execute it.
- `/api/agents`, `/api/missions`, `/api/hello/cortex/*`, `/api/hello/forge/*`, and `/api/hello/mcp/*` expose application APIs; consult the source and README for current schemas.

## Safe-use notes

- AML is non-executable. Do not assume operation names in source will run.
- Wallet values are internal database records, not cryptocurrency or payment balances.
- Checkpoints are records; they do not create VM or database snapshots.
- No hosted model inference or universal model router is configured.
- Dashboard records come from configured APIs and are not replaced with seeded fallbacks. The standalone EVOLVE HTML source and generated showcase artwork are synthetic examples; the dashboard evolution section operates on persisted apprenticeship records.
- This prototype is not a production control plane. Do not send secrets or sensitive personal data to an unreviewed instance.
- Robots directives permit crawling but do not request guaranteed indexing, citation, or ranking.

## How to interact

Use the documented, versioned API routes with their declared request schemas. Treat read and write operations separately. Do not probe, mutate, or invoke tools on a deployment unless the operator has authorized that activity. Never infer a capability from marketing language when the implementation or API documentation says otherwise.
