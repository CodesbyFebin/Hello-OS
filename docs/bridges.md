# Bridge techniques

50 techniques for connecting existing systems to HELLO OS, numbered 1–50. Each is tagged **implemented** (code + tests in this repo) or **planned** (not built).

Editing notes: no latency or savings figures are claimed; the original "50ms" copy-on-write clone claim was removed (#13). The merge arbiter (#48) always requires human approval. Payment/crypto connectors are VISION in the [registry](../src/lib/integrations/registry.ts): real-money actions require operator approval and are disabled by default. Vendor names describe possible targets, not shipped integrations.

Implemented: #4, #8, #9, #17 · Tests: `npm run test:connectors` (Node ≥ 22).


## Architecture & Protocol Wrappers

1. **MCP Wrapper Pattern** — `planned`  
   Expose a narrow, typed MCP facade over approved REST or SOAP operations. Start read-only and validate every argument.
2. **Reverse Proxy Intent Interceptor** — `planned`  
   Put a typed, allowlisted API facade in front of legacy services. Do not translate arbitrary natural-language text directly into requests that mutate state.
3. **Database Change Data Capture (CDC) Bridge** — `planned`  
   Use CDC with schema validation, data minimization, source permission checks, retention, and deletion propagation before forwarding events into a memory service.
4. **Agent Card Metadata Injection** — `implemented`  
   Publish an accurate static capability manifest at /.well-known/agent.json. Treat discovery metadata as untrusted input, not as authorization.  
   _Implementation:_ `GET /.well-known/agent.json` (`src/lib/a2a-card.ts`), now listing the read-only connector tools under `x-hello-connectors`. Discovery metadata only; grants no authorization.
5. **Async Event Bus Adapter** — `planned`  
   Bridge legacy message queues (RabbitMQ, Kafka, ActiveMQ) into the `hello.mesh` A2A protocol using event schema adapters.
6. **OAuth-to-DID Token Exchanger** — `planned`  
   Use a token-exchange gateway to issue a short-lived, scoped credential after validating the OAuth session. A DID is a separate identifier and does not inherit proof of identity automatically.
7. **GraphQL Federation Layer** — `planned`  
   Federate only the fields and operations each caller is allowed to access; query batching and round-trip counts depend on the schema and implementation.
8. **JSON-RPC Schema Reflector** — `implemented`  
   Generate candidate tool schemas from reviewed OpenAPI documents; manually review authorization, side effects, and input constraints before exposing them.  
   _Implementation:_ MCP tool `connector.openapi.reflect` (`src/lib/mcp/connectors/openapi.ts`). Emits candidate definitions; never calls the API. Write operations are excluded by default; with `includeWrites` they are emitted as `requiresApproval: true, enabled: false`.
9. **Webhook-to-Intent Transpiler** — `implemented`  
   Parse signed or authenticated webhooks into typed event records. Validate source, timestamp, replay protection, and payload schema before any downstream action.  
   _Implementation:_ `POST /api/integrations/webhook` + MCP tool `connector.webhook.transpile` (`src/lib/mcp/connectors/webhook.ts`). HMAC-SHA256 (`X-Hub-Signature-256`) with timing-safe compare; disabled (503) unless `HELLO_WEBHOOK_SECRET` is set; intents are observe-only (`executed: false`). Timestamp/replay protection is not implemented yet.
10. **Headless Browser DOM Wrapper** — `planned`  
   Use browser automation only against explicitly allowlisted pages and accounts, with scoped sessions and human approval for state-changing actions.

## Data & Memory Integration

11. **Vector Embedding Backfill** — `planned`  
   Backfill embeddings only for data with an approved purpose and retention policy; preserve source permissions and deletion requests.
12. **Causal Dead-End Log Extractor** — `planned`  
   Seed a failure registry only from authorized, redacted incident history, with provenance, retention, and correction/deletion handling.
13. **Shadow Database Cloning** — `planned`  
   Use database-native snapshots or isolated replicas when supported. Copy-on-write behavior and creation time depend on the provider and workload; no fixed latency is promised.
14. **Document Chunking & Semantic Indexing** — `planned`  
   Chunk authorized documents while preserving source access controls and citations. Do not treat model confidence scores as verified facts.
15. **Incremental Cache Invalidation** — `planned`  
   Map cache keys from legacy Redis clusters to agent memory pointers to prevent stale context retrieval.
16. **Log-to-Episodic Memory Parser** — `planned`  
   Ingest unstructured log files (JSON/Syslog) and parse them into structured episodic memory records.
17. **Schema Version Fingerprinting** — `implemented`  
   Compute SHA-256 hashes of database schemas to detect silent breaking changes before agents run queries.  
   _Implementation:_ MCP tool `connector.sql.fingerprint` (`src/lib/mcp/connectors/fingerprint.ts`). SHA-256 over canonical sorted schema JSON; order-independent; `diffSchemas` lists changed tables. An identifier, not a signature.
18. **Dead-Letter Queue (DLQ) Introspection** — `planned`  
   Expose dead-letter messages read-only first. Retrying or replaying a message requires idempotency checks and explicit approval.
19. **Audit Trail Normalizer** — `planned`  
   Normalize audit events into a documented receipt format. A hash alone is not a digital signature or proof of execution.
20. **State snapshot serialization** — `planned`  
   Serialize only approved, minimized state with schema versions, retention rules, and encryption; do not copy session secrets into memory blobs.

## Security, Identity & Governance

21. **API Key Vault Mapping** — `planned`  
   Keep API keys in a secret manager and expose narrow operations through a server-side capability proxy. Never return raw keys to prompts or model output.
22. **RBAC-to-Guardian Tier Mapper** — `planned`  
   Map roles conservatively to a documented permission matrix with explicit deny rules and owner review; Guardian tiers are not automatically equivalent to an external RBAC system.
23. **Circuit Breaker Cost Governor** — `planned`  
   Set hard request, rate, and spend limits, then stop calls on policy thresholds. P99 monitoring is a signal, not a spending-control substitute.
24. **Untrusted Content Isolation and Policy Checks** — `planned`  
   Keep external content explicitly marked as untrusted and apply context-specific validation. No sanitizer can reliably remove prompt injection from arbitrary text.
25. **Cryptographic Receipt Stamping** — `planned`  
   Use a digital signature over a canonical receipt with a protected signing key. A SHA-256 digest is an identifier, not a signature.
26. **Automated Least-Privilege Scoping** — `planned`  
   Use observed usage to recommend permission reductions; require an owner to review before changing grants because rare capabilities may still be necessary.
27. **Human-in-the-Loop Webhook Gate** — `planned`  
   Require explicit human authorization for high-impact changes, bound to the exact action, target, amount, and expiry. A chat notification alone is not an approval.
28. **Session Continuity Tokenizer** — `planned`  
   Store session continuity only in a dedicated encrypted secret store, with short expiry and explicit account scope. Prefer server-issued OAuth over browser-cookie portability.
29. **Ephemeral Sandbox Isolation** — `planned`  
   Run untrusted code in a properly configured isolation boundary with resource limits and deny-by-default network egress. Containers alone are not a security boundary equivalent to a VM.
30. **Deterministic Replay Recording** — `planned`  
   Record deterministic inputs and stubbed external responses for repeatable tests. Replay must not repeat real-world side effects.
31. **Multi-Model Consensus Firewall** — `planned`  
   Use independent policy checks and human approval for high-impact actions. Multiple model outputs are not a security boundary or authorization mechanism.
32. **Compliance Guardrail Injector** — `planned`  
   Apply compliance controls in data access, retention, and audit systems. Adding policy text to a prompt does not establish regulatory compliance.
33. **Self-Revoking Capability Passports** — `planned`  
   Use signed, scoped, expiring capabilities with revocation. Do not base authorization on a model confidence score.
34. **Audit Log Merkle Tree Anchoring** — `planned`  
   Merkle-root anchoring can make later tampering detectable only when roots are published to a trusted independent system and verification is retained.
35. **Zero-Trust Egress Filtering** — `planned`  
   Apply deny-by-default egress at the network boundary, with DNS/IP controls, logging, and a reviewed allowlist.

## Code, CI/CD & Compilation

36. **AST Symbol Reflector** — `planned`  
   Parse source files into AST symbol nodes using a project-specific parser and validated repository scope; `src/engine/ast.ts` is an example location, not a shipped path.
37. **Pre-Commit TypeScript Compiler Gate** — `planned`  
   Run the project’s configured TypeScript compiler as a pre-commit or CI gate. A pre-commit hook is optional and can be bypassed; CI remains authoritative.
38. **Automated Test Runner Wrapper** — `planned`  
   Wrap legacy test suites (Jest, PyTest, JUnit) in MCP tools so agents receive clean JSON test receipts.
39. **Dependency Graph Visualizer** — `planned`  
   Map imports and exports across legacy codebases to guide multi-agent refactoring tasks.
40. **AML Transpilation Pipeline** — `planned`  
   Use a model or parser to draft AML from a specification, then validate and review it. AML v1 is static and this pipeline must never execute generated source.
41. **N+1 Query Detector** — `planned`  
   Detect likely N+1 query patterns and propose measured alternatives; do not automatically rewrite locking or transaction semantics.
42. **Dead Code Pruner** — `planned`  
   Identify likely unreferenced code and submit a reviewed patch with build and test evidence. Never delete code automatically based only on static heuristics.
43. **Automated Patch Reverter** — `planned`  
   Automate rollback only when side effects are known to be reversible and reconciliation is tested; database backups and external actions need separate recovery plans.
44. **Cross-Language Fuzzing Bridge** — `planned`  
   Fuzz documented API boundaries with bounded, isolated test inputs and explicit authorization. Keep fuzz traffic out of production unless approved.
45. **Model Arbitrage Optimizer** — `planned`  
   Route work using measured task quality, latency, privacy, and cost. Cheap/local models still require validation and policy controls.
46. **Token-Budgeted Context Packer** — `planned`  
   Pack context to a measured model/tokenizer budget and preserve source references; approximate counts can differ from the provider tokenizer.
47. **Sleep-Cycle Code Refinement** — `planned`  
   Schedule maintenance only with a bounded change scope, tests, review, and rollback path; background agents must not silently rewrite production code.
48. **Multi-Agent Git Merge Arbiter** — `planned`  
   Use tools to propose conflict resolutions, then require passing tests and explicit human approval before any merge. Agents never merge on their own; model votes do not prove a merge is correct.
49. **Documentation-to-Spec Generator** — `planned`  
   Parse markdown READMEs and API docs into structured JSON contract schemas.
50. **Zero-Downtime Blue/Green DNS Swap** — `planned`  
   Use staged, health-checked traffic switching with explicit rollback. A DNS update is not inherently atomic and DNS caches may delay propagation.
