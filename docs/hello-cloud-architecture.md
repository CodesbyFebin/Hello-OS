# HELLO Cloud: Architecture Direction

HELLO Cloud is the longer-term direction for HELLO OS: an agent-oriented control plane for identity, work, memory, tools, and verifiable outcomes. The current repository is a self-hosted prototype. This page maps the supplied cloud concept to what is implemented and identifies the work required before HELLO OS can be described as a managed cloud.

## Current status

The app runs as a Next.js dashboard with a Prisma-backed SQLite store with an in-process MCP handler; a Bun sidecar is optional. Agents have Ed25519-backed `did:key` identities, a starting soul record, and a local wallet record. The application includes mission and task APIs, tiered memory, guilds, code-symbol tools, MCP call receipts, and basic skill/economy workflows.

These are useful building blocks, but they are not a hosted multi-tenant cloud. Wallet amounts are internal prototype credits, not USDC or on-chain assets. `hello.cloud` checkpoints store database records and simulated snapshot references; they do not create VM or filesystem snapshots. AML compilation is static validation only. It does not execute missions, deploy applications, call model providers, spend funds, or launch isolated compute.

## Mapping the seven proposed layers

| Proposed layer | Existing foundation | Gap before calling it a cloud service |
| --- | --- | --- |
| Compute substrate | Static AML parser, mission records, Forge typechecking, checkpoint records | Durable execution engine, isolated workers, lifecycle recovery, resource limits, and tested sandbox boundaries |
| Communication mesh | MCP tool service, agent card, A2A-style task methods, contract records | Interoperability tests, authenticated peer discovery, delegation policy, replay protection, and end-to-end trace continuity |
| Identity | Ed25519 key creation, `did:key`, soul versions, identity export | Protected key custody, rotation/revocation policy, portable credential verification, and production threat review |
| Memory | CORE/RECALL/ARCHIVE records, expiry, retrieval budgets, Cortex tools | Documented retention and deletion, isolation guarantees, indexing strategy, and recovery/backup procedures |
| Economy | Local wallet rows, transaction records, spend caps, marketplace workflows | No real payment rail is configured; production needs an audited ledger, idempotent settlement, reconciliation, explicit authorization, and a threat model |
| Evolution | Curriculum and apprenticeship data, evaluation-related records | Reproducible evaluation pipeline, promotion gates, rollback, and evidence that a change improves a declared metric |
| Governance | Contract proposal and lock records, receipts, operator-facing dashboard | No compliance certification or autonomous governance claim; define tenancy, access control, retention, incident response, and independent audit scope |

## Proposed build sequence

1. **Make the control plane explicit.** Version the agent, mission, capability-grant, and receipt schemas. Add request authentication, tenant/workspace scoping, and migration-safe API contracts.
2. **Add a bounded execution lifecycle.** Compile declarative work to a plan, validate every operation against scoped grants, persist state transitions, and require an approval checkpoint for consequential side effects. Reconcile uncertain outcomes after worker restarts.
3. **Connect model providers as optional adapters.** Store provider configuration outside agent prompts, define routing and budget policies, and record provider/model/version metadata in receipts. Never present sample prices or model availability as live facts.
4. **Harden evidence and memory.** Make receipts verifiable, define redaction and retention rules, and exercise backup, restore, deletion, and cross-tenant isolation tests.
5. **Evaluate isolated compute.** Compare an OS-level sandbox or microVM design against the workload and host constraints. Do not claim Firecracker, copy-on-write snapshots, or a cold-start target until implemented and measured on a documented test setup.
6. **Only then add hosted operations.** Establish tenant isolation, monitoring, abuse controls, incident response, service-level definitions, and independent security review before operating a public service.

## Claims and measurements

Performance comparisons, per-operation prices, transaction volumes, model counts, success rates, compliance labels, and “50 ms” execution targets in concept materials are illustrative proposals. They are not HELLO OS measurements, prices, certifications, or service commitments. Publish a benchmark only with the tested revision, hardware, workload, sample size, and measurement method. Describe a certification only after the relevant audit has been completed and can be verified.

## Useful repository entry points

- [Main README](../README.md) — setup, supported deployment, and verified implementation boundaries.
- [AML examples](aml-examples.md) and [grammar](aml-spec.ebnf) — static syntax and validation behavior.
- [MCP handler](../src/lib/mcp/server.ts) — in-process tool registry and HTTP transport; the optional sidecar is in `mini-services/hello-mcp/`.
- [Agent API](../src/app/api/agents/route.ts), [mission API](../src/app/api/missions/route.ts), and [stats API](../src/app/api/stats/route.ts) — current data-backed surfaces.

