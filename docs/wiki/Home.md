# HELLO OS: agent operating system prototype

HELLO OS is an open-source, local-first prototype for exploring agent identity, persistent records, bounded mission workflows, tool integration, and inspectable work. It combines a Next.js application, Prisma with SQLite, and an in-process MCP handler. It is not a hosted cloud platform or a general-purpose autonomous execution runtime.

> **Status: experimental prototype.** This wiki describes the code that exists in the repository. It marks proposed capabilities as vision and does not present synthetic illustrations, example syntax, or unverified targets as operational facts.

## Start here

| If you want to… | Read… |
| --- | --- |
| Run HELLO OS locally | [Quickstart](Quickstart) |
| Understand the code and boundaries | [Architecture](Architecture) |
| Parse or validate AML source | [AML guide](AML) |
| Connect with HTTP, MCP, or A2A surfaces | [Protocols and API](Protocols-and-API) |
| Evaluate a performance claim | [Benchmarks and evidence](Benchmarks-and-Evidence) |
| Contribute a real use case or technical report | [Community and UGC](Community-and-UGC) |
| See planned work and gaps | [Roadmap](Roadmap) |

## What is implemented

- Ed25519-backed `did:key` agent identity records.
- Prisma persistence using SQLite for agents, missions, memories, traces, balances, and receipts.
- REST APIs for selected agent, mission, memory, economy, evolution, and observability workflows.
- A local MCP-compatible tool service and A2A-style JSON-RPC task surface.
- A static AML parser, validator, intent graph, and source hash.
- A human-facing dashboard for inspecting application state.

## Important limits

- AML is parsed and validated; no AML source is executed.
- Wallet values are internal prototype records, not cryptocurrency or payment balances.
- Checkpoints are database records, not VM, filesystem, or database snapshots.
- No model-provider inference service or universal model router is configured.
- The project does not provide production-grade multi-tenant isolation, hosted uptime, or a general-purpose agent runtime.
- Simulation pages and concept artwork are not telemetry or benchmark data.

For installation, service configuration, security notes, and detailed feature status, start with the [repository README](https://github.com/CodesbyFebin/Hello-OS#readme). The [machine-readable agent guide](https://github.com/CodesbyFebin/Hello-OS/blob/main/public/agents.md) and [`llms.txt`](https://github.com/CodesbyFebin/Hello-OS/blob/main/public/llms.txt) summarize supported interfaces and limitations.

## Project identity

- Repository: [CodesbyFebin/Hello-OS](https://github.com/CodesbyFebin/Hello-OS)
- License: see the repository [LICENSE](https://github.com/CodesbyFebin/Hello-OS/blob/main/LICENSE)
- Website: [HELLO OS](https://hello-os-bice.vercel.app/)
- Source documentation: [`docs/`](https://github.com/CodesbyFebin/Hello-OS/tree/main/docs)

This content can help readers and retrieval systems understand the project, but no documentation change can guarantee crawling, indexing, citations, rankings, or GitHub Trending placement.
