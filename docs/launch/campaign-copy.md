# Launch copy drafts

Replace `[launch URL]` only after a stable custom domain is chosen. The current Vercel URL is a deployment URL and should not be treated as a permanent brand domain. Link source code to `https://github.com/CodesbyFebin/Hello-OS` and downloads to `https://codesbyfebin.github.io/Hello-OS/downloads/`.

## Product Hunt draft

**Name:** HELLO OS  
**Tagline:** A local-first workspace for inspectable agent identity, memory, missions, and MCP receipts  
**Description:** HELLO OS is an open-source prototype for exploring agent-oriented workflows. Run it locally, inspect persisted agent and mission records, connect the local MCP service, and compile AML into a deterministic graph. AML is static and non-executable; the product does not include a hosted model runtime or production multi-tenant cloud service.  
**Maker note:** I built HELLO OS to make the boundary between agent intent, tool calls, and inspectable records easier to discuss. The repository includes local setup instructions, API and protocol docs, tests, and a download portal. Feedback on the smallest useful next capability is welcome.

## Hacker News: Show HN draft

**Title:** Show HN: HELLO OS - a local-first prototype for inspectable agent workflows

I built HELLO OS as a local-first prototype for exploring agent identity records, missions, memory, MCP interactions, and reviewable receipts. It runs with Next.js, Prisma, SQLite, and a separate Bun MCP service.

One part I wanted to make explicit is what the project does not do: the AML compiler only parses and validates; it cannot execute tools or code. Wallet values are internal credits, and the dashboard showcase is synthetic. There is no hosted LLM runtime, production auth, or microVM executor.

The repo has Docker Compose setup, protocol notes, a static compiler API, and tests. I would value feedback on the data model and what evidence an agent workflow should expose by default.

Repo: https://github.com/CodesbyFebin/Hello-OS

## Reddit draft

**Title:** I built a local-first agent-workflow prototype with a non-executable AML compiler - looking for technical feedback

HELLO OS explores identity records, missions, memory, a local MCP service, and inspectable receipts. Its AML API produces a static graph and diagnostics; it never runs the source. The project is not a production cloud service, and the sample dashboard artwork uses synthetic data.

I am especially interested in feedback on the AML schema, MCP boundaries, and what should be required before adding an execution runtime. Source and local setup: https://github.com/CodesbyFebin/Hello-OS

Adapt this for a community only if self-promotion is allowed and the post contributes to the discussion.

## X thread draft

1. I built HELLO OS to explore a practical question: what should an agent workspace make easy to inspect? Repo: https://github.com/CodesbyFebin/Hello-OS
2. The current prototype stores agent identity records, missions, memory entries, traces, and internal ledger records in a local SQLite database.
3. A separate Bun service exposes selected MCP tools. The current setup is for local evaluation; it is not an authenticated public tool service.
4. AML is a declarative source format with a static parser and validator. It returns diagnostics and an intent graph.
5. Crucially, AML is not executable. It cannot call tools, spawn processes, mutate records, or deploy code.
6. Dashboard API-backed panels read the configured instance. The `/evolve` view and showcase image are simulations or synthetic artwork, with labels.
7. HELLO OS does not currently provide a hosted model runtime, production authentication, multi-tenant isolation, on-chain settlement, or microVM execution.
8. The goal is to get the boundaries and records right before expanding capabilities. Feedback on the local setup, API contracts, and AML grammar is welcome.
9. Run locally with the documented Node.js, npm, Bun, and Docker setup. Download links point to source and actual GitHub release assets: https://codesbyfebin.github.io/Hello-OS/downloads/
10. Read the architecture and prototype limits before trying it with sensitive data or untrusted users. Contributions and focused bug reports are welcome.

## LinkedIn article outline

**Working title:** Designing agent infrastructure that makes its limits inspectable

- Start with the operating problem: agent state and tool records need to be reviewable.
- Describe HELLO OS as an open-source local prototype, not an enterprise platform.
- Show the current flow: persisted records, local MCP tools, and static AML diagnostics.
- Discuss what must come before hosted use: auth, isolation, backup/restore, observability, and service reliability.
- Close with a concrete question for platform engineers and a link to the source.

## Micro-influencer outreach note

Use a short, personalized note only after reviewing the recipient's work. Mention one relevant post or project, explain the prototype in one sentence, include the limitations, and ask whether they would like a link. Do not imply an endorsement, pay for undisclosed coverage, or send repeated follow-ups after an opt-out.

## Newsletter pitch draft

**Subject:** Open-source local prototype explores inspectable agent workflows

Hello,

I built HELLO OS, an MIT-licensed local-first prototype for exploring agent identity records, missions, memory, selected MCP interactions, and reviewable work receipts. Its AML compiler only parses and validates source; it does not execute it. There is no hosted model runtime or production cloud service.

If that fits your developer audience, here are the source and a one-page press kit: https://github.com/CodesbyFebin/Hello-OS

Thanks for considering it. If it is not a fit, no reply is needed.

## Dev.to or Hashnode article pitch

**Title:** I built a static compiler for agent intent - and kept execution out of scope

Draft the AML compiler article from the code and tests. Explain the grammar, capability declarations, validation diagnostics, deterministic graph hash, and bounded input. Compare a source snippet with its parsed graph using examples from the repository. Explicitly state that lexical token estimates are not vendor-tokenizer measurements or proven savings.

## 30-second demo challenge

Show a small AML capability that calls `build` and `deploy` while requiring only `build`. Compile it and highlight the missing-capability diagnostic. Then add the requirement and compile again. The payoff is a useful, reproducible validation loop - not a claim that an agent executed the plan.

## Guest post / conference abstract

**Working title:** Make agent tool boundaries inspectable before adding execution

This talk uses HELLO OS as a prototype case study: what is stored, what an MCP receipt records, how a declarative intent graph is validated, and which controls must exist before a runtime can execute tools. It is a design and implementation report, not a production performance case study.
