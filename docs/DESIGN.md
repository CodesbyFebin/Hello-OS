# HELLO OS Design System — contributor guide

This guide describes how HELLO OS pages should look and what they may claim.
The canonical tokens live in `src/app/globals.css` (`--hello-*` variables exposed
through the Tailwind v4 `@theme inline` block). The live reference is the
`/design` route. If this document and `globals.css` disagree, `globals.css` wins.

## 1. Two surfaces

| Surface | Where | Look |
|---|---|---|
| **Marketing** | landing (`src/app/page.tsx`), launch and docs-index pages | Lime/green accent (`agent-400`, `#00ff9d`) on near-black (`void`, `abyss`). Big type, few accents. |
| **Product** | dashboard, compiler workbench, cloud, any page that shows app data | Deep-violet base (`soul` for identity and primary actions) with one **domain accent** per area (cognition, economy, society, evolution). |

Rule of thumb: one accent family per section. Don't mix domain accents in one card.

## 2. Tokens

### Canonical tokens (from PR #23, unchanged)

| Token | Hex | Use |
|---|---|---|
| `void` | `#05060a` | Page background |
| `abyss` | `#090b12` | Section background |
| `panel` | `#0e111b` | Cards, panels |
| `edge` | `#1a2030` | Borders, dividers |
| `agent-300/400/500` | `#33ffbb / #00ff9d / #00d985` | Agents, success, marketing accent |
| `soul-300/400/500` | `#b49cff / #9775fa / #7c3aed` | Identity, primary actions |
| `cortex-300/400/500` | `#67e8f9 / #22d3ee / #06b6d4` | Memory, reasoning, info |
| `ember-400/500` | `#fbbf24 / #f59e0b` | Credits, warnings, caps |
| `blood-400/500` | `#f87171 / #ef4444` | Errors, kill switch, destructive |

### Domain aliases

Aliases are names only. Each one points (`var()`) at a canonical token and adds no
new color. They behave like any Tailwind v4 color, including opacity variants
(`bg-cognition/10`, `border-society/40`, `text-economy`).

| Alias | Canonical | Hex | Domain |
|---|---|---|---|
| `soul` | `soul-400` | `#9775fa` | Identity (Ed25519 / did:key), primary actions |
| `cognition` (`-300/-400/-500`) | `cortex-*` | `#22d3ee` | Memory, reasoning, AML compiler |
| `economy` (`-400/-500`) | `ember-*` | `#fbbf24` | Credits (H), operator caps, budgets |
| `society` (`-300/-400/-500`) | `agent-*` | `#00ff9d` | Agents, commons, consensus |
| `evolution` (`-300/-400/-500`) | `soul-*` (default `soul-300`) | `#b49cff` | Evolution lab, mutations |
| `void` | `void` | `#05060a` | Already canonical |

Notes on the mapping:

- The guide's draft called soul "ember". The palette from #23 was kept, so **soul stays violet** and ember is the economy color.
- The draft's violet "cognition" maps to cyan `cortex`. That keeps it from clashing with violet soul.
- No magenta token exists, so `evolution` uses the lightest violet (`soul-300`). To get a real magenta, add a new canonical `--hello-*` token in a separate change and re-point the alias.
- Use `soul-500` / `evolution-500` only for fills and large text. It fails AA for body text on `void`/`panel` (see `/design`).

## 3. Type and layout

- **Fonts**: Inter (UI) and JetBrains Mono (code, ids, hashes, numbers). Both are self-hosted via `@fontsource-variable`, with no CDNs.
- **Scale**: page title `text-3xl`–`text-5xl font-semibold`; section `text-lg font-semibold`; body `text-sm text-zinc-300`; meta `text-xs text-zinc-400`. `zinc-500`/`zinc-600` are for decoration only, never for text you need to read.
- **Layout**: `max-w-6xl mx-auto px-4`, sections `space-y-3`, grids `gap-4 md:grid-cols-2 lg:grid-cols-3`. Pages must not scroll horizontally at 360px wide.
- **Surfaces**: `glass-card` / `bg-panel border border-edge rounded-xl`. Use the matrix grid and glow effects sparingly, and they must respect `prefers-reduced-motion`.

## 4. Templates

**Landing (marketing).** Hero has a one-line value statement, an honest status line ("prototype"), and two CTAs (Docs, GitHub). Then: what works today, then what's in progress / vision (labelled), then a footer with the MIT license.

**Dashboard (product).** HubShell, then a header with a soul accent and the data source shown. Cards per domain use their alias accent (`border-society/40` …). Every number must come from the API (`/api/...` or `GET /api/sync`). Empty states say "no data yet", not a placeholder number.

**Compiler workbench.** Two panes: AML source on the left, validator output on the right in a terminal panel, in the cognition accent. Label it "validator — does not execute code".

**Docs page.** Breadcrumb, title, then a "Status: implemented | prototype | vision" badge, then content, then links to the real route or file. Code uses JetBrains Mono.

**Terminal panel.**

```tsx
<TerminalBlock title="example: compile AML (illustrative output)" code={sample} />
```

If the output is not from a real run, the title must say "illustrative".

## 5. Accessibility

- Text must meet WCAG AA (4.5:1, or 3:1 for large text) on `void` and `panel`. This is checked by `tests/design.test.mjs` and shown on `/design`.
- Don't use color alone to carry meaning. Pair it with a text label or an icon (`StatusBadge` does this).
- Keep a visible focus ring, use semantic headings, add `aria-labelledby` on sections, and give icons alt text.
- Animations respect `prefers-reduced-motion`.
- Never render user content through `innerHTML` / `dangerouslySetInnerHTML`.

## 6. Provenance and honesty

- **No hard-coded live badges.** "Live", "online" or counts appear only when they're backed by a real data source. The demo badge appears only when seed data exists.
- **Simulation banner.** Any simulated view (economy, consensus, evolution runs) shows a visible "Simulation" banner.
- **Label maturity.** Every feature is marked *implemented*, *prototype* or *vision*.
- **No unmeasured numbers.** No latency, uptime, savings or benchmark figures unless a test or script in the repo produces them, with a link to it.
- **Money language.** Use credits (H) only. Show operator caps, approvals and the kill switch where spending appears. Never show currency or token symbols.
- **Status wording.** HELLO OS is a prototype. Don't use "production ready" or version-launch claims.
- **License** is MIT.
- **Identity.** Agent identities are operator-revocable. Say so where identity is shown.
- **No fake social proof.** No invented stars, testimonials, user counts or checksums.
