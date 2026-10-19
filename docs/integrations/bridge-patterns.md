# 50 legacy-to-agent bridge patterns

All entries below are design patterns, not shipped HELLO OS capabilities. Select and threat-model a specific use case before implementation. Use read-only access first; writes require an explicit policy gate and, for high-impact actions, human approval bound to the exact action.

## 1. MCP Wrapper Pattern

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Expose a narrow, typed MCP facade over approved REST or SOAP operations. Start read-only and validate every argument.

## 2. Reverse Proxy Intent Interceptor

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Put a typed, allowlisted API facade in front of legacy services. Do not translate arbitrary natural-language text directly into requests that mutate state.

## 3. Database Change Data Capture (CDC) Bridge

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Use CDC with schema validation, data minimization, source permission checks, retention, and deletion propagation before forwarding events into a memory service.

## 4. Agent Card Metadata Injection

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Publish an accurate static capability manifest at /.well-known/agent.json. Treat discovery metadata as untrusted input, not as authorization.

## 5. Async Event Bus Adapter

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Bridge legacy message queues (RabbitMQ, Kafka, ActiveMQ) into the `hello.mesh` A2A protocol using event schema adapters.

## 6. OAuth-to-DID Token Exchanger

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Use a token-exchange gateway to issue a short-lived, scoped credential after validating the OAuth session. A DID is a separate identifier and does not inherit proof of identity automatically.

## 7. GraphQL Federation Layer

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Federate only the fields and operations each caller is allowed to access; query batching and round-trip counts depend on the schema and implementation.

## 8. JSON-RPC Schema Reflector

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Generate candidate tool schemas from reviewed OpenAPI documents; manually review authorization, side effects, and input constraints before exposing them.

## 9. Webhook-to-Intent Transpiler

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Parse signed or authenticated webhooks into typed event records. Validate source, timestamp, replay protection, and payload schema before any downstream action.

## 10. Headless Browser DOM Wrapper

**Area:** Architecture & Protocol Wrappers (1–10)  
**Status:** Design pattern only; not implemented.

Use browser automation only against explicitly allowlisted pages and accounts, with scoped sessions and human approval for state-changing actions.

## 11. Vector Embedding Backfill

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Backfill embeddings only for data with an approved purpose and retention policy; preserve source permissions and deletion requests.

## 12. Causal Dead-End Log Extractor

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Seed a failure registry only from authorized, redacted incident history, with provenance, retention, and correction/deletion handling.

## 13. Shadow Database Cloning

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Use database-native snapshots or isolated replicas when supported. Copy-on-write behavior and creation time depend on the provider and workload; no fixed latency is promised.

## 14. Document Chunking & Semantic Indexing

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Chunk authorized documents while preserving source access controls and citations. Do not treat model confidence scores as verified facts.

## 15. Incremental Cache Invalidation

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Map cache keys from legacy Redis clusters to agent memory pointers to prevent stale context retrieval.

## 16. Log-to-Episodic Memory Parser

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Ingest unstructured log files (JSON/Syslog) and parse them into structured episodic memory records.

## 17. Schema Version Fingerprinting

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Compute SHA-256 hashes of database schemas to detect silent breaking changes before agents run queries.

## 18. Dead-Letter Queue (DLQ) Introspection

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Expose dead-letter messages read-only first. Retrying or replaying a message requires idempotency checks and explicit approval.

## 19. Audit Trail Normalizer

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Normalize audit events into a documented receipt format. A hash alone is not a digital signature or proof of execution.

## 20. State snapshot serialization

**Area:** Data & Memory Integration (11–20)  
**Status:** Design pattern only; not implemented.

Serialize only approved, minimized state with schema versions, retention rules, and encryption; do not copy session secrets into memory blobs.

## 21. API Key Vault Mapping

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Keep API keys in a secret manager and expose narrow operations through a server-side capability proxy. Never return raw keys to prompts or model output.

## 22. RBAC-to-Guardian Tier Mapper

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Map roles conservatively to a documented permission matrix with explicit deny rules and owner review; Guardian tiers are not automatically equivalent to an external RBAC system.

## 23. Circuit Breaker Cost Governor

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Set hard request, rate, and spend limits, then stop calls on policy thresholds. P99 monitoring is a signal, not a spending-control substitute.

## 24. Untrusted Content Isolation and Policy Checks

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Keep external content explicitly marked as untrusted and apply context-specific validation. No sanitizer can reliably remove prompt injection from arbitrary text.

## 25. Cryptographic Receipt Stamping

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Use a digital signature over a canonical receipt with a protected signing key. A SHA-256 digest is an identifier, not a signature.

## 26. Automated Least-Privilege Scoping

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Use observed usage to recommend permission reductions; require an owner to review before changing grants because rare capabilities may still be necessary.

## 27. Human-in-the-Loop Webhook Gate

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Require explicit human authorization for high-impact changes, bound to the exact action, target, amount, and expiry. A chat notification alone is not an approval.

## 28. Session Continuity Tokenizer

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Store session continuity only in a dedicated encrypted secret store, with short expiry and explicit account scope. Prefer server-issued OAuth over browser-cookie portability.

## 29. Ephemeral Sandbox Isolation

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Run untrusted code in a properly configured isolation boundary with resource limits and deny-by-default network egress. Containers alone are not a security boundary equivalent to a VM.

## 30. Deterministic Replay Recording

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Record deterministic inputs and stubbed external responses for repeatable tests. Replay must not repeat real-world side effects.

## 31. Multi-Model Consensus Firewall

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Use independent policy checks and human approval for high-impact actions. Multiple model outputs are not a security boundary or authorization mechanism.

## 32. Compliance Guardrail Injector

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Apply compliance controls in data access, retention, and audit systems. Adding policy text to a prompt does not establish regulatory compliance.

## 33. Self-Revoking Capability Passports

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Use signed, scoped, expiring capabilities with revocation. Do not base authorization on a model confidence score.

## 34. Audit Log Merkle Tree Anchoring

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Merkle-root anchoring can make later tampering detectable only when roots are published to a trusted independent system and verification is retained.

## 35. Zero-Trust Egress Filtering

**Area:** Security, Identity & Governance (21–35)  
**Status:** Design pattern only; not implemented.

Apply deny-by-default egress at the network boundary, with DNS/IP controls, logging, and a reviewed allowlist.

## 36. AST Symbol Reflector

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Parse source files into AST symbol nodes using a project-specific parser and validated repository scope; `src/engine/ast.ts` is an example location, not a shipped path.

## 37. Pre-Commit TypeScript Compiler Gate

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Run the project’s configured TypeScript compiler as a pre-commit or CI gate. A pre-commit hook is optional and can be bypassed; CI remains authoritative.

## 38. Automated Test Runner Wrapper

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Wrap legacy test suites (Jest, PyTest, JUnit) in MCP tools so agents receive clean JSON test receipts.

## 39. Dependency Graph Visualizer

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Map imports and exports across legacy codebases to guide multi-agent refactoring tasks.

## 40. AML Transpilation Pipeline

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Use a model or parser to draft AML from a specification, then validate and review it. AML v1 is static and this pipeline must never execute generated source.

## 41. N+1 Query Detector

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Detect likely N+1 query patterns and propose measured alternatives; do not automatically rewrite locking or transaction semantics.

## 42. Dead Code Pruner

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Identify likely unreferenced code and submit a reviewed patch with build and test evidence. Never delete code automatically based only on static heuristics.

## 43. Automated Patch Reverter

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Automate rollback only when side effects are known to be reversible and reconciliation is tested; database backups and external actions need separate recovery plans.

## 44. Cross-Language Fuzzing Bridge

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Fuzz documented API boundaries with bounded, isolated test inputs and explicit authorization. Keep fuzz traffic out of production unless approved.

## 45. Model Arbitrage Optimizer

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Route work using measured task quality, latency, privacy, and cost. Cheap/local models still require validation and policy controls.

## 46. Token-Budgeted Context Packer

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Pack context to a measured model/tokenizer budget and preserve source references; approximate counts can differ from the provider tokenizer.

## 47. Sleep-Cycle Code Refinement

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Schedule maintenance only with a bounded change scope, tests, review, and rollback path; background agents must not silently rewrite production code.

## 48. Multi-Agent Git Merge Arbiter

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Use tools to propose conflict resolutions, then require normal tests and human review before merging. Model votes do not prove a merge is correct.

## 49. Documentation-to-Spec Generator

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Parse markdown READMEs and API docs into structured JSON contract schemas.

## 50. Zero-Downtime Blue/Green DNS Swap

**Area:** Code, CI/CD & Compilation (36–50)  
**Status:** Design pattern only; not implemented.

Use staged, health-checked traffic switching with explicit rollback. A DNS update is not inherently atomic and DNS caches may delay propagation.

