# Integration catalog

This catalog captures 100 connector targets and 50 legacy-bridge patterns proposed for HELLO OS. It is a **planning reference**, not a feature matrix: every connector entry has `status: proposal` and `connected: false`; every bridge pattern has `shipped: false`. None should be interpreted as an available vendor integration.

- [Browse the catalog](index.html)
- [Machine-readable connector registry](connector-registry.json)
- [Machine-readable bridge patterns](bridge-patterns.json)

## Safe implementation baseline

- Begin with read-only operations and an explicit allowlist of resources and methods.
- Treat prompts, webhook payloads, repository files, database rows, and remote tool results as untrusted data.
- Keep credentials server-side in a secret manager; never expose raw keys to a model or browser.
- Require scoped, expiring authorization and human review for writes, deployments, payments, identity changes, and destructive operations.
- Add rate limits, idempotency, audit events, failure handling, and tests before enabling a connector.
- Treat model consensus, prompt filtering, hashes, and containerization as supporting controls, not as authorization or a complete security boundary.
- State provider-specific behavior and latency only after it has been measured and verified.

The current HELLO OS prototype exposes its own local MCP service and database-backed APIs. It does not ship the 100 third-party integrations listed here. AML is a static parser and validator; it does not invoke these integrations.
