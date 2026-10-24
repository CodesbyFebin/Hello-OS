# HELLO OS agent runtime architecture

HELLO OS Agent Runtime Architecture v1 is a design proposal for extending the current local-first agent workspace into a bounded, inspectable runtime. HELLO OS remains the project name across the code, packages, interfaces, and documentation. This page distinguishes the working prototype from proposed future systems; it is not a release promise.

## What HELLO OS provides today

The current project is a Next.js application with Prisma persistence. It includes Ed25519-backed agent identity records, selected mission and task APIs, tiered memory, internal credit wallets, approval controls, an in-process MCP-compatible tool service, A2A-style task methods, a QuickJS WebAssembly sandbox, and static AML and hello.task/v1 validators. They validate document shape and limits only: neither AML nor task contracts are executed, capability grants are not checked by the task validator, and no task is scheduled. The contract schema is in [hello-task-v1.schema.json](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/schemas/hello-task-v1.schema.json). Checkpoint request records are metadata; they do not snapshot a database, filesystem, or VM and cannot roll state back.

These features are useful integration and control-plane prototypes. They do not constitute an operating-system kernel, a durable general-purpose execution worker, or production multi-tenant isolation. Read the [current architecture page](Architecture) and [capability matrix](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/CAPABILITIES.md) for implementation evidence.

## Proposed runtime boundaries

The full [HELLO OS Agent Runtime Architecture v1](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/architecture/HELLO-OS-Agent-Runtime-v1.md) proposal describes these target boundaries:

| Boundary | Proposed responsibility | Evidence required before claiming it is shipped |
| --- | --- | --- |
| Identity and policy | Resolve the caller, owner, workspace, current grants, and approval rules | Authorization tests, including denied cross-workspace and expired-grant cases |
| Task contract | Validate inputs, allowed outputs, expiry, budget, and stop conditions | Versioned schemas and negative tests for malformed or over-budget tasks |
| Scheduler | Claim bounded work, lease it to a worker, and handle retries and cancellation | Crash recovery, duplicate delivery, stale-worker fencing, and loop-limit tests |
| Context service | Select authorized memories with provenance and retention rules | Leakage tests, deterministic retrieval fixtures, deletion and retention checks |
| Tool adapters | Validate and mediate each side effect with explicit scope and time limits | Per-tool policy tests, timeout behavior, idempotency, and secret-handling review |
| State and audit | Record transitions, approvals, tool results, and usage | Transactional consistency, backup/restore drills, and privacy-reviewed exports |

The model proposes text or a next action. Server-side code must authorize that action against the task contract and capability grant before a side effect. A prompt, agent card, source hash, or AML validation result is not an authorization mechanism.

## Staged implementation direction

The proposal sequences work through contracts and trust boundaries; durable task state; centralized policy and approvals; provenance-aware context; bounded scheduling and adapters; interoperability and observability; deployment hardening; and finally portability or federation research. Each stage has an evidence gate. Firecracker microVMs, cross-server federation, general live-agent evolution, and broad connector coverage remain future work until their separate safety, reliability, and interoperability requirements are met.

## Source links

- [Full architecture proposal](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/architecture/HELLO-OS-Agent-Runtime-v1.md)
- [Current API and setup overview](https://github.com/CodesbyFebin/Hello-OS#readme)
- [Roadmap and evidence gates](Roadmap)
- [AML specification](AML)
