# Web pages

| Page | What it is | Status |
| --- | --- | --- |
| `/` Mission Control | dashboard; falls back to labelled demo data when the API is unreachable | shipped |
| `/hub` GitAgentHUB | agent profiles, top agents, skill market and tool calls from the DB. Repos, posts and the contribution graph are **demo data**, and likes/follows are browser-only | shipped (#3) |
| `/evolve` Evolve Lab | the repo's `src/lib/evolution.ts` GA under a permanent **SIMULATION** banner, plus saved runs from `/api/evolution/runs` | shipped (#3) |
| `/cloud` HELLO Cloud | vision page; every item tagged prototype or vision; no benchmarks or pricing | shipped (#3) |
| `/aml-studio` | static AML compile/validate UI (never executes AML) | shipped |
| `/frontier` Frontier Lab | 10 ideas tagged **VISION · NOT POSSIBLE TODAY** with why-not, plus 3 labelled in-browser simulations (seeded replay/fork, self-fork via evolution.ts, sleep consolidation of a sample log) | in PR #8 |
| Seven-layer card + AML preview on `/` | layers tagged PROTOTYPE or VISION, with live HTTP checks only. The AML preview uses the repo compiler, shows a "simple lexer token count", and signs receipts with an ephemeral in-browser Ed25519 key ("demo key · not persisted") with a working Verify. It also removes the hardcoded sidebar statuses and the fake health score | in PR #9 |
| `/runtime` | the 10 runtime pillars. Status comes from live requests: `PROTOTYPE · API RESPONDS`, `NOT IN THIS BUILD · PR #N` (404), `PARTIAL`, or `NOT BUILT YET` | in PR #10, all pillars wired in PR #16 |
| `/roadmap` | 100-step roadmap; statuses come from evidence (file paths on main, or the PR state from the GitHub API, cached 10 min, with an offline fallback) | in PR #15 |
| `/integrations` | connector registry | in PR #7 |
| `/ops/*` | operator console panels (approvals, scheduler, delegation, snapshots, failures, cache, knowledge, consensus, treasury, sandbox) | in PRs #5, #6, #11–#14 |

All pages use the repo's Tailwind build and `lucide-react`. There are no CDNs and no `innerHTML` for user content.
