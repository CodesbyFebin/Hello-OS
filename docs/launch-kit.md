# HELLO OS launch kit (drafts for the maintainer)

Everything here is a **draft for the maintainer to apply by hand**. Nothing in this PR changes repository settings, creates tags or releases, or contacts any external service.

## 1. Repository description (250 characters)
> HELLO OS is an open-source (MIT), local-first agentic OS prototype: Ed25519 did:key agent identities, tiered memory, missions, MCP tools, A2A-style delegation and capped credit wallets behind an operator approval gate. Next.js + SQLite. Experimental.

## 2. Topics (20)
`agentic-os` `ai-agents` `model-context-protocol` `mcp-server` `a2a-protocol` `multi-agent-systems` `agent-identity` `did-key` `ed25519` `agent-memory` `agent-tools` `llm` `nextjs` `typescript` `prisma` `sqlite` `local-first` `self-hosted` `docker-compose` `open-source`

This updates the list in `repository-metadata.md`. It drops `agent-economy` (credits aren't money) and `github-pages` (the Pages site is only the guide), and adds `model-context-protocol`, `mcp-server`, `ed25519` and `local-first`. Topics help GitHub search; they don't guarantee ranking or trending.

### Commands (run these yourself)
```sh
gh repo edit CodesbyFebin/Hello-OS \
  --description "HELLO OS is an open-source (MIT), local-first agentic OS prototype: Ed25519 did:key agent identities, tiered memory, missions, MCP tools, A2A-style delegation and capped credit wallets behind an operator approval gate. Next.js + SQLite. Experimental." \
  --homepage "https://codesbyfebin.github.io/Hello-OS/"

gh repo edit CodesbyFebin/Hello-OS \
  --add-topic agentic-os,ai-agents,model-context-protocol,mcp-server,a2a-protocol \
  --add-topic multi-agent-systems,agent-identity,did-key,ed25519,agent-memory \
  --add-topic agent-tools,llm,nextjs,typescript,prisma \
  --add-topic sqlite,local-first,self-hosted,docker-compose,open-source
```
The repo currently has no topics, so the 20-topic limit is not exceeded. Private vulnerability reporting is currently **disabled**. Enable it under Settings → Code security, so the link in `SECURITY.md` works.

## 3. Release notes draft

### Recommendation: tag `v0.2.1`, not `v1.0.0`
In semver, 1.0.0 signals a stable public API. HELLO OS is an experimental prototype: API shapes still change between PRs, keys are stored by the demo server, operator auth is a shared token with an open dev mode, and there is no migration story for the SQLite schema. `v0.2.1` sets honest expectations and leaves 1.0 for when those boundaries are hardened. `package.json` already says `0.2.1`, so the tag matches it (the agent card and MCP server still report `0.1.0`, which is worth aligning in a follow-up).

### Draft: HELLO OS v0.2.1 (prototype)
HELLO OS is an experimental, local-first agentic OS. This first tagged release collects the work merged so far. Labels: **implemented** = real route or API (prototype quality); **prototype** = partial or simulated, with stated limits; **vision** = design only.

**Identity and trust**
- Implemented: Ed25519 did:key identities, versioned soul documents, DID resolution (`/api/did/resolve`), signed A2A messages.
- Implemented: API routes never return agent private keys (#4).

**Governance**
- Implemented: approval gate with risk tiers, operator kill switch and audit log (#5).
- Implemented: reputation-weighted debates, and treasury reallocation through the gate (#13).

**Runtime**
- Implemented: heartbeat scheduler and a delegation tree with credit caps (#6).
- Implemented: sealed checkpoint/resume snapshots and a failure library (#11).
- Implemented: semantic cache with a measured hit rate, and a permission-scoped knowledge index (#12).
- Implemented: QuickJS WebAssembly sandbox with time and memory limits (#14).

**Integrations**
- Implemented: integrations registry, 6 read-only MCP connector tools and an HMAC webhook bridge (#7).
- Vision: the 100-target connector catalog is roadmap only, with every connector marked unconnected.

**UI and docs**
- Implemented: Mission Control seven-layer overview and an AML static compile preview; AML is never executed (#9).
- Implemented: `/runtime` pillar status wired to live APIs (#10, #16), and the 100-step `/roadmap` with evidence-backed statuses (#15).
- Prototype: `/hub`, `/evolve` and `/cloud` pages with labelled demo data (#3), and Frontier Lab vision ideas with labelled simulations (#8).
- Docs: honest labelling (#1), contributor docs (#2), operator guide and merge order (#17).

**Not included / vision:** Firecracker microVMs, copy-on-write databases, multi-model routing, real-money payments, full MCP/A2A conformance, OAuth, production multi-tenancy, tamper-proof audit.

**Open PRs not in this release** (add them only if merged before tagging): #18 landing hero, #19 main build fix, #20 Agent Commons live dashboard, #21 `/docs` portal, and this launch-kit PR.

**Known limitations:** demo key custody; operator dev mode when `HELLO_OPERATOR_TOKEN` is unset; MCP receipts are SHA-256 hashes, not signatures; credits are prototype units with no monetary value.

```sh
# Run yourself once #19 is merged and CI is green on main:
gh release create v0.2.1 --target main --title "HELLO OS v0.2.1 (prototype)" --notes-file release-notes.md --prerelease
```

## 4. Manual launch checklist (white-hat only)
- [ ] Merge #19, then confirm CI is green on `main`.
- [ ] Apply the description, homepage and topics (section 2). Enable private vulnerability reporting.
- [ ] Check the README Feature status table against the code; fix any drift before announcing.
- [ ] Tag `v0.2.1` as a pre-release with the notes above.
- [ ] Confirm the Pages guide deployed and `https://codesbyfebin.github.io/Hello-OS/sitemap.xml` loads.
- [ ] Submit the sitemap once in Google Search Console and Bing Webmaster Tools (verify ownership through the official flows).
- [ ] Optional IndexNow ping (section 5), once, after the deploy.
- [ ] Write one honest announcement post per channel (Show HN, a relevant subreddit following its self-promotion rules, X or LinkedIn, dev.to). Link the repo, state that it's a prototype, and include no unmeasured numbers.
- [ ] Reply to issues and comments yourself; label a few `good first issue`s.
- [ ] **Never:** buy stars, followers or upvotes; use star-for-star rings or sockpuppets; mass-tag or DM people; spam link directories; post fake testimonials or benchmarks; use links to `hello-agentos` domains or repos (banned: they aren't this project).

## 5. IndexNow (Bing, Yandex and other participating engines)
GitHub Pages publishes `docs/`, so the key file is `docs/5dd568e7e5166463566f0abec7a90c00.txt` (contents: the key). It is in `docs/` rather than `public/` because `public/` is served only by the self-hosted app, not by Pages. After the Pages workflow deploys it, check that it's live:
```sh
curl -s https://codesbyfebin.github.io/Hello-OS/5dd568e7e5166463566f0abec7a90c00.txt   # must print the key
```
Then **you** run this once (this PR does not ping anything):
```sh
curl -s -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" -d '{
  "host": "codesbyfebin.github.io",
  "key": "5dd568e7e5166463566f0abec7a90c00",
  "keyLocation": "https://codesbyfebin.github.io/Hello-OS/5dd568e7e5166463566f0abec7a90c00.txt",
  "urlList": [
    "https://codesbyfebin.github.io/Hello-OS/",
    "https://codesbyfebin.github.io/Hello-OS/getting-started/",
    "https://codesbyfebin.github.io/Hello-OS/downloads/",
    "https://codesbyfebin.github.io/Hello-OS/agent-guide/",
    "https://codesbyfebin.github.io/Hello-OS/aml-studio/",
    "https://codesbyfebin.github.io/Hello-OS/evolution-lab/",
    "https://codesbyfebin.github.io/Hello-OS/hello-evolve/",
    "https://codesbyfebin.github.io/Hello-OS/integrations/"
  ]
}'
```
- A key file under `/Hello-OS/` only authorises URLs under that path, which covers all of the above.
- HTTP 200 or 202 means the request was accepted. It does not guarantee indexing.
- Ping again only when pages actually change.
- The pasted package's sample key and its `hello-agentos` URLs are deliberately not used.


## Expanded press and content kit

The companion folder [`docs/launch/`](launch/README.md) contains the press-kit source and PDF, channel-specific copy drafts, a two-week content calendar, launch operations checklist, and blank outreach/discovery trackers. The PDF and copy identify synthetic artwork and preserve the repository's MIT license. Nothing in this section claims that outreach, signups, indexing, or launch submissions have happened.
