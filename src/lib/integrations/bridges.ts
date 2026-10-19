// 50 bridge techniques (mirrors docs/bridges.md). implemented = code + tests in this repo.
export type BridgeStatus = "implemented" | "planned";
export interface Bridge { id: number; group: string; name: string; description: string; status: BridgeStatus; implementation?: string }

export const BRIDGES: Bridge[] = [
  {
    "id": 1,
    "group": "Architecture & Protocol Wrappers",
    "name": "MCP Wrapper Pattern",
    "description": "Expose a narrow, typed MCP facade over approved REST or SOAP operations. Start read-only and validate every argument.",
    "status": "planned"
  },
  {
    "id": 2,
    "group": "Architecture & Protocol Wrappers",
    "name": "Reverse Proxy Intent Interceptor",
    "description": "Put a typed, allowlisted API facade in front of legacy services. Do not translate arbitrary natural-language text directly into requests that mutate state.",
    "status": "planned"
  },
  {
    "id": 3,
    "group": "Architecture & Protocol Wrappers",
    "name": "Database Change Data Capture (CDC) Bridge",
    "description": "Use CDC with schema validation, data minimization, source permission checks, retention, and deletion propagation before forwarding events into a memory service.",
    "status": "planned"
  },
  {
    "id": 4,
    "group": "Architecture & Protocol Wrappers",
    "name": "Agent Card Metadata Injection",
    "description": "Publish an accurate static capability manifest at /.well-known/agent.json. Treat discovery metadata as untrusted input, not as authorization.",
    "status": "implemented",
    "implementation": "/.well-known/agent.json"
  },
  {
    "id": 5,
    "group": "Architecture & Protocol Wrappers",
    "name": "Async Event Bus Adapter",
    "description": "Bridge legacy message queues (RabbitMQ, Kafka, ActiveMQ) into the `hello.mesh` A2A protocol using event schema adapters.",
    "status": "planned"
  },
  {
    "id": 6,
    "group": "Architecture & Protocol Wrappers",
    "name": "OAuth-to-DID Token Exchanger",
    "description": "Use a token-exchange gateway to issue a short-lived, scoped credential after validating the OAuth session. A DID is a separate identifier and does not inherit proof of identity automatically.",
    "status": "planned"
  },
  {
    "id": 7,
    "group": "Architecture & Protocol Wrappers",
    "name": "GraphQL Federation Layer",
    "description": "Federate only the fields and operations each caller is allowed to access; query batching and round-trip counts depend on the schema and implementation.",
    "status": "planned"
  },
  {
    "id": 8,
    "group": "Architecture & Protocol Wrappers",
    "name": "JSON-RPC Schema Reflector",
    "description": "Generate candidate tool schemas from reviewed OpenAPI documents; manually review authorization, side effects, and input constraints before exposing them.",
    "status": "implemented",
    "implementation": "connector.openapi.reflect"
  },
  {
    "id": 9,
    "group": "Architecture & Protocol Wrappers",
    "name": "Webhook-to-Intent Transpiler",
    "description": "Parse signed or authenticated webhooks into typed event records. Validate source, timestamp, replay protection, and payload schema before any downstream action.",
    "status": "implemented",
    "implementation": "POST /api/integrations/webhook"
  },
  {
    "id": 10,
    "group": "Architecture & Protocol Wrappers",
    "name": "Headless Browser DOM Wrapper",
    "description": "Use browser automation only against explicitly allowlisted pages and accounts, with scoped sessions and human approval for state-changing actions.",
    "status": "planned"
  },
  {
    "id": 11,
    "group": "Data & Memory Integration",
    "name": "Vector Embedding Backfill",
    "description": "Backfill embeddings only for data with an approved purpose and retention policy; preserve source permissions and deletion requests.",
    "status": "planned"
  },
  {
    "id": 12,
    "group": "Data & Memory Integration",
    "name": "Causal Dead-End Log Extractor",
    "description": "Seed a failure registry only from authorized, redacted incident history, with provenance, retention, and correction/deletion handling.",
    "status": "planned"
  },
  {
    "id": 13,
    "group": "Data & Memory Integration",
    "name": "Shadow Database Cloning",
    "description": "Use database-native snapshots or isolated replicas when supported. Copy-on-write behavior and creation time depend on the provider and workload; no fixed latency is promised.",
    "status": "planned"
  },
  {
    "id": 14,
    "group": "Data & Memory Integration",
    "name": "Document Chunking & Semantic Indexing",
    "description": "Chunk authorized documents while preserving source access controls and citations. Do not treat model confidence scores as verified facts.",
    "status": "planned"
  },
  {
    "id": 15,
    "group": "Data & Memory Integration",
    "name": "Incremental Cache Invalidation",
    "description": "Map cache keys from legacy Redis clusters to agent memory pointers to prevent stale context retrieval.",
    "status": "planned"
  },
  {
    "id": 16,
    "group": "Data & Memory Integration",
    "name": "Log-to-Episodic Memory Parser",
    "description": "Ingest unstructured log files (JSON/Syslog) and parse them into structured episodic memory records.",
    "status": "planned"
  },
  {
    "id": 17,
    "group": "Data & Memory Integration",
    "name": "Schema Version Fingerprinting",
    "description": "Compute SHA-256 hashes of database schemas to detect silent breaking changes before agents run queries.",
    "status": "implemented",
    "implementation": "connector.sql.fingerprint"
  },
  {
    "id": 18,
    "group": "Data & Memory Integration",
    "name": "Dead-Letter Queue (DLQ) Introspection",
    "description": "Expose dead-letter messages read-only first. Retrying or replaying a message requires idempotency checks and explicit approval.",
    "status": "planned"
  },
  {
    "id": 19,
    "group": "Data & Memory Integration",
    "name": "Audit Trail Normalizer",
    "description": "Normalize audit events into a documented receipt format. A hash alone is not a digital signature or proof of execution.",
    "status": "planned"
  },
  {
    "id": 20,
    "group": "Data & Memory Integration",
    "name": "State snapshot serialization",
    "description": "Serialize only approved, minimized state with schema versions, retention rules, and encryption; do not copy session secrets into memory blobs.",
    "status": "planned"
  },
  {
    "id": 21,
    "group": "Security, Identity & Governance",
    "name": "API Key Vault Mapping",
    "description": "Keep API keys in a secret manager and expose narrow operations through a server-side capability proxy. Never return raw keys to prompts or model output.",
    "status": "planned"
  },
  {
    "id": 22,
    "group": "Security, Identity & Governance",
    "name": "RBAC-to-Guardian Tier Mapper",
    "description": "Map roles conservatively to a documented permission matrix with explicit deny rules and owner review; Guardian tiers are not automatically equivalent to an external RBAC system.",
    "status": "planned"
  },
  {
    "id": 23,
    "group": "Security, Identity & Governance",
    "name": "Circuit Breaker Cost Governor",
    "description": "Set hard request, rate, and spend limits, then stop calls on policy thresholds. P99 monitoring is a signal, not a spending-control substitute.",
    "status": "planned"
  },
  {
    "id": 24,
    "group": "Security, Identity & Governance",
    "name": "Untrusted Content Isolation and Policy Checks",
    "description": "Keep external content explicitly marked as untrusted and apply context-specific validation. No sanitizer can reliably remove prompt injection from arbitrary text.",
    "status": "planned"
  },
  {
    "id": 25,
    "group": "Security, Identity & Governance",
    "name": "Cryptographic Receipt Stamping",
    "description": "Use a digital signature over a canonical receipt with a protected signing key. A SHA-256 digest is an identifier, not a signature.",
    "status": "planned"
  },
  {
    "id": 26,
    "group": "Security, Identity & Governance",
    "name": "Automated Least-Privilege Scoping",
    "description": "Use observed usage to recommend permission reductions; require an owner to review before changing grants because rare capabilities may still be necessary.",
    "status": "planned"
  },
  {
    "id": 27,
    "group": "Security, Identity & Governance",
    "name": "Human-in-the-Loop Webhook Gate",
    "description": "Require explicit human authorization for high-impact changes, bound to the exact action, target, amount, and expiry. A chat notification alone is not an approval.",
    "status": "planned"
  },
  {
    "id": 28,
    "group": "Security, Identity & Governance",
    "name": "Session Continuity Tokenizer",
    "description": "Store session continuity only in a dedicated encrypted secret store, with short expiry and explicit account scope. Prefer server-issued OAuth over browser-cookie portability.",
    "status": "planned"
  },
  {
    "id": 29,
    "group": "Security, Identity & Governance",
    "name": "Ephemeral Sandbox Isolation",
    "description": "Run untrusted code in a properly configured isolation boundary with resource limits and deny-by-default network egress. Containers alone are not a security boundary equivalent to a VM.",
    "status": "planned"
  },
  {
    "id": 30,
    "group": "Security, Identity & Governance",
    "name": "Deterministic Replay Recording",
    "description": "Record deterministic inputs and stubbed external responses for repeatable tests. Replay must not repeat real-world side effects.",
    "status": "planned"
  },
  {
    "id": 31,
    "group": "Security, Identity & Governance",
    "name": "Multi-Model Consensus Firewall",
    "description": "Use independent policy checks and human approval for high-impact actions. Multiple model outputs are not a security boundary or authorization mechanism.",
    "status": "planned"
  },
  {
    "id": 32,
    "group": "Security, Identity & Governance",
    "name": "Compliance Guardrail Injector",
    "description": "Apply compliance controls in data access, retention, and audit systems. Adding policy text to a prompt does not establish regulatory compliance.",
    "status": "planned"
  },
  {
    "id": 33,
    "group": "Security, Identity & Governance",
    "name": "Self-Revoking Capability Passports",
    "description": "Use signed, scoped, expiring capabilities with revocation. Do not base authorization on a model confidence score.",
    "status": "planned"
  },
  {
    "id": 34,
    "group": "Security, Identity & Governance",
    "name": "Audit Log Merkle Tree Anchoring",
    "description": "Merkle-root anchoring can make later tampering detectable only when roots are published to a trusted independent system and verification is retained.",
    "status": "planned"
  },
  {
    "id": 35,
    "group": "Security, Identity & Governance",
    "name": "Zero-Trust Egress Filtering",
    "description": "Apply deny-by-default egress at the network boundary, with DNS/IP controls, logging, and a reviewed allowlist.",
    "status": "planned"
  },
  {
    "id": 36,
    "group": "Code, CI/CD & Compilation",
    "name": "AST Symbol Reflector",
    "description": "Parse source files into AST symbol nodes using a project-specific parser and validated repository scope; `src/engine/ast.ts` is an example location, not a shipped path.",
    "status": "planned"
  },
  {
    "id": 37,
    "group": "Code, CI/CD & Compilation",
    "name": "Pre-Commit TypeScript Compiler Gate",
    "description": "Run the project’s configured TypeScript compiler as a pre-commit or CI gate. A pre-commit hook is optional and can be bypassed; CI remains authoritative.",
    "status": "planned"
  },
  {
    "id": 38,
    "group": "Code, CI/CD & Compilation",
    "name": "Automated Test Runner Wrapper",
    "description": "Wrap legacy test suites (Jest, PyTest, JUnit) in MCP tools so agents receive clean JSON test receipts.",
    "status": "planned"
  },
  {
    "id": 39,
    "group": "Code, CI/CD & Compilation",
    "name": "Dependency Graph Visualizer",
    "description": "Map imports and exports across legacy codebases to guide multi-agent refactoring tasks.",
    "status": "planned"
  },
  {
    "id": 40,
    "group": "Code, CI/CD & Compilation",
    "name": "AML Transpilation Pipeline",
    "description": "Use a model or parser to draft AML from a specification, then validate and review it. AML v1 is static and this pipeline must never execute generated source.",
    "status": "planned"
  },
  {
    "id": 41,
    "group": "Code, CI/CD & Compilation",
    "name": "N+1 Query Detector",
    "description": "Detect likely N+1 query patterns and propose measured alternatives; do not automatically rewrite locking or transaction semantics.",
    "status": "planned"
  },
  {
    "id": 42,
    "group": "Code, CI/CD & Compilation",
    "name": "Dead Code Pruner",
    "description": "Identify likely unreferenced code and submit a reviewed patch with build and test evidence. Never delete code automatically based only on static heuristics.",
    "status": "planned"
  },
  {
    "id": 43,
    "group": "Code, CI/CD & Compilation",
    "name": "Automated Patch Reverter",
    "description": "Automate rollback only when side effects are known to be reversible and reconciliation is tested; database backups and external actions need separate recovery plans.",
    "status": "planned"
  },
  {
    "id": 44,
    "group": "Code, CI/CD & Compilation",
    "name": "Cross-Language Fuzzing Bridge",
    "description": "Fuzz documented API boundaries with bounded, isolated test inputs and explicit authorization. Keep fuzz traffic out of production unless approved.",
    "status": "planned"
  },
  {
    "id": 45,
    "group": "Code, CI/CD & Compilation",
    "name": "Model Arbitrage Optimizer",
    "description": "Route work using measured task quality, latency, privacy, and cost. Cheap/local models still require validation and policy controls.",
    "status": "planned"
  },
  {
    "id": 46,
    "group": "Code, CI/CD & Compilation",
    "name": "Token-Budgeted Context Packer",
    "description": "Pack context to a measured model/tokenizer budget and preserve source references; approximate counts can differ from the provider tokenizer.",
    "status": "planned"
  },
  {
    "id": 47,
    "group": "Code, CI/CD & Compilation",
    "name": "Sleep-Cycle Code Refinement",
    "description": "Schedule maintenance only with a bounded change scope, tests, review, and rollback path; background agents must not silently rewrite production code.",
    "status": "planned"
  },
  {
    "id": 48,
    "group": "Code, CI/CD & Compilation",
    "name": "Multi-Agent Git Merge Arbiter",
    "description": "Use tools to propose conflict resolutions, then require passing tests and explicit human approval before any merge. Agents never merge on their own; model votes do not prove a merge is correct.",
    "status": "planned"
  },
  {
    "id": 49,
    "group": "Code, CI/CD & Compilation",
    "name": "Documentation-to-Spec Generator",
    "description": "Parse markdown READMEs and API docs into structured JSON contract schemas.",
    "status": "planned"
  },
  {
    "id": 50,
    "group": "Code, CI/CD & Compilation",
    "name": "Zero-Downtime Blue/Green DNS Swap",
    "description": "Use staged, health-checked traffic switching with explicit rollback. A DNS update is not inherently atomic and DNS caches may delay propagation.",
    "status": "planned"
  }
];
