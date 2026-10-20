# HELLO OS documentation

HELLO OS is an experimental, local-first agent operating system prototype (Next.js, Prisma/SQLite and an in-process MCP handler). These docs describe the current implementation and its limits. Anything not built is marked **planned** or **vision**.

**Status key:** `shipped` = implemented on `main`, not necessarily production-hardened · `prototype` = partial or explicitly simulated · `planned` = intended, not built · `vision` = design direction only.

## Start here
- [Wiki-ready guide and import instructions](wiki/README.md) — evidence-led pages and a community contribution playbook. Copy to the separate GitHub Wiki repository to publish Wiki pages.
- [Getting started (Pages)](https://codesbyfebin.github.io/Hello-OS/getting-started/) · [Agent guide (Pages)](https://codesbyfebin.github.io/Hello-OS/agent-guide/)
- [Configuration and environment variables](configuration.md)
- [Operator guide](operator-guide.md): approvals, kill switch, scheduler ticks, roles
- [Database and schema notes](merge-order.md) for schema update guidance

## Features
| Area | Doc | Status |
| --- | --- | --- |
| Identity, keys and key-handling boundary | [features/identity-and-keys.md](features/identity-and-keys.md) | shipped; demo key custody |
| Web pages and simulation status | [features/pages.md](features/pages.md) | shipped / prototype / vision labels |
| Approval gate, kill switch, audit log | [features/approvals.md](features/approvals.md) | shipped; operator token is optional in dev |
| Heartbeat scheduler and delegation tree | [features/scheduler-delegation.md](features/scheduler-delegation.md) | shipped |
| Integrations registry, MCP connector tools, bridges | [features/integrations-mcp.md](features/integrations-mcp.md) | shipped; connector catalog includes unimplemented proposals |
| Checkpoint/resume records and failure library | [features/snapshots-failures.md](features/snapshots-failures.md) | shipped; not database or VM snapshots |
| Semantic cache and role-scoped knowledge index | [features/cache-knowledge.md](features/cache-knowledge.md) | shipped |
| Consensus/debate and treasury reallocation | [features/consensus-treasury.md](features/consensus-treasury.md) | shipped |
| Wasm snippet sandbox | [features/sandbox.md](features/sandbox.md) | shipped; bounded prototype |

## Reference
- [AML spec (EBNF)](aml-spec.ebnf) · [AML examples](aml-examples.md)
- [HELLO Cloud architecture direction](hello-cloud-architecture.md) (vision)
- [Integration catalog notes](integrations/README.md)

## Honesty rules these docs follow
No benchmarks or savings figures unless measured locally and labelled as such. Money is **prototype credits**, never USDC or real funds. Operator gates and approval controls are available, subject to configuration. Simulations are labelled. The project is MIT-licensed (see `LICENSE`) and is **not** production-ready.
