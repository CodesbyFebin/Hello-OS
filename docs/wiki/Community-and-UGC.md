# HELLO OS community contributions: authentic UGC and technical reports

HELLO OS community content should help another developer reproduce a setup, understand a limitation, review an API, or learn from a real experiment. Posts must come from a person or clearly identified tool-assisted author with a real source, test, or question. Do not generate, stage, or publish fake user discussions, testimonials, deployment stories, benchmark results, votes, or contributor activity.

## Where to contribute

- Use GitHub Discussions for questions, design ideas, reproducible reports, and project feedback when the feature is enabled.
- Use GitHub Issues for actionable bugs and scoped feature requests.
- Use pull requests for documentation, tests, code, and reproducible examples.
- Follow [`CONTRIBUTING.md`](https://github.com/CodesbyFebin/Hello-OS/blob/main/CONTRIBUTING.md), the issue templates, and the repository license.

If Discussions are not enabled in repository settings, use issues or pull requests until a maintainer enables them. This documentation cannot switch GitHub repository settings.

## Suggested discussion categories

| Category | Purpose | Evidence to include |
| --- | --- | --- |
| Help and setup | Install problems and usage questions | OS, Node/Bun versions, command, sanitized logs |
| AML and validation | Parser behavior, examples, diagnostics | AML snippet, endpoint, expected and actual output |
| MCP and integrations | Connector ideas and compatibility | Client/server versions, request flow, permission scope |
| Benchmarks | Reproducible performance or token measurements | Full benchmark record from [Benchmarks and evidence](Benchmarks-and-Evidence) |
| Design and roadmap | Tradeoffs, priorities, proposals | User task, alternatives, risks, acceptance criteria |
| Show and tell | Real, consented HELLO OS examples | What ran, what did not, sources, demo-data labels |

## Twenty-four community prompt starters

Use these to invite distinct, useful contributions. A prompt is not a post and does not count as community activity until a real person contributes.

1. Which operating system and Node version did you use for a fresh install?
2. Which setup step failed first, and what exact error did you see?
3. What did you expect to happen after running `npm run dev`?
4. Which API route did you try, and what response did you receive?
5. Which AML example helped you understand the static compiler?
6. Which AML syntax produced a confusing diagnostic?
7. What test would make the AML validator easier to trust?
8. Which operation name did you initially assume AML would execute?
9. Which MCP client did you connect locally, and what configuration was needed?
10. What permission boundary would you require before exposing the MCP service?
11. Which A2A-style task exchange did you test, and where did interoperability stop?
12. What data should a tool receipt preserve for debugging?
13. What should a local operator be able to delete or export?
14. Which prototype boundary was unclear in the README or UI?
15. What is the smallest meaningful contribution a first-time contributor can make?
16. Which route needs an example request/response in the docs?
17. What would you measure before calling a workflow reliable?
18. Which hardware, runtime, and workload would another person need to reproduce your result?
19. What failed experiment prevented you from repeating a dead end?
20. Which integration should be prioritized, and what user task would it solve?
21. Which dashboard state helped you find an API or data issue?
22. What privacy or retention behavior should be documented before a hosted version exists?
23. Which roadmap item is blocked by an assumption that needs a small test?
24. What documentation change would have saved you the most time today?

## Contribution templates

### Reproducible experiment

```markdown
### Goal
### HELLO OS revision and environment
### Exact setup and commands
### Expected result
### Observed result
### Logs or artifacts (redacted)
### What is synthetic, estimated, or live
### Limitations and next question
```

### Integration report

```markdown
### Client and version
### HELLO OS revision
### Local configuration (no secrets)
### Read-only calls tested
### State-changing calls tested, if any
### Compatibility gaps
### Reproduction steps
```

### Feature proposal

```markdown
### User task
### Current friction and evidence
### Proposed change
### Alternatives considered
### Security and privacy impact
### Acceptance criteria
```

## Editorial and integrity rules

- Label simulation screenshots, mockups, estimates, and generated content clearly.
- Never invent usage, stars, users, customer stories, benchmarks, latency, prices, or service-level commitments.
- Do not post the same content repeatedly across categories or platforms to manipulate search or GitHub ranking.
- Disclose AI assistance when it materially shaped an article or report; the author remains responsible for facts and links.
- Remove secrets, access tokens, private keys, personal data, and private customer information before sharing logs.
- Cite the exact repository revision and source when describing implementation behavior.
- Do not promise HLO, USDC, or other rewards. No reward program is part of the current project unless a maintainer publishes a verifiable, funded policy.

## A sustainable path toward 20,000 community contributions

“20k+ UGC” is a long-term audience goal, not a reason to manufacture 20,000 discussion posts. Grow through useful releases, reproducible tasks, responsive maintainer answers, contributor-owned tutorials, issue follow-through, and periodic summaries of real work. Track genuine unique contributors, accepted fixes, resolved questions, reproduced reports, and useful outbound references. Report counts only from the relevant GitHub or analytics source, define the date range, and separate views from contributions.

Suggested cadence: publish one substantive release note or technical explainer when there is a real change; respond to open questions; invite feedback on a scoped decision; and publish a monthly digest of accepted contributions and unresolved gaps. Scale only when moderation, maintenance, and factual review can keep up.
