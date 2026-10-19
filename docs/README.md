# HELLO OS documentation

HELLO OS is an experimental, local-first agent operating system prototype (Next.js, Prisma/SQLite and a separate Bun MCP service). These docs describe what the code in this repository does. Anything not merged into `main` is marked **available once PR #N merges**. Anything not built is marked **planned** or **vision**.

**Status key:** `shipped` = on `main` · `in PR #N` = open pull request, not merged · `planned` = intended, not built · `vision` = not possible or not attempted today.

## Start here
- [Getting started (Pages)](https://codesbyfebin.github.io/Hello-OS/getting-started/) · [Agent guide (Pages)](https://codesbyfebin.github.io/Hello-OS/agent-guide/)
- [Configuration and environment variables](configuration.md)
- [Operator guide](operator-guide.md): approvals, kill switch, scheduler ticks, roles
- [Merge order and database notes](merge-order.md) for the open PRs

## Features
| Area | Doc | Status |
| --- | --- | --- |
| Identity, keys and the private-key leak fix | [features/identity-and-keys.md](features/identity-and-keys.md) | shipped (identity) · fix in PR #4 |
| Web pages: /hub, /evolve, /cloud, /frontier, /runtime, /roadmap, layers + AML preview | [features/pages.md](features/pages.md) | shipped (#3) · rest in PRs #8, #9, #10, #15, #16 |
| Approval gate, kill switch, audit log | [features/approvals.md](features/approvals.md) | in PR #5 |
| Heartbeat scheduler and delegation tree | [features/scheduler-delegation.md](features/scheduler-delegation.md) | in PR #6 |
| Integrations registry, MCP connector tools, bridges | [features/integrations-mcp.md](features/integrations-mcp.md) | in PR #7 |
| Checkpoint/resume snapshots and failure library | [features/snapshots-failures.md](features/snapshots-failures.md) | in PR #11 |
| Semantic cache and role-scoped knowledge index | [features/cache-knowledge.md](features/cache-knowledge.md) | in PR #12 |
| Consensus/debate and treasury reallocation | [features/consensus-treasury.md](features/consensus-treasury.md) | in PR #13 (stacked on #5) |
| Wasm snippet sandbox | [features/sandbox.md](features/sandbox.md) | in PR #14 |

## Reference
- [AML spec (EBNF)](aml-spec.ebnf) · [AML examples](aml-examples.md)
- [HELLO Cloud architecture direction](hello-cloud-architecture.md) (vision)
- [Integration catalog notes](integrations/README.md)

## Honesty rules these docs follow
No benchmarks or savings figures unless measured locally and labelled as such. Money is **prototype credits**, never USDC or real funds. Spending has operator caps, approval and a kill switch. Identity is operator-revocable. Simulations are labelled. The project is MIT-licensed (see `LICENSE`) and is **not** production-ready.
