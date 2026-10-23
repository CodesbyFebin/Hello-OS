# Web pages

| Page | What it is | Status |
| --- | --- | --- |
| `/` Mission Control | dashboard reads the configured APIs; empty and offline states do not substitute sample records | shipped |
| `/hub` Agent Hub | agent profiles, capability market, field reports and MCP tool calls from this instance's DB. The HELLO OS GitHub repository is linked as a source reference; agent repository hosting, likes, follows, and GitHub synchronization are not implemented | prototype |
| `/evolve` Evolve Lab | deterministic in-browser GA under a permanent **SIMULATION** banner, plus database-backed runs from `/api/evolution/runs` | shipped |
| `/cloud` HELLO Cloud | vision page; every item tagged prototype or vision; no benchmarks or pricing | shipped |
| `/aml-studio` | static AML compile/validate UI (never executes AML) | shipped |
| `/sessions` | HELLO OS guide for a local CLI/TUI that ports text sessions among Claude Code, Codex, and OpenCode; the web app never reads local files | prototype |
| `/frontier` Frontier Lab | vision ideas plus three labelled in-browser simulations | shipped |
| Seven-layer card + AML preview on `/` | prototype/vision labels, live endpoint checks, static compiler preview, and ephemeral demo-key receipts | shipped |
| `/runtime` | runtime pillar status based on live checks and implementation evidence | shipped |
| `/roadmap` | 100-step roadmap; statuses use repository evidence and optional GitHub PR state | shipped |
| `/integrations` | connector registry; unconnected proposals are marked as such | shipped |
| `/ops/*` | operator console panels (approvals, scheduler, delegation, snapshots, failures, cache, knowledge, consensus, treasury, sandbox) | shipped |

All pages use the repo's Tailwind build and `lucide-react`. There are no CDNs and no `innerHTML` for user content.
