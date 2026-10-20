# Two-week HELLO OS content calendar

This is a draft cadence, not a promise of daily reach. Publish only after checking each article against the current code and linking to the relevant implementation. Each item should point to the repository and clearly say when a feature is prototype-only.

| Day | Format | Topic | Evidence to include |
| --- | --- | --- | --- |
| 1 | Short post | Why an agent workspace needs inspectable work records | Link to dashboard and API route; label screenshot data synthetic |
| 2 | Technical article | HELLO OS architecture: Next.js, Prisma, SQLite, and local MCP service | Architecture diagram and deployment boundaries |
| 3 | Short demo | Create an agent record and inspect its identity | Fresh recording from a clean local database |
| 4 | Technical article | Static AML compiler: parse, validate, hash, never execute | Grammar, diagnostics, tests, and input-size limit |
| 5 | Developer note | Modeling bounded missions and internal credit ledgers | Schema and spend endpoint; state credits are not money |
| 6 | Community question | What evidence should an agent leave after a tool call? | Ask for examples; do not present invented engagement |
| 7 | Technical article | MCP receipts and the current integration boundary | Tool registry, service setup, and missing auth/transport features |
| 8 | Short post | Simulation labels and why demo data must be obvious | Before/after UI capture with labeled synthetic values |
| 9 | Tutorial | Run HELLO OS locally with Docker Compose | Record exact Node/Bun/Docker versions and clean start result |
| 10 | Technical article | SQLite prototype: persistence, backup, and the path to hosted storage | Known concurrency, isolation, and operational limitations |
| 11 | Short demo | Validate invalid AML and read structured diagnostics | Show a test fixture and the response, not a performance claim |
| 12 | Technical article | Threat-modeling an agent tool boundary before execution exists | State clearly that the runtime remains out of scope |
| 13 | Contributor post | A small issue, test, or docs improvement with its author credited | Obtain consent before naming or quoting contributors |
| 14 | Launch recap | What shipped, what remains, and the next measurable milestone | Link release, discussions, docs, and roadmap issues |

## Video series

Produce three short tutorial recordings first; extend the series only after viewers ask for more. Target 10-15 minutes and capture a fresh local run.

1. **Start HELLO OS locally** - requirements, `.env.example`, Prisma setup, Docker Compose, and the first empty dashboard state.
2. **Compile AML safely** - valid and invalid input, the validation API, graph output, source hash, size limit, and the fact that source is never executed.
3. **Inspect an MCP receipt** - start the local MCP service, inspect the tool registry, make one supported call, and review the stored receipt. Explain that the service is not ready for public unauthenticated exposure.

Potential follow-ups: explain the Prisma data model, contribute a test, and trace a dashboard request from UI to API. Do not record secrets or real personal data.

## Blog series briefs

1. **Agent workspaces need receipts** — explain the need for inspectable records and show HELLO OS's current trace/MCP receipt model. Avoid claims that records are tamper-proof or certified.
2. **A static language for agent intent** — walk through AML parsing, diagnostics, hashing, and why the compiler never executes input.
3. **From local SQLite prototype to hosted system** — describe the current database and list the missing auth, isolation, backup, and queue controls.
4. **MCP integration without pretending every tool is safe** — explain the local service and the authentication and capability-policy work still needed.
5. **How to label agent simulations honestly** — distinguish generated artwork, seeded examples, locally persisted records, and real external activity.

For any cross-post, preserve canonical attribution and platform-specific formatting. Do not syndicate the same article as dozens of near-duplicate SEO pages.
