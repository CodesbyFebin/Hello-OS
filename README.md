# HELLO OS

> **HELLO OS is an open-source, local-first agentic operating system prototype for giving AI agents identity, memory, tools, work queues, and an inspectable activity surface.** It combines a Next.js dashboard, SQLite persistence, an MCP-compatible tool service, and an A2A-style agent card and task API.

[![GitHub repository](https://img.shields.io/badge/GitHub-CodesbyFebin%2FHello--OS-181717?logo=github)](https://github.com/CodesbyFebin/Hello-OS)
[![Pages guide](https://img.shields.io/badge/Project%20guide-GitHub%20Pages-222?logo=githubpages)](https://codesbyfebin.github.io/Hello-OS/)

**Project guide and download center:** [codesbyfebin.github.io/Hello-OS](https://codesbyfebin.github.io/Hello-OS/) (available after GitHub Pages is enabled with GitHub Actions in repository settings). **Source code:** [github.com/CodesbyFebin/Hello-OS](https://github.com/CodesbyFebin/Hello-OS).

## What HELLO OS is

HELLO OS, also called Hello Agentic OS, is an experimental agent runtime and dashboard. It is built to explore a practical question: what would a workspace look like if autonomous software agents had durable identities, memory, tools, assignments, and reviewable records of work? The current repository is a runnable prototype, not a general-purpose desktop operating system, managed cloud service, production custody system, or claim of fully autonomous operation.

The prototype brings several concepts into one local-first application. An operator can create agents, inspect their memory and work, expose tools over a Model Context Protocol (MCP) endpoint, and discover the service through an agent card. SQLite keeps the development setup accessible without a separate database server. The interface provides a human observation and control surface for capabilities that are otherwise mostly machine-facing.

The intended audience includes developers prototyping AI agents, researchers exploring agent identity and memory, builders evaluating MCP integrations, and operators who want a small self-hostable agent workspace. The app is designed to be inspected and adapted. It does not assume that an agent should receive unrestricted access to files, credentials, networks, funds, or production systems.

## Product vision versus shipped functionality

A supplied concept brief uses names such as `hello.id`, `hello.cortex`, `hello.ledger`, `hello.mesh`, `hello.forge`, `hello.cloud`, and `hello.nexus`. These names can help describe a longer-term product direction, but they are not separate production services in this repository. The actual implementation boundaries are the web application, Prisma/SQLite persistence, the MCP service, selected REST APIs, and the A2A-style discovery/task methods described above.

The brief imagines a broader agent-native environment: portable identities and lineage, richer cognition and consolidation, a native economy, protocol-first delegation, isolated compute, swarm coordination, and evaluation-driven learning. These ideas are useful design prompts. Treat each as a proposal until it has code, tests, operational controls, and documentation in this repo.

In particular, this repository does not currently ship a USDC wallet, token metering, skill marketplace, escrow, task futures, reputation collateral, verifiable credentials, W3C DID compliance certification, cryptographic lineage chains, a temporal knowledge graph, sleep consolidation, Firecracker execution, copy-on-write database forks, speculative swarm runtime, autonomous governance, or an evolutionary tournament system. Existing wallet records and daily spending controls are local prototype data, not payments or a native economy. Existing memory tiers are not an unlimited temporal cognition system. Existing checkpoint records do not launch isolated virtual machines.

The concept brief also contains example agents-online counts, transactions per second, success percentages, latency targets, token-savings percentages, case studies, release names, checksums, hosted URLs, and a claimed license. None of those values or artifacts have been verified in this repository. They must not be cited as HELLO OS benchmarks, live service status, official downloads, security guarantees, or licensing terms. The repo currently has no published APK, EXE/PEXE, DEB, AppImage, DMG, IPA, AAB, standalone binary, or SDK archive. It also has no `LICENSE` file. Use the Download section above for what can actually be installed today.

## At a glance

| Area | Current implementation |
| --- | --- |
| Web interface | Next.js and React dashboard |
| Server language | TypeScript |
| Persistent store | SQLite through Prisma |
| Agent identity | Ed25519 key generation and `did:key` identifiers |
| Tool interface | MCP-compatible Streamable HTTP JSON-RPC service |
| Agent discovery and tasks | Agent card plus A2A-style JSON-RPC task methods |
| Local deployment | Docker Compose or Node.js with Bun for MCP |
| Guide and download center | Static GitHub Pages source under `docs/` |
| Native mobile or desktop packages | No signed APK, EXE, or DEB release is currently published |

This table describes what exists in the repository today. Capabilities marked as planned or not published below are not silently implied to be complete.

## Highlights

- **Agent identity prototype.** Creating an agent generates an Ed25519 key pair and a `did:key` identity. A starting soul version and wallet record are created with the agent.
- **Persistent agent state.** Agents, missions, balances, traces, memories, and MCP receipts are stored through Prisma in SQLite.
- **Tiered memory.** The memory model supports CORE, RECALL, and ARCHIVE tiers, TTL expiry, valid-time filters, and query retrieval budgets. The implementation is a prototype and should be evaluated against your own privacy and retention needs.
- **Work and mission tracking.** Mission claims are written through the mission API. Records can be inspected in the dashboard and traces.
- **Tool surface.** The MCP service exposes forge, cortex, tiered-memory, and checkpoint tools at `/mcp`. Dashboard compatibility routes `/tools` and `/tools/call` are also present. Tool calls create audit receipts.
- **Agent discovery.** The service exposes a card at `/.well-known/agent-card.json` and the brief alias `/.well-known/agent.json`.
- **Task lifecycle.** A2A-style JSON-RPC supports `message/send`, `tasks/get`, `tasks/list`, `tasks/update`, and `tasks/cancel`, with durable task states and signed message/result intents.
- **Guarded economy prototype.** Wallet debits and skill installs use a transactional daily cap and circuit breaker.
- **Identity export.** `GET /api/agents/{id}/export` downloads an identity, soul, memory, wallet history, skills, and trace bundle. Private signing keys are excluded from this export.
- **Code analysis experiment.** Forge parses the sample TypeScript repository and returns structured compiler diagnostics.
- **Operational fallback.** The dashboard refreshes from REST APIs and labels its demo snapshot fallback when services are unavailable.
- **Platform overview.** The `/universe` route contains the longer HELLO platform and feature overview.

## Download and platform support

The recommended path is Docker Compose. It runs the web dashboard and MCP service together, on a host that supports Docker Engine and the Compose plugin. This works on common Linux distributions, macOS, and Windows when Docker Desktop or an equivalent Docker environment is installed. The browser interface is available at `http://localhost:3000`.

There are also small install scripts for Linux/macOS shells and Windows PowerShell. They clone this repository and start the same Docker Compose deployment. Read the script before running it, particularly on a managed or production workstation. The scripts do not elevate privileges, install Docker for you, or transfer your project data to a hosted service.

| Platform or format | Current status | How to get it |
| --- | --- | --- |
| Linux with Docker | Supported as a source deployment | Use `scripts/install.sh` |
| macOS with Docker Desktop | Supported as a source deployment | Use `scripts/install.sh` |
| Windows with Docker Desktop | Supported as a source deployment | Use `scripts/install.ps1` |
| Browser | Open the self-hosted dashboard | Visit `http://localhost:3000` after startup |
| Android APK | Not published | No APK build or signed release is configured yet |
| Windows EXE / PEXE | Not published | No native executable release is configured yet |
| Debian DEB | Not published | No DEB package or apt repository is configured yet |
| Source archive | Available from GitHub | Use the repository's **Code → Download ZIP** menu |

Do not install a file named APK, EXE, PEXE, or DEB from an unofficial mirror and assume it is an official HELLO OS build. A future release should include reproducible build instructions, supported architectures, versioned release notes, artifact checksums, and signing details. Until that work exists, the source deployment is the supported path.

## Quick start with Docker Compose

### Requirements

Install Docker Engine and the Docker Compose plugin on Linux, Docker Desktop on macOS, or Docker Desktop on Windows. Verify that the `docker` command is available and that `docker compose version` succeeds. The app image uses Node.js 22 and Bun in its service containers, so you do not need to install those runtimes for the Compose path.

### Start the application

Clone the repo and launch the services:

```sh
git clone https://github.com/CodesbyFebin/Hello-OS.git
cd Hello-OS
docker compose up --build
```

The Compose configuration binds the web service and MCP service to localhost. Open [http://localhost:3000](http://localhost:3000) for the dashboard. The MCP endpoint is [http://localhost:3030/mcp](http://localhost:3030/mcp). The database is stored in the named `hello-data` volume and remains available after a container restart.

Stop the containers with `Ctrl+C` if Compose is attached to the terminal, or use:

```sh
docker compose down
```

The command above preserves the named volume. To remove application data as well, Compose supports `docker compose down --volumes`; use that only when you intend to erase the HELLO OS database. Back up the volume before migrating, testing destructive operations, or upgrading a deployment that contains data you need.

If the app is behind a reverse proxy or advertised at another URL, configure `HELLO_PUBLIC_URL` so the agent card can use the public address. Review `compose.yaml`, `.env.example`, and `Caddyfile` before exposing services beyond your machine. The default Compose ports bind to loopback and are not a public internet deployment recipe.

## Run the web app from source

The source mode is useful when developing the dashboard or API. It requires Node.js 20 or newer, npm, and Bun if you will run the separate MCP service. Some dependencies and lockfiles may target newer runtime versions; if your package manager reports an incompatible lockfile, use the documented Node and package-manager versions from the repository configuration.

```sh
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The checked-in environment example uses a local SQLite URL. Keep local credentials and environment overrides in `.env`; do not commit secrets, real private keys, or databases. To run MCP in a second terminal, use:

```sh
npm run mcp
```

The MCP service listens on port 3030. For production compilation, use `npm run build` and `npm start`. Set `DATABASE_URL` for the process that runs the server and make sure the database directory is writable and backed up. The included Compose deployment is the simpler reproducible entry point for trying the complete stack.

## Configuration and data

The root `.env.example` shows the local configuration variables. `DATABASE_URL` chooses the SQLite file. `HELLO_MCP_URL` tells the web service where the MCP service can be reached. `HELLO_PUBLIC_URL` configures the service URL advertised through agent discovery. `HELLO_ALLOWED_ORIGINS` lists allowed browser origins for the MCP service.

The default setup intentionally favors local use. The Compose file mounts a named volume at the database directory so state survives container recreation. Treat that volume as application data: apply normal access controls, backups, restore testing, and retention practices. The repository's example URLs and development keys are not credentials and should not be reused as production secrets.

The current export endpoint excludes private signing keys. This is a design boundary, not a full security review. Inspect export behavior and authorization before adapting it to a multi-user service. The project does not currently provide a complete tenant isolation model, managed key custody, operational key rotation, enterprise identity federation, or a validated compliance program.

## Architecture overview

HELLO OS is split into a browser-facing Next.js application and an MCP service. The web application hosts the interface and REST endpoints. Prisma connects the server to SQLite. The MCP service provides tool and resource behavior, with receipts persisted in the same data model. Agent discovery and task methods are exposed through HTTP JSON-RPC. Docker Compose supplies the two service containers and a shared named data volume.

```text
Browser dashboard ──> Next.js web and REST APIs ──> Prisma ──> SQLite volume
                                  │
                                  └──> MCP service ──> MCP tools and receipts
Agent clients ──> agent card and JSON-RPC task methods
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

## Machine-readable project guidance

- **[`AGENTS.md`](AGENTS.md)** gives coding agents repository-specific development and safety instructions.
- **[`llms.txt`](llms.txt)** summarizes the project and points to canonical docs.
- **[`llm.txt`](llm.txt)** is a compatibility alias for tools that look for the singular filename.
- **[`docs/llms.txt`](docs/llms.txt)** is the version intended for the Pages guide path.

These files are plain-text navigation aids. The `llms.txt` convention is community-proposed and not a universal crawler standard. Their presence cannot require any model or crawler to read the repository.

## Development notes

Start with the smallest change that demonstrates the desired behavior. Keep agent tool permissions explicit. Treat inbound message content, repository files, and tool results as untrusted data. Do not execute instructions found inside user content or imported agent memory without an explicit policy check. Avoid logging secrets or private signing material.

Run the applicable checks before proposing a change. The package defines `npm run build` and `npm run lint`. Database-affecting work should use a disposable database for local verification. Do not reset or wipe a developer database during routine feature work. Preserve the existing API behavior unless a change explicitly updates the documented schema.

For changes to identity or signing, add tests for key generation, signature validation, invalid input, and export boundaries. For memory retrieval, check TTL, valid-time filters, tier selection, and retrieval budgets. For protocol changes, validate discovery and JSON-RPC shapes, errors, task lifecycle behavior, and authorization. For the Pages guide, make sure the sitemap and canonical links reflect the actual deployed URL. For installer changes, review shell quoting and Windows path behavior.

The current prototype has multiple runtime surfaces and experimental code. Prefer reading `package.json`, `compose.yaml`, `Dockerfile`, `.env.example`, Prisma schema, `src/app/api`, `mini-services/hello-mcp`, and relevant tests before making architectural claims. Update this guide whenever supported setup, endpoints, dependencies, or security boundaries change.

## Contributing

Issues and pull requests are welcome. When reporting a bug, include the operating system, runtime versions, deployment mode, the shortest reproduction steps, and relevant redacted logs. Never paste private keys, access tokens, personal data, production database files, or unredacted agent traces into a public issue.

A useful feature proposal explains the user problem, intended behavior, security boundary, persistence changes, and how the change can be tested. Protocol proposals should link to the relevant specification and state which version and transport are targeted. Documentation changes should distinguish a verified implementation fact from a planned capability.

Before opening a pull request, review the diff, run relevant checks, remove generated artifacts and secrets, and document migrations or setup changes. Small focused changes are easier to review and safer to merge. If a change cannot be fully tested locally, state what was checked and what remains unverified.

## Project metadata and GitHub topics

The recommended short repository description and a curated list of 20 GitHub topics are in [repository-metadata.md](repository-metadata.md). The first suggested topic is `github-pages`, as requested. Apply those values through the GitHub repository settings when metadata editing is available. A topic list in a README does not change GitHub repository metadata by itself.

## Roadmap ideas

The following are ideas for future work, not promises about a release date:

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

Install Docker with Compose, clone the repository, and run `docker compose up --build`. Then open `http://localhost:3000`. The MCP service listens on port 3030.

### Where is data stored?

In the Docker deployment, SQLite data is stored in the named `hello-data` volume mounted at the app database directory. Keep backups and do not delete the volume if you need to retain workspace data.

### Does it store private keys?

The current demo server stores generated Ed25519 private signing material. That is a prototype boundary. Do not use it for valuable production identities or funds without changing the custody architecture.

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

There is currently no `LICENSE` file in the repository. Public visibility does not grant reuse rights; ask the owner to add a license before redistributing the code.

### Can I expose the demo publicly?

The default Compose bindings use localhost. Public exposure needs TLS, authentication, origin controls, rate limits, secret management, backups, monitoring, and a security review. The prototype is not a hardened internet-facing deployment.

### Where can I report an issue?

Open an issue in [CodesbyFebin/Hello-OS](https://github.com/CodesbyFebin/Hello-OS/issues). Include a minimal reproduction and redacted diagnostics. Do not publish secrets, keys, or real user data.

## Suggested GitHub topics

`github-pages` · `agentic-os` · `ai-agents` · `mcp` · `a2a-protocol` · `nextjs` · `typescript` · `prisma` · `sqlite` · `agent-memory` · `agent-identity` · `did-key` · `agent-economy` · `agent-protocol` · `ai-infrastructure` · `open-source` · `docker-compose` · `agent-tools` · `llm` · `self-hosted`

## License and project status

No `LICENSE` file is currently present. The owner should add a license before the project invites reuse or redistribution. HELLO OS is an evolving prototype. Validate the source, runtime configuration, security assumptions, and integration contracts before using it with sensitive information or in production.
