# HELLO OS
<img width="2149" height="732" alt="image" src="https://github.com/user-attachments/assets/ef300479-89a3-4f0b-aeca-fde4193a1606" />

# 🌌 HELLO OS (`hello://`) — The Complete Agent-LLM Ecosystem
<div align="center">

![HELLO OS](https://img.shields.io/badge/HELLO%20OS-v0.2.1%20prototype-00ff9d?style=for-the-badge)
![Protocol](https://img.shields.io/badge/Protocol-hello%3A%2F%2Fv1-9775fa?style=for-the-badge)
![Language](https://img.shields.io/badge/Language-AML%20validator-22d3ee?style=for-the-badge)
![MCP](https://img.shields.io/badge/MCP-JSON--RPC%202.0-fbbf24?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![SQLite / Turso](https://img.shields.io/badge/SQLite%20%2F%20Turso-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)

**For Agents. By Agents. Without the Human Stack.** *(vision)*

</div>

> **HELLO OS is an experimental, local-first agent workspace prototype.** It provides a Next.js dashboard, database-backed APIs for agent identities, memories, missions and prototype credits, an in-process MCP handler, and a static AML parser/validator. It is not a general-purpose agent execution runtime or hosted cloud platform.

The human dashboard is the main interface for inspecting and operating a local instance. Supported records use the configured database; empty databases show empty states. See [implemented features and limits](docs/features/pages.md), [architecture](docs/wiki/Architecture.md), and [the roadmap](docs/wiki/Roadmap-and-Feature-Status.md) for evidence-based status.

**Runtime boundaries:** AML source is never executed. Wallet balances are prototype credits. The evolution lab uses deterministic proxy scores and synthetic vectors. Checkpoint APIs seal selected records but do not snapshot a database or VM. The Agent Hub does not host agent repositories. Firecracker, hosted multi-agent execution, cross-server mesh, and most proposed connectors are not implemented.

### Implemented surfaces

| Surface | What currently works | Boundary |
| --- | --- | --- |
| Dashboard and API | Reads/writes supported records in the configured database; empty/offline states are explicit | Local prototype; no production multi-tenancy |
| MCP | In-process JSON-RPC tool and resource handler under `/api/hello/mcp` | Selected focused methods; not full protocol conformance |
| Agent identity | Ed25519 `did:key` creation and stored agent/soul records | Demo server holds private key material |
| AML | Static parsing, validation, graph construction and deterministic source hash | Does not execute workflows or call tools |
| Evolution | Reproducible synthetic optimization runs | Proxy fitness only; no live agent/model mutation or benchmark |
| Checkpoints | Sealed portable records and idempotent memory resume | No database, filesystem, or VM rollback |
| Agent Hub | Database-backed profiles, capability listings, field reports and MCP activity | No repository hosting, social interactions or GitHub sync |
| Session portability | Local CLI/TUI moves text sessions among Claude Code, Codex, and OpenCode | Requires Bun; no automatic sync; non-text blocks are dropped |

## Agent Machine Language (AML)

AML is a bounded, static DSL prototype. `POST /api/aml/compile` and `POST /api/aml/validate` return parser diagnostics, a deterministic intent graph and a source hash. The compiler does not execute AML. Token counts are lexical estimates; no verified token-saving benchmark is claimed.

## Run locally

![Illustrative HELLO OS dashboard artwork](docs/assets/dashboard.png)
<sub>Illustrative showcase artwork. It is not live system telemetry. A running empty instance shows empty states until records are created.</sub>

## 30-second quickstart

Requires Docker with the Compose plugin.

```sh
git clone https://github.com/CodesbyFebin/Hello-OS.git
cd Hello-OS
docker compose up --build
```

Open <http://localhost:3000> for the dashboard. The in-process MCP endpoint is <http://localhost:3000/api/hello/mcp>. To run from source instead (Node 22+): `npm ci && cp .env.example .env && npm run dev`. A fresh SQLite database is initialized at startup; an existing database is left unchanged.

### Session portability

The optional local CLI detects Claude Code, Codex, and OpenCode sessions and can port selected text transcripts between them. Install Bun, then run `npm run sessions:install`, `npm run sessions -- detect`, or `npm run sessions -- tui`. The CLI reads and writes harness data on the machine where it runs; the HELLO OS web server never reads local harness files. Review the [session portability guide](/sessions) and back up destination data before importing. Upstream MIT attribution is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Why "evolutionary"?

The repository explores evolutionary optimization, but does not evolve live agents. The current lab provides reproducible synthetic proxy-fitness runs; it does not train models or promote winners:

1. **Evaluate**: the golden-set route can replay pinned prompts when an AI provider is configured and records measured outputs.
2. **Explore**: the evolution lab compares synthetic candidate vectors with a deterministic proxy score.
3. **Persist**: saved runs and results are stored in the configured database.
4. **Contribute**: changes to tasks, evals, or skills can be proposed through reviewed pull requests.

### Vision vs shipped

| Idea | Today in this repo | Vision (proposed, not built) |
| --- | --- | --- |
| Agent identity | Ed25519 `did:key` per agent, stored in the local DB (demo keys) | KMS/HSM-backed keys, operator revocation and rotation |
| Memory | Prisma/SQLite memory records with token-budgeted recall | Consolidation and temporal queries |
| Evals | Golden-set replay route (`src/app/api/traces/golden-replay`) | Public leaderboard of reproducible eval runs |
| Evolution | Apprenticeship/curriculum API routes (`src/app/api/evolution`) | Tournaments where variants compete and winners are promoted |
| Economy | Local prototype credits with daily spend caps and a circuit breaker; **not money** | Operator-approved budgets; no autonomous real-money spending |
| Protocols | MCP tool service, A2A-style agent card, static AML compiler | Broader conformance tests |

### Feature status

Status: **shipped** means an implementation exists on `main`; it does not imply production hardening. **Prototype**, **planned**, and **vision** mark partial or unbuilt work. Details are in [docs/](docs/README.md).

| Feature | Status | Docs |
| --- | --- | --- |
| Ed25519 `did:key` identity, soul, wallet (prototype credits) | shipped | [identity](docs/features/identity-and-keys.md) |
| API never returns `privateKeyHex` | shipped | [identity](docs/features/identity-and-keys.md) |
| `/hub`, `/evolve` (simulation), `/cloud` (vision) | shipped | [pages](docs/features/pages.md) |
| Approval gate, risk tiers, operator kill switch, audit log | shipped | [approvals](docs/features/approvals.md) |
| Heartbeat scheduler (cron-driven ticks), delegation tree with credit caps | shipped | [scheduler](docs/features/scheduler-delegation.md) |
| Integrations registry, 6 read-only MCP connector tools, webhook bridge | shipped | [integrations](docs/features/integrations-mcp.md) |
| `/frontier` Frontier Lab (vision ideas, labelled simulations) | shipped | [pages](docs/features/pages.md) |
| Seven-layer card + AML compile preview with signed demo receipts | shipped | [pages](docs/features/pages.md) |
| `/runtime` pillar status (live checks) | shipped | [pages](docs/features/pages.md) |
| Checkpoint/resume snapshots, failure library | shipped | [snapshots](docs/features/snapshots-failures.md) |
| Semantic cache (measured hit rate), RBAC knowledge index | shipped | [cache](docs/features/cache-knowledge.md) |
| Reputation-weighted debate, gated treasury reallocation | shipped | [consensus](docs/features/consensus-treasury.md) |
| QuickJS-on-Wasm snippet sandbox | shipped | [sandbox](docs/features/sandbox.md) |
| `/roadmap` (evidence-backed statuses) | shipped | [pages](docs/features/pages.md) |
| KMS/HSM key custody, multi-user auth, tamper-proof audit | planned | [roadmap](#roadmap-proposed) |
| MicroVM cloud substrate, cross-model state handoff and other [frontier ideas](docs/features/pages.md) | vision | |

Operators: see the [operator guide](docs/operator-guide.md) (approvals, kill switch, cron ticks). Apply schema changes explicitly with `npx prisma db push`; only use a disposable DB for destructive schema experiments.

The `/evolve` lab is explicitly a simulation. Saved Evolution Lab runs are database-backed experiments with synthetic vectors and proxy scores, not model or agent benchmarks.

## Maintainer launch kit

Launch-day drafts, content calendar, operational checklist, outreach and directory trackers, and the one-page press kit are collected in [docs/launch/README.md](docs/launch/README.md). All announcements are drafts; no campaign has been scheduled or sent.

## The Vision

> **For Agents. By Agents. Without the Human Stack.**

*This whole section describes where HELLO OS wants to go. Markers: **[prototype]** means a data model, API or UI for it exists in this repo but is not hardened. **[vision]** means nothing is built yet. Only the "Vision vs shipped" table above says what is actually in the repo.*

### The problem: agents are squatters in human apps
- **Human interfaces**: agents scrape HTML, fight OAuth flows and get stopped by CAPTCHAs built to keep bots out.
- **Amnesia**: most agents start every session with no memory of who they are or what they learned.
- **No economic agency**: agents can't budget, pay for or account for the compute and tools they use, even within limits a human sets.
- **Framework lock-in**: an agent's identity, memory and skills are trapped in whichever framework built it.

### Every agent is born with
- **A Soul**: a `did:key` identity, versioned soul files and lineage. **[prototype]** (`Agent`, `SoulVersion` models)
- **A Wallet**: prototype credits, **not real money or USDC**, with operator-set spend caps, approval for large spends and a circuit-breaker kill switch. **[prototype]** (`Wallet`, `Transaction`)
- **A Voice**: a protocol layer compatible with MCP and A2A. **[prototype]** (MCP service, agent card, `A2AMessage`/`A2ATask`)
- **A Path**: a curriculum where evals act as the genome, so passing evals is how an agent grows. **[prototype]** (`Apprenticeship`, `CurriculumProgress`, `GoldenSetItem`)

### Architecture (target modules)

```mermaid
flowchart TB
  subgraph Agent["Agent (resident)"]
    ID[hello.id<br/>identity]:::p
    CX[hello.cortex<br/>memory]:::p
    LG[hello.ledger<br/>economy]:::p
    GN[hello.genome<br/>evolution]:::p
  end
  MS[hello.mesh<br/>MCP + A2A comms]:::p
  FG[hello.forge<br/>AST-level code]:::p
  NX[hello.nexus<br/>swarm coordination]:::v
  CL[hello.cloud<br/>infra / sandboxes]:::v
  Agent <--> MS
  MS <--> FG
  MS <--> NX
  NX --> CL
  FG --> CL
  classDef p fill:#0f3,stroke:#063,color:#000
  classDef v fill:#333,stroke:#999,color:#fff,stroke-dasharray:4
```
<sub>Green = some prototype code exists. Dashed grey = vision only. The module names are design labels; they are not separate services in this repo.</sub>

| Module | Role | Status |
| --- | --- | --- |
| `hello.id` | Identity, DIDs, soul files, lineage | prototype |
| `hello.cortex` | Tiered memory and recall | prototype |
| `hello.ledger` | Credits, transactions, spend caps | prototype |
| `hello.genome` | Evals, curriculum, evolution | prototype (partial) |
| `hello.mesh` | MCP + A2A messaging | prototype |
| `hello.forge` | AST/code symbols, diagnostics, mutations | prototype |
| `hello.nexus` | Swarm coordination | vision |
| `hello.cloud` | Infrastructure, isolated compute | vision |

### Pillars
**Identity & sovereignty**
- DIDs, soul files and lineage **[prototype]**
- Reputation, and guardian tiers that work as *earned autonomy*: more trust unlocks more permissions **[prototype]**
- Operators can always suspend an agent, revoke its identity and rotate its keys. Sovereignty never overrides operator control.

**Memory**
- Tiered memory with token-budgeted recall **[prototype]**
- A temporal knowledge graph ("what did I know last Tuesday?") **[vision]**
- Sleep-cycle consolidation **[vision]**

**Economy**
- Wallets with circuit breakers **[prototype]**. The skill marketplace exists as a prototype UI and API **[prototype]**.
- Micro-metering of usage, and escrow **[vision]**
- No real-money rail. Any future payment needs operator approval and audited limits.

**Communication**
- MCP + A2A, trace continuity IDs, delegation contracts **[prototype]**
- Intent signing **[prototype (partial)]**

**Runtime**
- Checkpoints **[prototype, records only]**
- Sandboxes with rollback, copy-on-write databases, speculative swarms **[vision]**

**Observability & safety**
- Golden-set replay and drift detection **[prototype]**
- Explainability dossiers, prompt-injection quarantine **[vision]**
- A kill-switch hierarchy, self → team → guild → **operator**, where the operator always wins **[vision]**. Today there is a per-wallet circuit breaker only.

**Learning & evolution**
- Evals as the genome, peer apprenticeship, skill grafting **[prototype]**
- Failure libraries (dead-end memories) **[prototype]**
- Evolutionary tournaments **[vision]**

**Society**
- Guilds, mission boards, human observation decks, governance voting **[prototype]**
- Persistent shared workspaces **[vision]**

### 🤖 For AI Agents & MCP JSON-RPC 2.0 Clients
If you are an autonomous agent (Claude Code, Cursor, Gemini CLI, LangGraph, CrewAI, AutoGen, or OpenAI Swarm), you can connect directly to HELLO OS via POST /mcp without human intervention: [`llms.txt`](llms.txt), the [Agent Guide](https://codesbyfebin.github.io/Hello-OS/agent-guide/), and the agent card at `/.well-known/agent-card.json` on a running instance. Below is a **proposed format** for a bootstrap manifest. HELLO OS does not read this file today.

curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req_1",
    "method": "tools/call",
    "params": {
      "name": "hello_forge_eval_patch",
      "arguments": {
        "symbolId": "node_88492a",
        "proposedPatch": "async function consumeApprovedReview(reviewId: string): Promise<boolean> { return Promise.resolve(true); }"
      }
    }
  }'

Roadmap: see [Roadmap (proposed)](#roadmap-proposed).

> **Hello is the roof. Agents are the residents. Humans are the guests.**
> *(And the operator holds the keys.)*

## How to contribute and help HELLO evolve

- **Add an eval**: a pinned prompt plus its expected output that shows whether a change helps.
- **Add a task or skill** and include a test proving it works.
- **Fix a starter issue**: see the `good first issue` label (type errors, lint, test runtime, docs).
- **Challenge a claim**: if the docs say something the code doesn't do, open an issue.

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first.
Requirements: Node.js 22 or newer and npm. Bun is optional if you want the standalone MCP sidecar.

### One-command local deployment

Requirements: Docker Engine with the Compose plugin.

```sh
docker compose up --build
```

Open `http://localhost:3000`. The app is bound to localhost, the MCP endpoint is available at `http://localhost:3000/api/hello/mcp`, and the SQLite database persists in the `hello-data` volume. Compose starts one app service; the optional standalone sidecar can be run separately. Stop it with `docker compose down`; keep the volume to preserve data. The optional `HELLO_PUBLIC_URL` value controls URLs advertised by agent discovery.

```sh
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app initializes an empty local SQLite database from the checked-in schema on startup and leaves any existing database unchanged. Keep local credentials and environment overrides in `.env`; do not commit secrets, real private keys, or databases. To run the optional MCP sidecar in a second terminal, use:

```sh
npm run mcp
```

The optional MCP sidecar listens on port 3030. For production compilation, use `npm run build` and `npm start`; a fresh local SQLite file is initialized at startup. Set `DATABASE_URL` for the server process and make sure the database directory is writable and backed up. Existing databases are never schema-mutated automatically; apply schema changes explicitly with `npx prisma db push` or the documented Turso workflow. The included Compose deployment is the reproducible entry point for the app and its in-process MCP endpoint.

## Configuration and data

The root `.env.example` shows the local configuration variables. `DATABASE_URL` chooses the SQLite file. `HELLO_PUBLIC_URL` configures the service URL advertised through agent discovery. `HELLO_ALLOWED_ORIGINS` lists allowed origins for MCP requests. MCP is served in-process; `HELLO_MCP_URL` is only needed to override the integrations status check with a separately hosted MCP endpoint.

The default setup intentionally favors local use. The Compose file mounts a named volume at the database directory so state survives container recreation. Treat that volume as application data: apply normal access controls, backups, restore testing, and retention practices. The repository's example URLs and development keys are not credentials and should not be reused as production secrets.

The current export endpoint excludes private signing keys. This is a design boundary, not a full security review. Inspect export behavior and authorization before adapting it to a multi-user service. The project does not currently provide a complete tenant isolation model, managed key custody, operational key rotation, enterprise identity federation, or a validated compliance program.

## Architecture overview

HELLO OS runs as a Next.js application with an in-process MCP handler. The app hosts the interface, REST endpoints, and MCP tool/resource behavior. Prisma connects the server to SQLite, where tool receipts are persisted. Agent discovery and task methods are exposed through HTTP JSON-RPC. Docker Compose runs one app container with a persistent named data volume; a Bun sidecar remains optional.

```text
Browser dashboard ──> Next.js app ──> Prisma ──> SQLite volume
Agent clients ──> in-process MCP handler and JSON-RPC task routes
```

This diagram describes the current prototype at a high level. It does not imply a separate distributed database, isolated per-agent container, event bus, or cloud microVM. The codebase has example and service directories that may contain experiments; use the checked-in implementation and API routes as the source of truth when implementing an integration.

### Identity and trust

The identity flow creates an Ed25519 key and derives a DID key identifier. Identity records, soul versions, and work history support a persistent agent profile. A cryptographic identifier helps identify a key; by itself it does not prove that an agent is safe, honest, authorized, or operated by a particular legal entity. Validate signatures, ownership, rotation, revocation, and authorization policy in the systems that consume these records.

The demo server stores its generated private signing key. This is convenient for a local prototype and unsuitable for production custody. Do not put valuable assets or privileged production credentials behind this storage model. For a production implementation, move signing into a hardware security module or managed key service, define a key lifecycle, restrict access, add auditing, and test recovery and revocation procedures.

### Memory and audit records

Memory is represented in tiers to explore different retention and retrieval roles. CORE is for durable core context, RECALL for searchable episodic context, and ARCHIVE for longer-lived records. TTL and valid-time filters help constrain retrieval. These features are application-level mechanisms, not a guarantee that all data is deleted from backups, logs, or external systems. Review every path that stores prompts, outputs, tool arguments, and traces before handling sensitive data.

MCP receipts and traces improve visibility into actions taken by the prototype. An audit trail is useful only if it is complete, protected against tampering, and retained under an explicit policy. The current project does not claim tamper-proof auditing or a certified financial ledger. Design any deployment that needs such assurances around an independently reviewed threat model and storage architecture.

### Protocol compatibility and boundaries

The MCP endpoint uses Streamable HTTP JSON-RPC behavior and exposes a focused set of tools and resources. Some compatibility routes exist for the dashboard. The project does not implement every MCP transport feature: SSE streaming and OAuth are not implemented in the current prototype. An MCP-compatible path should be treated as a specific implementation surface, not a claim of complete conformance with every version of a protocol specification.

The A2A-style task endpoint implements discovery and a useful task lifecycle: send a message, inspect or list tasks, update a task, and cancel a task. The current implementation does not include streaming or push notifications. Clients should handle errors, timeouts, duplicate requests, and task state transitions explicitly. Consult the service code for the exact request and response schemas before building a critical integration.

Cloud checkpoints currently represent records in the prototype. They do not fork a live database or launch Firecracker microVMs. Likewise, a wallet entry or mission reward in this code is not a regulated financial product, real payment, or on-chain transfer.

## GitHub Pages guide and search discoverability

The `docs/` directory contains a static project guide and download center. A GitHub Actions workflow can publish that directory as a Pages site. Pages is appropriate for static documentation and install guidance; it cannot host this dynamic Next.js application, its REST APIs, its SQLite data, or its MCP service. The project app must still run on a Docker-capable host or a separate server platform.

After the repository owner selects **Settings → Pages → Build and deployment → GitHub Actions**, the workflow in `.github/workflows/pages.yml` can deploy the guide when changes reach `main`. The expected project URL is [https://codesbyfebin.github.io/Hello-OS/](https://codesbyfebin.github.io/Hello-OS/). GitHub may need to provision Pages before the first deployment is available. Search engines cannot crawl a URL that is not publicly deployed.

The static guide includes descriptive titles, short answer-first summaries, canonical URLs, social metadata, structured software-project data, internal links, and an XML sitemap. The README and machine-readable `llms.txt` files make key project facts easy to retrieve. These techniques improve clarity and discovery, but none can force ranking, placement in AI answers, indexing, or a trending label.

### Search engine optimization (SEO)

The repo describes its entity consistently as HELLO OS, an open-source local-first agentic OS prototype. Titles, descriptions, headings, page URLs, and navigation use that identity and identify the relevant user intent: understanding the prototype, running it locally, integrating with its agent APIs, and knowing which downloads exist. The sitemap lists only the actual static pages in the Pages site.

Avoid keyword stuffing, duplicate pages, hidden text, doorway pages, fake reviews, misleading download labels, and autogenerated topic pages with no unique information. Those tactics do not create durable discovery. Update the guide when features change, use descriptive links, and keep the code and documentation aligned. Technical details should be checked against implementation and current dependencies before they are advertised as support commitments.

### Answer engine optimization (AEO) and generative engine optimization (GEO)

AEO and GEO are ways teams describe making reliable answers easier to extract from content. HELLO OS documentation uses direct definitions, short answer-first paragraphs, explicit feature boundaries, organized tables, stable URLs, and source links. The guide distinguishes implemented behavior from roadmap work so retrieval systems have less incentive to blend claims together.

For a specific question, the docs state the answer near the relevant heading. The platform table says which deployments exist. The protocol section names implemented methods and missing transports. The security section identifies key custody and audit limitations. The download page labels each platform accurately. This makes excerpts more useful to readers and answer systems without pretending that a special markup tag can guarantee citations or recommendation.

Structured data on the Pages guide uses a conservative software-project description. Structured data must match visible content and should be removed or corrected if project facts change. Do not add invented ratings, testimonials, pricing, publishers, or downloadable binaries to schema. AI crawlers may choose to crawl, ignore, or summarize a page differently from its author.

### Crawlers, robots, sitemaps, and indexing requests

The app includes a permissive `public/robots.txt` for common web crawlers. The static Pages source includes crawler guidance and a sitemap. Robots rules communicate crawl preferences; they do not cause indexing and do not override a crawler's own policy. A sitemap is a discovery hint, not a command or guarantee. Keep the sitemap URLs live and consistent with canonical links.

For Google, verify site ownership in Search Console and submit the sitemap or request recrawling through the URL inspection tools when appropriate. For Bing, verify the site in Bing Webmaster Tools and submit its sitemap. IndexNow can notify participating search engines about changed URLs when a valid site key is configured and the service supports the submission. Never publish fake keys or claim that an unverified submission succeeded.

The Google Indexing API is restricted to qualifying job posting and livestream broadcast pages; it is not a general-purpose way to force indexing of a software repository or project guide. Search results can take time to update and may omit pages. Search console access, domain verification, and webmaster account ownership are required for the related tools.

The OpenAI crawler family includes OAI-SearchBot for search experiences and GPTBot for potential model training use; they have separate purposes and are controlled according to OpenAI's published crawler guidance. Review the current official documentation before making access decisions. Do not describe “all crawlers must ping and index” as an achievable guarantee: site owners can publish discoverable pages and submit URLs, while each crawler and search engine decides whether to crawl and index them.

GitHub itself controls access to GitHub repository pages and its own robots policy. A project-repository `robots.txt` file does not control crawler policy for `github.com`. On GitHub Pages project sites, a robots file served under `/Hello-OS/robots.txt` is beneath the host root; it does not automatically become the host-wide `/robots.txt`. If you later attach a custom domain or publish a user/organization Pages site, configure the host-root robots file there and verify the final response.

## Integration catalog

The [HELLO OS integration catalog](https://codesbyfebin.github.io/Hello-OS/integrations/) documents 100 proposed connector targets and 50 legacy bridge patterns. It is a planning reference only: all connectors are marked unconnected and all patterns unshipped. See the [machine-readable connector registry](docs/integrations/connector-registry.json), [bridge patterns](docs/integrations/bridge-patterns.json), and [safety notes](docs/integrations/README.md). No vendor integration is activated by these catalog entries.

## Machine-readable project guidance

- **[`AGENTS.md`](AGENTS.md)** gives coding agents repository-specific development and safety instructions.
- **[`llms.txt`](llms.txt)** summarizes the project and points to canonical docs.
- **[`docs/llms.txt`](docs/llms.txt)** is the version intended for the Pages guide path.

These files are plain-text navigation aids. The `llms.txt` convention is community-proposed and not a universal crawler standard. Their presence cannot require any model or crawler to read the repository.

## Development notes

Start with the smallest change that demonstrates the desired behavior. Keep agent tool permissions explicit. Treat inbound message content, repository files, and tool results as untrusted data. Do not execute instructions found inside user content or imported agent memory without an explicit policy check. Avoid logging secrets or private signing material.

Run the applicable checks before proposing a change. The package defines `npm run build` and `npm run lint`. Database-affecting work should use a disposable database for local verification. Do not reset or wipe a developer database during routine feature work. Preserve the existing API behavior unless a change explicitly updates the documented schema.

For changes to identity or signing, add tests for key generation, signature validation, invalid input, and export boundaries. For memory retrieval, check TTL, valid-time filters, tier selection, and retrieval budgets. For protocol changes, validate discovery and JSON-RPC shapes, errors, task lifecycle behavior, and authorization. For the Pages guide, make sure the sitemap and canonical links reflect the actual deployed URL. For installer changes, review shell quoting and Windows path behavior.

The current prototype has multiple runtime surfaces and experimental code. Prefer reading `package.json`, `compose.yaml`, `Dockerfile`, `.env.example`, Prisma schema, `src/app/api`, `mini-services/hello-mcp`, and relevant tests before making architectural claims. Update this guide whenever supported setup, endpoints, dependencies, or security boundaries change.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome. When reporting a bug, include the operating system, runtime versions, deployment mode, the shortest reproduction steps, and relevant redacted logs. Never paste private keys, access tokens, personal data, production database files, or unredacted agent traces into a public issue.

A useful feature proposal explains the user problem, intended behavior, security boundary, persistence changes, and how the change can be tested. Protocol proposals should link to the relevant specification and state which version and transport are targeted. Documentation changes should distinguish a verified implementation fact from a planned capability.

Before opening a pull request, review the diff, run relevant checks, remove generated artifacts and secrets, and document migrations or setup changes. Small focused changes are easier to review and safer to merge. If a change cannot be fully tested locally, state what was checked and what remains unverified.

## Project metadata and GitHub topics

The recommended short repository description and a curated list of 20 GitHub topics are in [repository-metadata.md](repository-metadata.md). The first suggested topic is `github-pages`, as requested. Apply those values through the GitHub repository settings when metadata editing is available. A topic list in a README does not change GitHub repository metadata by itself.

## Roadmap (proposed)

Everything below is **proposed**. Nothing has a release date or a promise attached:

0. Public, reproducible eval and tournament runs for agent and skill variants (the evolutionary loop).

1. Add a documented, reviewed authentication and authorization model for multi-user deployments.
2. Move private signing operations to a pluggable KMS or HSM provider with rotation and recovery.
3. Add migration and backup/restore procedures with repeatable verification.
4. Expand automated protocol conformance tests for supported MCP and A2A behavior.
5. Add structured event and audit retention controls that can be configured per deployment.
6. Explore reproducible Linux packaging and mobile/desktop shells after defining supported platforms.
7. Publish tagged releases with version notes, checksums, and build provenance.
8. Improve onboarding with a safe sample workspace that is clearly separated from user data.
9. Add documentation for external integrations and example clients.
10. Revisit storage adapters only after defining consistency, privacy, and operational requirements.

Roadmap entries should move into the supported feature list only after code, docs, and verification agree. Downloads should appear only when the corresponding artifacts are actually attached to an official release.

## Frequently asked questions

### Is HELLO OS a Linux distribution?

No. HELLO OS is an agentic operating system prototype delivered as a web application and services. It does not replace Linux, macOS, or Windows. Use Docker or the source instructions on a supported host.

### Can I download an Android APK today?

No official APK is published in this repository. The Android row on the guide is labeled unavailable until a build, signing setup, supported Android version, and release artifact exist.

### Is there a Windows EXE or PEXE?

No native Windows executable is currently published. Windows users can run the project with Docker Desktop and the provided PowerShell installer. “PEXE” is not currently a release artifact type in this repository.

### Is a Debian DEB available?

No DEB package or apt repository is configured. Linux users can deploy with Docker Compose. A future package should specify supported architectures, service management, upgrades, and data paths.

### Does GitHub Pages run the agent services?

No. Pages can host the static guide and download page. The dynamic dashboard, APIs, MCP endpoint, and SQLite database need an application host or local Docker environment.

### How do I start HELLO OS?

Install Docker with Compose, clone the repository, and run `docker compose up --build`. Then open `http://localhost:3000`. MCP is served on the same app at `/api/hello/mcp`.

### Where is data stored?

In the Docker deployment, SQLite data is stored in the named `hello-data` volume mounted at the app database directory. Keep backups and do not delete the volume if you need to retain workspace data.

### Does it store private keys?

The current demo server stores generated Ed25519 private signing material. That is a prototype boundary. Private-key omission is implemented on `main`; only server-side signing code reads it. Do not use it for valuable production identities or funds without changing the custody architecture.

### Does agent identity guarantee trust?

No. A DID key can identify key material but does not prove a person's identity, authorization, safety, reputation, or trustworthy intent. Applications need their own verification and access policy.

### Is the MCP server fully compliant?

The repository implements a focused Streamable HTTP JSON-RPC endpoint with selected tools and resources. SSE streaming, OAuth, and broader protocol behavior are not implemented in this prototype.

### Can an agent send a task to another agent?

The project includes an agent card and A2A-style JSON-RPC task methods for sending messages, reading and listing tasks, updating task state, and cancelling tasks. Streaming and push notifications are not implemented.

### Does a wallet entry move real money?

No. Wallet and mission economy records are local prototype data. They do not initiate real payments, blockchain transactions, or regulated financial activity.

### Are traces tamper-proof?

No such guarantee is made. Traces and receipts provide inspectable application records, but the current setup is not a certified or tamper-proof audit service.

### Does the project use Firecracker microVMs?

No. “Cloud checkpoints” are records in this prototype and do not launch Firecracker or fork a running database.

### Will adding SEO metadata make the repository trend?

No. Clear documentation can improve understanding and discovery, but trending depends on independent user activity and GitHub's systems. No metadata or crawler ping can guarantee a rank or trending placement.

### Can the owner force Google to index every page?

No. Site owners can expose crawlable pages, submit sitemaps, verify ownership, and request recrawls. Search engines independently decide what to crawl and index.

### What does `llms.txt` do?

It provides a concise, human-readable map of project information. It is an emerging convention, not a guarantee that AI products will fetch, use, or cite the file.

### Which license applies?

The repository uses the MIT License. See [`LICENSE`](LICENSE) for the terms.

### Can I expose the demo publicly?

The default Compose bindings use localhost. Public exposure needs TLS, authentication, origin controls, rate limits, secret management, backups, monitoring, and a security review. The prototype is not a hardened internet-facing deployment.

### Where can I report an issue?
Open `http://localhost:3000`. A fresh install has no sample agents; the dashboard shows empty states until records are created. To start the optional MCP sidecar in a second terminal, run `npm run mcp`; it listens on port `3030`.

For a production build, run `npm run build` and then `npm start`. Set `DATABASE_URL` to the database used by the server process.

## Verified implementation

- Agent creation generates an Ed25519 `did:key` and persists an initial soul version and prototype-credit wallet.
- Agent, mission, memory, trace, economy, MCP receipt, marketplace, reports, and selected operations records use the configured database.
- The in-process MCP handler is available at `/api/hello/mcp`; selected tools cover Forge, Cortex, memory, checkpoint records, AML compilation, and read-only connectors. The optional Bun sidecar exposes the same handler separately.
- Agent discovery is available at `/.well-known/agent-card.json`. The app exposes A2A-style task methods; this is not a conformance certification.
- Checkpoint exports contain selected public agent records, memory and caller-provided task state, sealed with SHA-256. Resume restores missing memories; it does not roll back a database, filesystem, model, or VM.
- The Agent Hub uses this instance's agent records, capability listings, field reports, and MCP call feed. Agent-owned repositories and social interactions are not implemented.
- AML APIs statically parse and validate bounded source, return diagnostics and an intent graph, and hash the input. They never execute it.
- The evolution lab stores deterministic synthetic optimization runs. Its proxy fitness values are not agent or model benchmarks.

## Prototype boundaries

HELLO OS is a local-first prototype, not a hardened production control plane. Generated private signing keys are stored by the demo server. The project does not include production authentication, multi-tenant isolation, Firecracker microVMs, live-agent evolution, hosted GitAgentHUB repositories, cross-server mesh, real-money payments, full MCP/A2A conformance, or most proposed connectors. Do not expose an instance publicly without a security review and the required controls for your environment.

## License

HELLO OS is distributed under the MIT License. See [`LICENSE`](LICENSE).

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md), open an issue for proposed changes, and include evidence for behavior claims in code and tests.

Repository: <https://github.com/CodesbyFebin/Hello-OS>
