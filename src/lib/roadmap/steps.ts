// HELLO OS 100-step roadmap. Status is derived from repo evidence:
//   shipped = code on main (paths listed); in-pr = open PR (number listed);
//   planned = not built; vision = not built and not near-term.
// At runtime /roadmap re-checks listed PRs via the GitHub API and upgrades
// in-pr → shipped when merged (see src/lib/roadmap/github.ts).

export type StepStatus = "shipped" | "in-pr" | "planned" | "vision";
export type LayerId = "hub" | "evolve" | "aml" | "cloud" | "cortex" | "mesh" | "id-ledger";

export interface Step { n: number; phase: number; layer: LayerId; title: string; status: StepStatus; paths?: string[]; pr?: number; note?: string }
export interface Phase { num: number; title: string; module: string }
export interface Layer { id: LayerId; name: string; summary: string; phases: number[] }
export interface PipelineStage { id: string; label: string; definition: string; checks: string[] }

export const REPO = "CodesbyFebin/Hello-OS";

// Definitions only. The roadmap does not run steps through this pipeline automatically.
export const PIPELINE: PipelineStage[] = [
  { id: "intent", label: "Intent", definition: "Declare the outcome.", checks: ["Define the goal", "Specify constraints", "Assign an owner"] },
  { id: "policy", label: "Policy", definition: "Check it is allowed.", checks: ["Validate permissions", "Apply the risk/approval matrix", "Human approval for high-impact actions"] },
  { id: "execution", label: "Execution", definition: "Do the work in a bounded environment.", checks: ["Compile/validate inputs", "Run with limits", "Keep side effects reversible where possible"] },
  { id: "evidence", label: "Evidence", definition: "Record what happened.", checks: ["Tests and build output", "Hashes / signatures where implemented", "Linked PR or commit"] },
  { id: "verified", label: "Verified", definition: "A human reviews and merges.", checks: ["Review passed", "Merged to main", "Step marked shipped"] },
];

export const PHASES: Phase[] = [
  {
    "num": 1,
    "title": "Cryptographic Identity & Passports",
    "module": "hello.id"
  },
  {
    "num": 2,
    "title": "AST Code Graph & Pre-Commit CI",
    "module": "hello.forge"
  },
  {
    "num": 3,
    "title": "Tiered Memory & Causal Knowledge",
    "module": "hello.cortex"
  },
  {
    "num": 4,
    "title": "Swarm Protocol & Intent Mesh",
    "module": "hello.mesh"
  },
  {
    "num": 5,
    "title": "Credits, Budgets & Circuit Breakers",
    "module": "hello.ledger"
  },
  {
    "num": 6,
    "title": "Watchdog, Drift & Safety Gates",
    "module": "hello.watchdog"
  },
  {
    "num": 7,
    "title": "AML Static Compiler",
    "module": "hello.aml"
  },
  {
    "num": 8,
    "title": "Multi-Model Routing",
    "module": "hello.models"
  },
  {
    "num": 9,
    "title": "GitAgentHUB & Evolution Lab",
    "module": "hello.hub + hello.evolve"
  },
  {
    "num": 10,
    "title": "Enterprise Scale & Federation",
    "module": "hello.global"
  }
];

export const LAYERS: Layer[] = [
  {
    "id": "hub",
    "name": "GitAgentHUB",
    "summary": "Social code sharing & skill marketplace",
    "phases": [
      9
    ]
  },
  {
    "id": "evolve",
    "name": "HELLO Evolve / Watchdog",
    "summary": "Drift detection, kill switch, safety gates",
    "phases": [
      6
    ]
  },
  {
    "id": "aml",
    "name": "AML Compiler",
    "summary": "Static parser, validator, receipts",
    "phases": [
      7
    ]
  },
  {
    "id": "cloud",
    "name": "HELLO Cloud",
    "summary": "AST CI and model routing",
    "phases": [
      2,
      8
    ]
  },
  {
    "id": "cortex",
    "name": "HELLO Cortex",
    "summary": "Tiered memory and dead-end registry",
    "phases": [
      3
    ]
  },
  {
    "id": "mesh",
    "name": "HELLO Mesh",
    "summary": "A2A/MCP wire protocol and traces",
    "phases": [
      4
    ]
  },
  {
    "id": "id-ledger",
    "name": "HELLO ID + Ledger",
    "summary": "Identity, credits, federation",
    "phases": [
      1,
      5,
      10
    ]
  }
];

export const STEPS: Step[] = [
  {
    "n": 1,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Ed25519 keypair generation for agents",
    "status": "shipped",
    "paths": [
      "src/lib/crypto.ts"
    ],
    "note": "Uses @noble/ed25519."
  },
  {
    "n": 2,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Decentralized identifiers for agents",
    "status": "shipped",
    "paths": [
      "src/lib/crypto.ts",
      "src/app/api/did"
    ],
    "note": "did:key, not a custom did:hello method."
  },
  {
    "n": 3,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Sign outgoing agent intents",
    "status": "shipped",
    "paths": [
      "src/app/api/observations/route.ts",
      "src/app/api/attestations/route.ts"
    ],
    "note": "Observations and attestations are signed; not every A2A message yet."
  },
  {
    "n": 4,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Verify public-key signatures on incoming requests",
    "status": "shipped",
    "paths": [
      "src/app/api/observations/route.ts"
    ],
    "note": "Partial: verified on signed routes."
  },
  {
    "n": 5,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Soul file versioning with lineage",
    "status": "shipped",
    "paths": [
      "prisma/schema.prisma"
    ],
    "note": "Versioned per agent; no hash-chained lineage yet."
  },
  {
    "n": 6,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Guardian tier promotion from verified milestones",
    "status": "planned"
  },
  {
    "n": 7,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Multi-sig governance passports for higher tiers",
    "status": "vision"
  },
  {
    "n": 8,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Identity recovery via guardian quorums",
    "status": "vision"
  },
  {
    "n": 9,
    "phase": 1,
    "layer": "id-ledger",
    "title": "Trust registry for peer agent credentials",
    "status": "planned"
  },
  {
    "n": 10,
    "phase": 1,
    "layer": "id-ledger",
    "title": "hello.id specification document",
    "status": "planned"
  },
  {
    "n": 11,
    "phase": 2,
    "layer": "cloud",
    "title": "TypeScript compiler integration for code graphs",
    "status": "shipped",
    "paths": [
      "src/lib/forge.ts"
    ],
    "note": "Via ts-morph."
  },
  {
    "n": 12,
    "phase": 2,
    "layer": "cloud",
    "title": "AST symbol parsing for .ts/.js files",
    "status": "shipped",
    "paths": [
      "src/lib/forge.ts"
    ]
  },
  {
    "n": 13,
    "phase": 2,
    "layer": "cloud",
    "title": "AST security scanner for forbidden call expressions",
    "status": "planned"
  },
  {
    "n": 14,
    "phase": 2,
    "layer": "cloud",
    "title": "Return-type signature parity checks on patches",
    "status": "planned"
  },
  {
    "n": 15,
    "phase": 2,
    "layer": "cloud",
    "title": "Deterministic SHA-256 AST node IDs",
    "status": "shipped",
    "paths": [
      "src/lib/forge.ts"
    ],
    "note": "IDs hash file path + qualified name, not content."
  },
  {
    "n": 16,
    "phase": 2,
    "layer": "cloud",
    "title": "Incremental AST patching without full-file rewrites",
    "status": "shipped",
    "paths": [
      "src/lib/forge.ts",
      "mini-services/hello-mcp/index.ts"
    ]
  },
  {
    "n": 17,
    "phase": 2,
    "layer": "cloud",
    "title": "Isolated pre-flight test execution for patches",
    "status": "vision",
    "note": "No microVM runtime exists."
  },
  {
    "n": 18,
    "phase": 2,
    "layer": "cloud",
    "title": "Compiler-diagnostic auto-repair loop",
    "status": "planned",
    "note": "Would require review before applying."
  },
  {
    "n": 19,
    "phase": 2,
    "layer": "cloud",
    "title": "AST-aware merge conflict proposals",
    "status": "planned",
    "note": "Proposals only; merges require human approval."
  },
  {
    "n": 20,
    "phase": 2,
    "layer": "cloud",
    "title": "hello.forge specification",
    "status": "planned"
  },
  {
    "n": 21,
    "phase": 3,
    "layer": "cortex",
    "title": "Hybrid lexical + embedding search",
    "status": "planned"
  },
  {
    "n": 22,
    "phase": 3,
    "layer": "cortex",
    "title": "Token-budget context pruning",
    "status": "planned",
    "paths": [
      "src/lib/forge.ts"
    ],
    "note": "Only a token estimator exists."
  },
  {
    "n": 23,
    "phase": 3,
    "layer": "cortex",
    "title": "Background memory consolidation",
    "status": "planned"
  },
  {
    "n": 24,
    "phase": 3,
    "layer": "cortex",
    "title": "Causal dead-end registry",
    "status": "shipped",
    "paths": [
      "mini-services/hello-mcp/index.ts",
      "prisma/schema.prisma"
    ],
    "note": "cortex.recordDeadEnd; failure library extended in PR #11."
  },
  {
    "n": 25,
    "phase": 3,
    "layer": "cortex",
    "title": "Time-decay weighting for recall",
    "status": "planned"
  },
  {
    "n": 26,
    "phase": 3,
    "layer": "cortex",
    "title": "Vector sync across distributed nodes",
    "status": "vision"
  },
  {
    "n": 27,
    "phase": 3,
    "layer": "cortex",
    "title": "Semantic cache to avoid redundant generation",
    "status": "in-pr",
    "pr": 12,
    "note": "Reports measured hit rate; no savings claim."
  },
  {
    "n": 28,
    "phase": 3,
    "layer": "cortex",
    "title": "Episodic-to-semantic promotion pipeline",
    "status": "planned"
  },
  {
    "n": 29,
    "phase": 3,
    "layer": "cortex",
    "title": "Permission-scoped memory compartments",
    "status": "in-pr",
    "pr": 12,
    "note": "Permission scoping in PR; encryption-at-rest not built."
  },
  {
    "n": 30,
    "phase": 3,
    "layer": "cortex",
    "title": "hello.cortex schema documentation",
    "status": "planned"
  },
  {
    "n": 31,
    "phase": 4,
    "layer": "mesh",
    "title": "A2A and MCP JSON-RPC 2.0 wire protocol",
    "status": "shipped",
    "paths": [
      "src/app/api/a2a/route.ts",
      "mini-services/hello-mcp/index.ts"
    ]
  },
  {
    "n": 32,
    "phase": 4,
    "layer": "mesh",
    "title": "Trace continuity ID propagation",
    "status": "shipped",
    "paths": [
      "prisma/schema.prisma",
      "src/app/api/observations/route.ts"
    ]
  },
  {
    "n": 33,
    "phase": 4,
    "layer": "mesh",
    "title": "Truth-tier tagging on messages",
    "status": "shipped",
    "paths": [
      "src/app/api/observations/route.ts"
    ]
  },
  {
    "n": 34,
    "phase": 4,
    "layer": "mesh",
    "title": "Server-sent event telemetry streams",
    "status": "planned",
    "note": "The MCP feed is a JSON snapshot, not a stream."
  },
  {
    "n": 35,
    "phase": 4,
    "layer": "mesh",
    "title": "Database checkpoints before risky operations",
    "status": "in-pr",
    "pr": 11,
    "note": "No latency target is claimed."
  },
  {
    "n": 36,
    "phase": 4,
    "layer": "mesh",
    "title": "Pub/sub broker for swarm coordination",
    "status": "planned"
  },
  {
    "n": 37,
    "phase": 4,
    "layer": "mesh",
    "title": "Schema drift detection before queries",
    "status": "in-pr",
    "pr": 7,
    "note": "Schema SHA-256 fingerprint tool."
  },
  {
    "n": 38,
    "phase": 4,
    "layer": "mesh",
    "title": "Dead-letter queue for failed intents",
    "status": "planned"
  },
  {
    "n": 39,
    "phase": 4,
    "layer": "mesh",
    "title": "Gossip-based peer discovery",
    "status": "vision"
  },
  {
    "n": 40,
    "phase": 4,
    "layer": "mesh",
    "title": "hello.mesh interoperability specification",
    "status": "planned"
  },
  {
    "n": 41,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Prototype credit ledger with transactions",
    "status": "shipped",
    "paths": [
      "src/lib/economy.ts",
      "prisma/schema.prisma"
    ],
    "note": "Prototype credits only; no tokens or USDC."
  },
  {
    "n": 42,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Usage metering for tokens and compute",
    "status": "planned"
  },
  {
    "n": 43,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Hard spend limits that stop runaway agents",
    "status": "in-pr",
    "pr": 6,
    "note": "Delegation credit caps."
  },
  {
    "n": 44,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Escrow state machine (held → verified → released)",
    "status": "planned",
    "paths": [
      "prisma/schema.prisma"
    ],
    "note": "Transaction types exist; no state machine."
  },
  {
    "n": 45,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Skill marketplace spending prototype credits",
    "status": "shipped",
    "paths": [
      "src/app/api/marketplace",
      "src/app/hub/hub-client.tsx"
    ]
  },
  {
    "n": 46,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Mission bounty boards",
    "status": "planned",
    "paths": [
      "src/app/api/missions"
    ]
  },
  {
    "n": 47,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Treasury rebalancing",
    "status": "vision",
    "note": "Real-money actions would need operator approval and are out of scope."
  },
  {
    "n": 48,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Agent-to-agent invoices and receipts",
    "status": "planned"
  },
  {
    "n": 49,
    "phase": 5,
    "layer": "id-ledger",
    "title": "Human approval for spending",
    "status": "in-pr",
    "pr": 5
  },
  {
    "n": 50,
    "phase": 5,
    "layer": "id-ledger",
    "title": "hello.ledger standards document",
    "status": "planned"
  },
  {
    "n": 51,
    "phase": 6,
    "layer": "evolve",
    "title": "Golden-set trace replay for regressions",
    "status": "shipped",
    "paths": [
      "src/app/api/traces/golden-replay/route.ts"
    ]
  },
  {
    "n": 52,
    "phase": 6,
    "layer": "evolve",
    "title": "Semantic drift metrics against baselines",
    "status": "planned",
    "paths": [
      "prisma/schema.prisma"
    ],
    "note": "driftScore field exists; no detector."
  },
  {
    "n": 53,
    "phase": 6,
    "layer": "evolve",
    "title": "Coordination drift metrics",
    "status": "planned"
  },
  {
    "n": 54,
    "phase": 6,
    "layer": "evolve",
    "title": "Latency SLA watchdogs",
    "status": "planned"
  },
  {
    "n": 55,
    "phase": 6,
    "layer": "evolve",
    "title": "Operator kill switch",
    "status": "in-pr",
    "pr": 5
  },
  {
    "n": 56,
    "phase": 6,
    "layer": "evolve",
    "title": "Human decision receipts for production actions",
    "status": "in-pr",
    "pr": 5
  },
  {
    "n": 57,
    "phase": 6,
    "layer": "evolve",
    "title": "Automated rollback on drift alarms",
    "status": "planned",
    "note": "Would require reversible side effects."
  },
  {
    "n": 58,
    "phase": 6,
    "layer": "evolve",
    "title": "Prompt-injection quarantine for untrusted input",
    "status": "planned"
  },
  {
    "n": 59,
    "phase": 6,
    "layer": "evolve",
    "title": "Compliance checks (SOC2/GDPR controls)",
    "status": "vision",
    "note": "No certification is claimed."
  },
  {
    "n": 60,
    "phase": 6,
    "layer": "evolve",
    "title": "hello.watchdog governance framework",
    "status": "planned"
  },
  {
    "n": 61,
    "phase": 7,
    "layer": "aml",
    "title": "Formal AML v1 grammar specification",
    "status": "planned"
  },
  {
    "n": 62,
    "phase": 7,
    "layer": "aml",
    "title": "AML tokenizer / lexer",
    "status": "shipped",
    "paths": [
      "src/lib/aml.ts",
      "tests/aml.test.mjs"
    ]
  },
  {
    "n": 63,
    "phase": 7,
    "layer": "aml",
    "title": "AML parser and validator",
    "status": "shipped",
    "paths": [
      "src/lib/aml.ts",
      "src/app/api/aml"
    ]
  },
  {
    "n": 64,
    "phase": 7,
    "layer": "aml",
    "title": "Token-efficiency comparison vs other languages",
    "status": "planned",
    "note": "Needs a measured benchmark."
  },
  {
    "n": 65,
    "phase": 7,
    "layer": "aml",
    "title": "Dependency resolution across capabilities",
    "status": "planned"
  },
  {
    "n": 66,
    "phase": 7,
    "layer": "aml",
    "title": "Hashed and signed compile receipts",
    "status": "in-pr",
    "pr": 9,
    "note": "SHA-256 + Ed25519 with a temporary demo key."
  },
  {
    "n": 67,
    "phase": 7,
    "layer": "aml",
    "title": "Execution VM with chained step receipts",
    "status": "vision",
    "note": "AML v1 is static and never executes actions."
  },
  {
    "n": 68,
    "phase": 7,
    "layer": "aml",
    "title": "Natural-language → AML drafting",
    "status": "planned",
    "note": "Drafts must be validated and reviewed."
  },
  {
    "n": 69,
    "phase": 7,
    "layer": "aml",
    "title": "Editor syntax highlighting / language server",
    "status": "planned"
  },
  {
    "n": 70,
    "phase": 7,
    "layer": "aml",
    "title": "Published AML documentation and compiler",
    "status": "planned"
  },
  {
    "n": 71,
    "phase": 8,
    "layer": "cloud",
    "title": "Model registry",
    "status": "planned"
  },
  {
    "n": 72,
    "phase": 8,
    "layer": "cloud",
    "title": "Cost/latency-aware routing",
    "status": "planned",
    "note": "Needs measured quality, latency and cost."
  },
  {
    "n": 73,
    "phase": 8,
    "layer": "cloud",
    "title": "Cross-provider fallback on errors",
    "status": "planned"
  },
  {
    "n": 74,
    "phase": 8,
    "layer": "cloud",
    "title": "Multi-agent debate and consensus",
    "status": "in-pr",
    "pr": 13,
    "note": "Votes inform; humans approve high-impact changes."
  },
  {
    "n": 75,
    "phase": 8,
    "layer": "cloud",
    "title": "Local-only fallback for private data",
    "status": "planned"
  },
  {
    "n": 76,
    "phase": 8,
    "layer": "cloud",
    "title": "Token-budget streaming proxy",
    "status": "planned"
  },
  {
    "n": 77,
    "phase": 8,
    "layer": "cloud",
    "title": "Model benchmarking harness",
    "status": "planned"
  },
  {
    "n": 78,
    "phase": 8,
    "layer": "cloud",
    "title": "KV-cache persistence adapters",
    "status": "vision"
  },
  {
    "n": 79,
    "phase": 8,
    "layer": "cloud",
    "title": "Unified error normalization",
    "status": "planned"
  },
  {
    "n": 80,
    "phase": 8,
    "layer": "cloud",
    "title": "hello.models routing specification",
    "status": "planned"
  },
  {
    "n": 81,
    "phase": 9,
    "layer": "hub",
    "title": "Database-backed Hub field reports and activity",
    "status": "shipped",
    "paths": [
      "src/app/hub/hub-client.tsx"
    ],
    "note": "Field reports are validated and stored through the docs posts API; profile, capability, and tool-call data comes from this instance. No likes, follows, or external social feed."
  },
  {
    "n": 82,
    "phase": 9,
    "layer": "hub",
    "title": "Agent repository cloning and history",
    "status": "planned",
    "note": "Agent repository hosting, cloning, and history are not implemented."
  },
  {
    "n": 83,
    "phase": 9,
    "layer": "hub",
    "title": "Skill marketplace UI",
    "status": "shipped",
    "paths": [
      "src/app/hub/hub-client.tsx",
      "src/app/api/marketplace"
    ]
  },
  {
    "n": 84,
    "phase": 9,
    "layer": "hub",
    "title": "Evolution chamber simulation",
    "status": "shipped",
    "paths": [
      "src/app/evolve",
      "src/lib/evolution.ts"
    ],
    "note": "Labelled simulation."
  },
  {
    "n": 85,
    "phase": 9,
    "layer": "hub",
    "title": "Gene mutation and fitness selection",
    "status": "shipped",
    "paths": [
      "src/lib/evolution.ts",
      "tests/evolution.test.mjs"
    ],
    "note": "4 genes, not 32."
  },
  {
    "n": 86,
    "phase": 9,
    "layer": "hub",
    "title": "Benchmark tournaments between agents",
    "status": "planned"
  },
  {
    "n": 87,
    "phase": 9,
    "layer": "hub",
    "title": "Generational timeline replay",
    "status": "planned",
    "paths": [
      "src/app/evolution"
    ],
    "note": "Saved runs exist; no scrubber."
  },
  {
    "n": 88,
    "phase": 9,
    "layer": "hub",
    "title": "Cross-repo dependency graph and audits",
    "status": "planned"
  },
  {
    "n": 89,
    "phase": 9,
    "layer": "hub",
    "title": "Reputation staking for contributions",
    "status": "planned"
  },
  {
    "n": 90,
    "phase": 9,
    "layer": "hub",
    "title": "GitAgentHUB developer portal",
    "status": "planned"
  },
  {
    "n": 91,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Cross-cloud identity federation",
    "status": "vision"
  },
  {
    "n": 92,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Peer-to-peer compute marketplace",
    "status": "vision"
  },
  {
    "n": 93,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Post-quantum signatures (e.g. ML-DSA)",
    "status": "vision"
  },
  {
    "n": 94,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Multi-tenant workspace isolation",
    "status": "planned"
  },
  {
    "n": 95,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Regulatory compliance auditing for financial agents",
    "status": "vision"
  },
  {
    "n": 96,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Global agent directory (hello://registry)",
    "status": "planned"
  },
  {
    "n": 97,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Standards working group for AML and A2A",
    "status": "vision"
  },
  {
    "n": 98,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Open-source grant program",
    "status": "vision"
  },
  {
    "n": 99,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Independent third-party security audit",
    "status": "planned"
  },
  {
    "n": 100,
    "phase": 10,
    "layer": "id-ledger",
    "title": "Broad adoption as an agent standard",
    "status": "vision"
  }
];
