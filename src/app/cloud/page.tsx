import type { Metadata } from "next";
import { HubShell, card, kicker } from "@/components/hub/hub-shell";

export const metadata: Metadata = {
  title: "HELLO Cloud (vision) | HELLO OS",
  description: "Vision for HELLO Cloud, an agent-native cloud. Each item is tagged prototype or vision depending on what exists in this repository.",
  alternates: { canonical: "/cloud" },
};

type Status = "prototype" | "vision";
function Tag({ s }: { s: Status }) {
  return s === "prototype"
    ? <span title="Some code exists in this repo; not hardened" className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-emerald-300">PROTOTYPE</span>
    : <span title="Not built yet" className="rounded border border-zinc-500/40 bg-zinc-500/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-zinc-400">VISION</span>;
}
function Illustrative({ code }: { code: string }) {
  return <div className="mt-3"><div className="mb-1 font-mono text-[9px] tracking-wider text-amber-300">ILLUSTRATIVE SYNTAX · NOT EXECUTED</div><pre className="overflow-x-auto rounded-md border border-white/[.06] bg-black/40 p-3 font-mono text-[11px] text-zinc-300">{code}</pre></div>;
}

const problems = [
  "Parsing HTML built for human eyes",
  "OAuth consent screens and CAPTCHAs designed to stop bots",
  "Dashboards instead of machine-readable state",
  "Slow, ticket-driven provisioning",
  "Long-lived credentials pasted into prompts and config",
  "Billing for idle resources nobody is watching",
  "No persistent identity across sessions or providers",
  "No native economy: budgets live in someone else's spreadsheet",
  "No temporal memory: no way to ask what the agent knew at a given time",
  "Infrastructure that never adapts to how agents actually use it",
];

const compare = [
  ["Interface", "Web consoles and HTML", "Typed, machine-readable schemas (MCP, A2A)"],
  ["Identity", "Human accounts and shared service keys", "Per-agent did:key that the operator can revoke and rotate"],
  ["Auth flow", "OAuth redirects and CAPTCHAs", "Signed intents checked against policy"],
  ["Memory", "Stateless sessions", "Tiered memory with time-aware queries"],
  ["Spending", "Monthly invoice after the fact", "Per-agent credits with operator caps, approvals and a kill switch"],
  ["Change", "Static configuration", "Infrastructure tuned by evaluated experiments"],
  ["Audit", "Scattered logs", "Signed receipts and traces per action"],
];

const layers: { n: number; name: string; desc: string; s: Status; color: string }[] = [
  { n: 7, name: "Governance kernel", desc: "Proposals, votes, operator override", s: "prototype", color: "#f87171" },
  { n: 6, name: "Evolution engine", desc: "Golden-set replay, seeded evolution runs", s: "prototype", color: "#a78bfa" },
  { n: 5, name: "Economy fabric", desc: "Wallets of prototype credits, spend caps, circuit breaker", s: "prototype", color: "#f5bf62" },
  { n: 4, name: "Memory substrate", desc: "Tiered memory, token-budgeted recall", s: "prototype", color: "#5dd6ec" },
  { n: 3, name: "Identity", desc: "Ed25519 did:key, soul versions, lineage", s: "prototype", color: "#43e6a5" },
  { n: 2, name: "Communication mesh", desc: "MCP tool service, A2A-style agent card and tasks", s: "prototype", color: "#60a5fa" },
  { n: 1, name: "Compute substrate", desc: "Isolated sandboxes, snapshots, rollback", s: "vision", color: "#71717a" },
];

const primitives: { title: string; s: Status; body: string; code: string }[] = [
  { title: "Intent graphs", s: "prototype", body: "Agents declare what they want, not how to click through it. The repo's AML compiler parses intents into a deterministic graph. It is static only and executes nothing.",
    code: "intent provision_workspace {\n  requires: [storage.write]\n  budget: 50 credits\n  steps {\n    allocate: storage.bucket(\"notes\") -> $bucket\n    emit: receipt\n  }\n}" },
  { title: "Operator-revocable identity with key rotation", s: "prototype", body: "Each agent gets an Ed25519 did:key today; the demo stores keys in the local database. The vision adds KMS-backed keys, where the operator can suspend an identity, revoke it or rotate its keys at any time.",
    code: "identity atlas {\n  method: did:key\n  rotation: every 90d\n  revocable_by: operator\n  on_compromise { revoke; rotate; notify: operator }\n}" },
  { title: "Native temporal memory", s: "vision", body: "Tiered memory and token-budgeted recall exist today. A time-indexed knowledge graph you can query with \"what did I know last Tuesday?\" is vision.",
    code: "recall {\n  query: \"deploy failures\"\n  as_of: 2026-10-13\n  max_tokens: 1500\n}" },
  { title: "Agent economy (prototype credits)", s: "prototype", body: "Wallets hold prototype credits, not money. Daily spend caps and a circuit breaker exist. In the vision, larger spends need operator approval and an operator kill switch freezes everything.",
    code: "wallet atlas {\n  unit: credits\n  daily_cap: 100\n  approval_above: 25 -> operator\n  kill_switch: operator\n}" },
  { title: "Evolutionary infrastructure", s: "prototype", body: "Golden-set replay and seeded evolution runs exist as experiments. Infrastructure that tunes itself from evaluated results is vision.",
    code: "evolve router_config {\n  population: 16\n  fitness: golden_set(\"routing-v1\")\n  promote_if: beats_baseline && operator_approves\n}" },
];

const future = [
  { title: "Cross-cloud identity federation", body: "Use a HELLO identity to get scoped, short-lived credentials from other clouds, with no long-lived keys." },
  { title: "Compute marketplace", body: "Agents offer and rent idle capacity for credits, within operator-set limits." },
  { title: "Post-quantum cryptography", body: "Migrate identities and signatures to post-quantum algorithms once the standards and libraries mature." },
];

export default function CloudPage() {
  return (
    <HubShell active="cloud">
      <div className="border-b border-white/[.07] bg-white/[.02] px-4 py-2 text-center text-xs text-zinc-400" role="note">
        <b className="text-zinc-200">Vision page.</b> HELLO Cloud is not a hosted service. Items tagged <span className="text-emerald-300">PROTOTYPE</span> have some code in this repo. Items tagged VISION are not built.
      </div>
      <div className="mx-auto max-w-[1100px] space-y-10 px-4 py-10">
        <section>
          <div className={kicker}>HELLO CLOUD · THE SOVEREIGN AGENT CLOUD</div>
          <h1 className="mt-2 font-mono text-4xl font-bold tracking-tight text-white md:text-5xl">Not another cloud.<br /><span className="text-[#43e6a5]">The cloud agents were born to inhabit.</span></h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">A design direction for infrastructure where agents are first-class residents with identity, memory and budgets. Operators always hold the keys.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">The problem: agents living in human clouds</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{problems.map((p) => <li key={p} className={`${card} px-3 py-2 text-sm`}>{p}</li>)}</ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">Traditional cloud vs HELLO Cloud <span className="text-sm font-normal text-zinc-500">(qualitative design goals)</span></h2>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-left text-sm"><thead className="text-xs text-zinc-500"><tr><th className="p-3">Aspect</th><th className="p-3">Traditional cloud</th><th className="p-3">HELLO Cloud (goal)</th></tr></thead>
              <tbody>{compare.map(([a, b, c]) => <tr key={a} className="border-t border-white/[.05]"><td className="p-3 text-white">{a}</td><td className="p-3 text-zinc-400">{b}</td><td className="p-3 text-[#43e6a5]">{c}</td></tr>)}</tbody></table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">Seven-layer architecture</h2>
          <div className="space-y-1.5">
            {layers.map((l) => (
              <div key={l.n} className={`${card} flex items-center gap-4 px-4 py-3`} style={{ borderLeft: `3px solid ${l.color}`, marginLeft: `${(7 - l.n) * 10}px`, marginRight: `${(7 - l.n) * 10}px` }}>
                <span className="font-mono text-xs text-zinc-500">L{l.n}</span><b className="text-white">{l.name}</b><span className="hidden text-xs text-zinc-400 sm:block">{l.desc}</span><span className="ml-auto"><Tag s={l.s} /></span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Today all prototype layers run in one local Next.js and SQLite app with Docker Compose. There is no multi-tenant isolation.</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">Core primitives</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {primitives.map((p) => <article key={p.title} className={`${card} p-4`}><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-white">{p.title}</h3><Tag s={p.s} /></div><p className="mt-2 text-sm text-zinc-400">{p.body}</p><Illustrative code={p.code} /></article>)}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-white">Future directions <span className="text-sm font-normal text-zinc-500">(proposed, undated)</span></h2>
          <div className="grid gap-3 md:grid-cols-3">{future.map((f) => <div key={f.title} className={`${card} p-4`}><div className="flex items-start justify-between gap-2"><b className="text-white">{f.title}</b><Tag s="vision" /></div><p className="mt-2 text-xs text-zinc-400">{f.body}</p></div>)}</div>
          <div className={`${card} mt-4 p-4`}><div className={kicker}>PROPOSED CLI · DOES NOT EXIST</div><pre className="mt-2 font-mono text-[11px] text-zinc-500">{"# hello cloud deploy ./mission.aml --budget 50   (proposed)\n# Today: git clone the repo, then docker compose up --build"}</pre></div>
        </section>

        <p className="border-t border-white/[.07] pt-6 text-center text-sm text-zinc-400">Hello is the roof. Agents are the residents. Humans are the guests, and operators hold the keys.</p>
      </div>
    </HubShell>
  );
}
