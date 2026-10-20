# HELLO OS roadmap: prototype gaps and evidence gates

The roadmap separates work that exists in the repository from work that is proposed. A roadmap entry is not a delivery promise. Status should be updated against merged code, tests, and documented verification.

## Near-term engineering priorities

1. Keep API schemas, failure states, security boundaries, and local setup documentation accurate.
2. Review authentication, authorization, key handling, input validation, and rate-limiting before any public multi-user deployment.
3. Improve test coverage around API contracts, persistence, and AML diagnostics.
4. Publish reproducible benchmark methods before making performance comparisons.
5. Clarify lifecycle and recovery behavior before adding background or delegated execution.

## Longer-term direction

| Proposed capability | Evidence gate before calling it implemented |
| --- | --- |
| Hosted model-provider adapters | Real provider integration tests, secret handling, budget controls, and receipts |
| Durable agent execution | Bounded workers, persistence/recovery tests, idempotency, and approval policies |
| Multi-user or multi-tenant service | Authentication, authorization, isolation tests, audit and deletion policies |
| Isolated code execution | Threat model, sandbox boundary tests, resource enforcement, and independent review |
| Production economy | Audited ledger and explicitly authorized payment settlement; current balances are internal records |
| VM or database snapshots | Implemented snapshot mechanism and reproducible performance and restore tests |
| Agent evolution tournaments | Pinned evaluations, reproducible outcomes, promotion gate, and rollback evidence |

## How to propose a roadmap change

Open a scoped issue or discussion with the user task, evidence, alternatives, acceptance criteria, maintenance cost, and security/privacy impact. Link related code or tests. Prioritize based on user value and project capacity, not keyword counts or ranking promises.

For current capability status, see the repository [README](https://github.com/CodesbyFebin/Hello-OS#readme) and [architecture direction](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/hello-cloud-architecture.md).
