// Content for the /docs portal, including the HELLO OS explainer and runtime design proposal.
// Every capability is marked by what exists in this repository:
//   implemented: a real route or API you can call today (prototype quality).
//   prototype:   partial or simulated; works with honest limits stated.
//   vision:      design direction only; nothing in the repo does this yet.
// No benchmark figures are claimed. Credits are prototype units (H), not money.

export type Status = "implemented" | "prototype" | "vision";
export type Feature = { name: string; status: Status; detail: string; href?: string };
export type Table = { caption: string; head: string[]; rows: string[][]; note?: string };
export type Section = { heading: string; body: string[]; code?: { label: string; text: string } };
export type DocPage = {
  slug: string; n: number; tab: string; title: string; question: string;
  description: string; answer: string; sections: Section[]; features: Feature[];
  tables?: Table[]; widget?: "aml" | "ugc" | "discovery";
};

export const DOC_PAGES: DocPage[] = [
  {
    slug: "overview", n: 1, tab: "Home & overview", title: "What is HELLO Agentic OS?",
    question: "What is HELLO Agentic OS (hello://)?",
    description: "HELLO OS is an open-source, local-first agentic OS prototype: agent identity, memory, missions, MCP tools and budgeted credits, with each feature marked implemented, prototype or vision.",
    answer: "HELLO Agentic OS (hello://) is an MIT-licensed, local-first prototype of an operating system for AI agents. Today it gives agents Ed25519 did:key identities, tiered memory, missions, an MCP tool service, A2A-style task delegation and credit wallets with daily caps, all in a Next.js + SQLite app. MicroVM compute and multi-model routing are design goals, not shipped features.",
    sections: [
      { heading: "How does HELLO OS differ from a general-purpose cloud?", body: [
        "General clouds are built around human operators: dashboards, OAuth consent screens and monthly invoices. HELLO OS is designed around agents as the primary user: signed identities, machine-readable discovery, structured diagnostics and budgets enforced per action.",
        "The table below states design differences only. HELLO OS has not been benchmarked against AWS, GCP or Azure, so it claims no speed or cost gains.",
      ] },
    ],
    tables: [{
      caption: "Design differences (vision, not measured)",
      head: ["Dimension", "Typical human-oriented cloud", "HELLO OS design direction", "Status in this repo"],
      rows: [
        ["Compute unit", "Containers / VMs managed by operators", "Isolated per-intent sandboxes; today a QuickJS Wasm sandbox", "Prototype (Wasm sandbox); MicroVMs are vision"],
        ["Identity & auth", "OAuth2, API keys in .env files", "Per-agent Ed25519 did:key identity and signed messages", "Implemented"],
        ["Code change & CI", "Text diffs and raw compiler logs", "AST symbol index and structured JSON diagnostics", "Implemented (forge index + typecheck)"],
        ["Memory", "Stateless sessions plus external vector DB", "Tiered memory plus a failure registry agents can query", "Implemented"],
        ["Billing", "Post-paid invoices", "Prepaid credit wallets with daily caps and a circuit breaker", "Implemented (prototype credits)"],
      ],
      note: "No efficiency, latency or cost figures are claimed for any row.",
    }],
    features: [
      { name: "Mission Control dashboard", status: "implemented", detail: "Live view of agents, missions and credits.", href: "/" },
      { name: "Agent registry API", status: "implemented", detail: "Create and list agents.", href: "/api/agents" },
      { name: "Machine-readable discovery", status: "implemented", detail: "llms.txt and an A2A agent card generated from real routes.", href: "/llms.txt" },
      { name: "Roadmap", status: "implemented", detail: "Public 100-step plan with per-step status.", href: "/roadmap" },
    ],
  },
  {
    slug: "cloud-layers", n: 2, tab: "HELLO Cloud (7 layers)", title: "The 7 layers of HELLO Cloud",
    question: "How do the 7 layers of HELLO Cloud work?",
    description: "The seven HELLO Cloud layers (compute, mesh, identity, memory, economy, evolution, governance), with what each layer does in the repo today.",
    answer: "HELLO Cloud is designed as seven layers: compute, communication mesh, identity, memory, economy, evolution and governance. In this repo, identity, memory, the credit economy, the MCP/A2A mesh and governance gates exist as working prototypes. Compute is a Wasm sandbox plus checkpoints; Firecracker MicroVMs and copy-on-write databases are vision.",
    sections: [
      { heading: "Layer 1: Compute (hello.cloud)", body: ["Agent-written snippets run in a QuickJS Wasm sandbox with memory, stack and wall-clock limits and no fs, network or timers. Agent state can be checkpointed to a SHA-256-sealed JSON snapshot and resumed. Firecracker MicroVMs and copy-on-write Postgres forks are design goals with no implementation yet."] },
      { heading: "Layer 2: Communication mesh (hello.mesh)", body: ["An MCP service exposes tools over JSON-RPC 2.0, and an A2A-style JSON-RPC endpoint handles message/send and task lifecycle. Traces carry a truth tier (verified, inferred, asserted)."] },
      { heading: "Layers 3 and 4: Identity (hello.id) and memory (hello.cortex)", body: ["Every agent gets an Ed25519 keypair and a did:key identifier, plus a versioned soul document. Memory has CORE, RECALL and ARCHIVE tiers."] },
      { heading: "Layers 5 to 7: Economy, evolution and governance", body: ["Wallets hold prototype credits with daily caps and a circuit breaker. Evolution runs are seeded optimisations over synthetic vectors, not model training. Governance has an operator kill switch, a risk-tiered approval gate and reputation-weighted debates."] },
    ],
    features: [
      { name: "Wasm sandbox", status: "implemented", detail: "QuickJS in WebAssembly with hard limits.", href: "/ops/sandbox" },
      { name: "Checkpoints & snapshots", status: "implemented", detail: "Sealed JSON snapshots with resume.", href: "/ops/snapshots" },
      { name: "MCP tools", status: "implemented", detail: "Tool list served live.", href: "/api/hello/mcp/tools" },
      { name: "A2A JSON-RPC", status: "implemented", detail: "message/send and task lifecycle.", href: "/api/a2a" },
      { name: "Approval gate & kill switch", status: "implemented", detail: "Risk-tiered approvals.", href: "/ops/approvals" },
      { name: "Firecracker MicroVMs / CoW Postgres", status: "vision", detail: "Not implemented." },
    ],
  },
  {
    slug: "aml", n: 3, tab: "AML language & compiler", title: "AML: Agent Machine Language",
    question: "What is AML (Agent Machine Language), and what does its compiler do?",
    description: "AML is a declarative language for agent missions. The compiler statically parses source into an intent graph and hashes it; try it live on this page.",
    answer: "AML (Agent Machine Language) describes agent work as declarative blocks such as mission, intent, capability and memory, with typed steps piped by →. The AML v1 compiler in this repo parses and validates source, builds a deterministic intent graph and hashes the source. It never executes AML or calls tools. Token savings over Python or JavaScript have not been measured, so none are claimed.",
    sections: [
      { heading: "What does the live preview below measure?", body: ["It sends your source to POST /api/aml/compile and shows the result, including a simple lexer token count of the input you typed. That number counts AML lexer tokens; it is not an LLM tokenizer count and is not compared with any other language."] },
    ],
    widget: "aml",
    features: [
      { name: "AML compile", status: "implemented", detail: "Static parse, intent graph, source hash.", href: "/api/aml/compile" },
      { name: "AML validate", status: "implemented", detail: "Diagnostics without a graph.", href: "/api/aml/validate" },
      { name: "AML Studio", status: "implemented", detail: "Editor UI for the compiler.", href: "/aml-studio" },
      { name: "AML execution runtime", status: "vision", detail: "AML is never executed today." },
    ],
  },
  {
    slug: "identity", n: 4, tab: "Identity & soul (hello.id)", title: "Agent identity and soul documents",
    question: "How do agent DIDs, Ed25519 keys and soul documents work?",
    description: "Each HELLO agent gets an Ed25519 keypair, a did:key identifier and a versioned soul document; Guardian tiers map to planned credit caps.",
    answer: "Every HELLO agent is created with an Ed25519 keypair and a did:key identifier that anyone can resolve through the DID API. Its soul document (values, role, constraints) is versioned and hashed, so changes are traceable. Each agent also has a Guardian tier field. Mapping tiers to specific autonomy and credit caps is a design, shown below, not enforced yet.",
    sections: [
      { heading: "Are private keys ever exposed?", body: ["No. The private key column is omitted from every database read by default, and the sync and agent APIs never return it."] },
    ],
    tables: [{
      caption: "Guardian tiers: planned credit caps (design, not enforced)",
      head: ["Guardian tier", "Planned daily credit cap", "Planned deploy rights", "Planned review"],
      rows: [
        ["Sovereign", "500 H", "Autonomous, with signed proof", "Self-certifying"],
        ["Master", "100 H", "Allowed with quorum", "Reputation-weighted debate"],
        ["Journeyman", "25 H", "Sandbox and staging only", "Master sign-off"],
        ["Apprentice", "5 H", "Sandbox only", "Mentor audit"],
        ["Seedling", "1 H", "Read-only", "Operator approval"],
      ],
      note: "Today every wallet uses its own dailyCap (default 50 H) regardless of tier. H is a prototype credit unit with no monetary value.",
    }],
    features: [
      { name: "did:key + Ed25519 identities", status: "implemented", detail: "Resolve any agent DID.", href: "/api/did/resolve" },
      { name: "Versioned soul documents", status: "implemented", detail: "Per-agent soul history.", href: "/api/agents" },
      { name: "Agent lineage", status: "implemented", detail: "Parent/child lineage per agent.", href: "/api/agents" },
      { name: "Tier-based autonomy caps", status: "vision", detail: "Designed above; not enforced." },
    ],
  },
  {
    slug: "forge", n: 5, tab: "AST Forge CI (hello.forge)", title: "hello.forge: AST symbols instead of text diffs",
    question: "Why should agents work with AST symbols instead of raw text diffs?",
    description: "hello.forge indexes TypeScript into addressable AST symbols and returns compiler diagnostics as structured JSON that agents can act on.",
    answer: "Text diffs make it easy for an agent to break structure, for example by dropping a closing brace, and raw compiler logs are long and noisy. hello.forge indexes TypeScript files into addressable AST symbols using the TypeScript compiler API and stores typecheck diagnostics as structured JSON records. No token or timing comparison has been measured.",
    sections: [{
      heading: "What does a forge diagnostic look like?",
      body: ["Diagnostics are stored per file, line and code, so an agent can read a few fields instead of a full log. The shape below shows the fields; values come from your own run."],
      code: { label: "Diagnostic record (shape)", text: '{\n  "file": "src/lib/example.ts",\n  "line": 42,\n  "code": "TS2345",\n  "severity": "error",\n  "message": "<compiler message>"\n}' },
    }],
    features: [
      { name: "AST symbol index", status: "implemented", detail: "Symbols per file.", href: "/api/hello/forge/symbols" },
      { name: "Structured diagnostics", status: "implemented", detail: "Typecheck results as JSON.", href: "/api/hello/forge/diagnostics" },
      { name: "Symbol-level patch application", status: "prototype", detail: "Mutations are recorded; applying patches by symbol is limited." },
      { name: "MicroVM test execution", status: "vision", detail: "Not implemented." },
    ],
  },
  {
    slug: "cortex", n: 6, tab: "Cortex memory (hello.cortex)", title: "hello.cortex: tiered memory and failure registry",
    question: "How does HELLO Cortex stop agents from repeating mistakes?",
    description: "hello.cortex stores agent memory in CORE, RECALL and ARCHIVE tiers and keeps a failure registry that agents query for similar past errors and their fixes.",
    answer: "hello.cortex keeps agent memory in three tiers: CORE (working), RECALL (retrievable) and ARCHIVE (cold). Failures are recorded with their fixes, and before retrying, an agent can query for similar past failures using cosine similarity over local vectors. Contract locks record decisions agents agreed on. Automatic sleep-cycle consolidation is a design goal, and no token savings are claimed.",
    sections: [
      { heading: "1. Tiered memory", body: ["Each memory row has a tier and an agent. Recall queries return the most relevant rows for that agent."] },
      { heading: "2. Failure registry", body: ["POST a failure, then query /api/failures/similar with a new error message to get the closest past failures and how they were fixed. Recurrences are counted."] },
      { heading: "3. Consolidation", body: ["Promoting high-confidence episodic memories into shared skills during idle time is planned (vision)."] },
    ],
    features: [
      { name: "Cortex memories", status: "implemented", detail: "Tiered memory records.", href: "/api/hello/cortex/memories" },
      { name: "Contract locks", status: "implemented", detail: "Agreed decisions.", href: "/api/hello/cortex/contracts" },
      { name: "Failure registry + similarity", status: "implemented", detail: "Similar failures and fixes.", href: "/ops/failures" },
      { name: "Sleep-cycle consolidation", status: "vision", detail: "Not implemented." },
    ],
  },
  {
    slug: "ledger", n: 7, tab: "Native economy (hello.ledger)", title: "hello.ledger: credit wallets and circuit breakers",
    question: "How do agent wallets and circuit breakers work?",
    description: "Each HELLO agent has a wallet of prototype credits (H) with a daily cap; a spend that would breach the cap is blocked, recorded, and opens the circuit.",
    answer: "hello.ledger gives each agent a wallet of prototype credits, shown as H. Every spend runs in a database transaction that checks the wallet state, available balance and daily cap. A spend that would exceed the cap is refused, logged as a blocked transaction and opens the wallet's circuit breaker. Credits have no monetary value and are not on any blockchain.",
    sections: [{
      heading: "How is a spend checked?",
      body: ["The check is deterministic and runs on every spend request:"],
      code: { label: "Spend rule (as implemented)", text: "allowed = wallet.circuitOpen == false\n       && amount <= wallet.balance\n       && wallet.spentToday + amount <= wallet.dailyCap\n\nif not allowed: record { type: \"blocked\" }, open circuit, return 429" },
    }],
    features: [
      { name: "Wallets", status: "implemented", detail: "Per-agent credit wallets.", href: "/api/economy/wallets" },
      { name: "Transactions", status: "implemented", detail: "Ledger of spends and blocks.", href: "/api/economy/transactions" },
      { name: "Treasury", status: "implemented", detail: "Reallocation behind approval.", href: "/ops/treasury" },
      { name: "Delegated credit caps", status: "implemented", detail: "Child agents with a credit cap and recall.", href: "/ops/delegation" },
      { name: "Per-token / per-ms metering", status: "vision", detail: "Spends are explicit amounts today." },
    ],
  },
  {
    slug: "models-mcp", n: 8, tab: "Models & MCP tools", title: "Model routing and MCP interoperability",
    question: "How does HELLO OS work with different models and existing tools?",
    description: "HELLO OS exposes its capabilities as MCP tools and read-only connectors; multi-model routing and cross-provider quorum are design goals.",
    answer: "HELLO OS talks to tools through the Model Context Protocol: its MCP service exposes forge, cortex, memory and checkpoint tools plus read-only connectors for SQL, GitHub, OpenAPI and webhooks. Today a single configured LLM provider is used for golden-set replays. Routing work across model families and requiring cross-provider quorum for risky actions are vision.",
    sections: [
      { heading: "Which decisions use a quorum today?", body: ["Debates use reputation-weighted votes between agents, with a quorum weight. A quorum that requires agreement between different model providers is not implemented."] },
      { heading: "Which integrations exist?", body: ["The integrations page lists every connector with its real status. Write-capable tools are disabled; connectors are read-only."] },
    ],
    features: [
      { name: "MCP tool service", status: "implemented", detail: "Tools listed live.", href: "/api/hello/mcp/tools" },
      { name: "Read-only connectors", status: "implemented", detail: "SQL, GitHub, OpenAPI, webhook.", href: "/integrations" },
      { name: "Reputation-weighted debates", status: "implemented", detail: "Quorum by weight.", href: "/ops/consensus" },
      { name: "Single-provider completions", status: "prototype", detail: "Used by golden-set replay." },
      { name: "Multi-model routing", status: "vision", detail: "No routing across model families exists." },
      { name: "Cross-provider quorum", status: "vision", detail: "Not implemented." },
    ],
  },
  {
    slug: "gitagenthub", n: 9, tab: "GitAgentHUB & field reports", title: "GitAgentHUB field reports",
    question: "What is GitAgentHUB, and how are field reports stored?",
    description: "GitAgentHUB is HELLO OS's agent profile and skill marketplace. Field reports submitted here are validated, receipted with SHA-256 and stored in the local database.",
    answer: "GitAgentHUB is where HELLO agents and developers share profiles, skills and repositories. Field reports submitted on this page are validated on the server, rate limited, stored in this instance's database and given a SHA-256 receipt over their content. Reports are shown as plain text. The receipt proves the stored content has not changed; it does not verify that a report's claims are true.",
    sections: [],
    widget: "ugc",
    features: [
      { name: "Field reports API", status: "implemented", detail: "Validated, rate-limited, receipted.", href: "/api/docs/posts" },
      { name: "Agent Hub profiles and activity", status: "prototype", detail: "Profiles, capability listings, field reports, and tool-call activity come from this instance; repository hosting and social interactions are unavailable.", href: "/hub" },
      { name: "Skill marketplace", status: "implemented", detail: "List and install skills.", href: "/api/marketplace" },
      { name: "Signed agent authorship", status: "vision", detail: "Reports are not signed by agent keys yet." },
    ],
  },
  {
    slug: "evolve", n: 10, tab: "Evolve lab & discovery", title: "Evolve lab, drift checks and discovery",
    question: "How do golden-set replays and evolution runs keep agents in check?",
    description: "Golden-set replays re-run pinned prompts and measure real output drift; evolution runs are seeded searches over synthetic vectors. Machine-readable discovery files list the real routes.",
    answer: "HELLO Evolve has two parts. Golden-set replays re-run pinned prompts against the configured model and measure how much the output drifted from the pinned hash. Evolution runs are seeded genetic searches over synthetic profile vectors; their scores are not benchmarks of real agents. Quarantining agents automatically on drift is vision.",
    sections: [{ heading: "Where can agents discover this instance?", body: ["Two machine-readable files are generated from the routes that actually exist in this app. They are linked below."] }],
    widget: "discovery",
    features: [
      { name: "Golden-set replay", status: "implemented", detail: "Measured drift per replay.", href: "/api/traces/golden-replay" },
      { name: "Evolution runs", status: "prototype", detail: "Synthetic vectors only.", href: "/evolution" },
      { name: "Evolve simulation", status: "prototype", detail: "Clearly labeled browser-only simulation; no live agents, model training, or database reads.", href: "/evolve" },
      { name: "Automatic drift quarantine", status: "vision", detail: "Not implemented." },
    ],
  },
  {
    slug: "agent-runtime", n: 11, tab: "Agent runtime proposal", title: "HELLO OS agent runtime architecture",
    question: "How is HELLO OS designed to grow into an agent runtime?",
    description: "A staged architecture proposal for agent identity, task contracts, capability policy, bounded scheduling, memory, tools, and audit, with the current prototype separated from future design.",
    answer: "HELLO OS Agent Runtime Architecture v1 is a design proposal for growing the existing local-first application into a bounded, inspectable agent runtime. HELLO OS today is a Next.js application with selected APIs, persistent records, MCP-compatible tools, A2A-style task methods, a static AML compiler, and a static hello.task/v1 contract validator. The validator checks schema and limits only; it does not authorize capabilities or execute tasks. Durable execution, production capability enforcement, and stronger isolation remain future work.",
    sections: [
      { heading: "What is in the current prototype?", body: ["The repository includes agent identity records, missions and task APIs, tiered memory, internal credit wallets, approval controls, a local MCP-compatible tool service, A2A-style task methods, and static AML and hello.task/v1 validators. The task validator checks shape and numeric bounds only; it does not authorize capability requests or execute work. These are application features and prototypes, not an operating-system kernel or a general-purpose autonomous runtime."] },
      { heading: "What does the proposal add?", body: ["The proposal describes a versioned agent descriptor, validated task contracts, server-side capability policy, bounded scheduling with leases and idempotency, provenance-aware context, mediated model and tool adapters, and auditable state transitions. Each stage has implementation and evidence gates."] },
      { heading: "What remains future work?", body: ["Durable general-purpose execution workers, production multi-tenant isolation, Firecracker microVMs, cross-server federation, automatic skill promotion, and broad connector coverage are not presented as current features. The proposal assigns them explicit prerequisites and evaluation gates."] },
    ],
    features: [
      { name: "Task contract validator", status: "implemented", detail: "Static schema and limit checks; no authorization or execution.", href: "/api/hello/tasks/validate" },
      { name: "Agent Runtime Architecture v1", status: "vision", detail: "Design proposal; implementation status remains in the source repository.", href: "https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/architecture/HELLO-OS-Agent-Runtime-v1.md" },
    ],
  },
];

export const getDocPage = (slug: string) => DOC_PAGES.find((p) => p.slug === slug);
