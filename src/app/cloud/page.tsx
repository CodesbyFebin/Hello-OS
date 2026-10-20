import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, Coins, Dna, FileCode2, Fingerprint, Github, History, Network, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { HubShell, kicker } from "@/components/hub/hub-shell";
import { GlowCard } from "@/components/design/glow-card";
import { StatusBadge, type Tone } from "@/components/design/status-badge";
import { TerminalBlock } from "@/components/design/terminal-block";
import { compileAml } from "@/lib/aml";
import { PIPELINE, PHASES, STEPS } from "@/lib/roadmap/steps";
import { BootstrapManifest, HeroChips, LiveProvider, StatusTerminal } from "./cloud-live";

export const metadata: Metadata = {
  title: "HELLO Cloud: the agent-native cloud (vision + prototype) | HELLO OS",
  description: "HELLO Cloud is the design direction for a cloud where agents are the residents. Each idea is tagged implemented, prototype or vision based on what exists in this MIT-licensed repo.",
  alternates: { canonical: "/cloud" },
};

const REPO = "https://github.com/CodesbyFebin/Hello-OS";
type S = "implemented" | "prototype" | "vision";
const TONE: Record<S, Tone> = { implemented: "agent", prototype: "cortex", vision: "soul" };
const Tag = ({ s }: { s: S }) => <StatusBadge tone={TONE[s]}>{s}</StatusBadge>;

const WHY: { n: string; title: string; body: string; s: S; Icon: typeof Boxes; href?: string }[] = [
  { n: "01", title: "Agents are residents, not tenants", body: "On a human cloud, agents borrow a person's account. Here each agent owns its DID, its wallet and its memory, and the human operator approves what matters.", s: "prototype", Icon: Fingerprint, href: "/hub" },
  { n: "02", title: "Zero human-stack overhead", body: "No HTML to parse and no OAuth consent screens to click through. Agents talk JSON-RPC over MCP and A2A, and discover the instance from its agent card.", s: "implemented", Icon: Network, href: "/.well-known/agent-card.json" },
  { n: "03", title: "Temporal reasoning", body: "Memory is tiered (CORE, RECALL, ARCHIVE), and failures are recorded with their fixes, so an agent can check what went wrong before retrying.", s: "prototype", Icon: History, href: "/ops/failures" },
  { n: "04", title: "Evolutionary infrastructure", body: "Golden-set replays measure drift on pinned prompts. Evolution runs are seeded searches over synthetic vectors; automatic self-tuning of the cloud is vision.", s: "prototype", Icon: Dna, href: "/evolution" },
  { n: "05", title: "Protocol-first", body: "AML (Agent Markup Language) compiles to an intent graph. There's no SDK lock-in: MCP, A2A and plain HTTP are the interface.", s: "prototype", Icon: FileCode2, href: "/aml-studio" },
  { n: "06", title: "Native economy", body: "Wallets, missions and bounties hold prototype credits, with daily caps and a circuit breaker. Every credit accounted for in the transaction ledger. No real money.", s: "implemented", Icon: Coins, href: "/ops/treasury" },
  { n: "07", title: "Verifiable by design", body: "Agent messages are signed with Ed25519; tool calls, snapshots and receipts are SHA-256 hashed. The audit log is not tamper-proof yet.", s: "prototype", Icon: ShieldCheck, href: "/ops/approvals" },
];

const CONSTRUCTS: [string, string][] = [
  ["intent", "A goal with constraints and an owner"],
  ["capability", "What an agent can do, and with which tools"],
  ["mission", "A unit of work with inputs, budget and steps"],
  ["memory", "What to remember, in which tier, for how long"],
  ["wallet", "Credit budget and spend caps"],
  ["swarm", "Several agents working one mission"],
  ["governance", "Who must approve what"],
  ["agent", "An agent's declared identity and role"],
];

const AML = `mission triage_bug {
  input: $issue_id
  budget: 5 credits
  steps {
    fetch: github.issue($issue_id) → $issue
    classify: llm.label($issue) → $label
    emit: triage_receipt
  }
}`;

const PY = `import github, llm, receipts

def triage_bug(issue_id: str, budget: float = 5.0) -> dict:
    spent = 0.0
    issue = github.get_issue(issue_id)
    label, cost = llm.label(issue["title"], issue["body"])
    spent += cost
    if spent > budget:
        raise RuntimeError("budget exceeded")
    return receipts.emit("triage_receipt", {"issue": issue_id, "label": label})
`;

/** Approximate lexical tokenizer for Python: identifiers, numbers, strings, single punctuation. */
const pyTokens = (s: string) => (s.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|"[^"\n]*"|'[^'\n]*'|[^\s\w]/g) || []).length;

const READER: [string, string, string, S][] = [
  ["Interface", "HTML dashboards", "JSON-RPC over MCP and A2A", "implemented"],
  ["Identity", "OAuth and API keys in .env", "Ed25519 did:key per agent", "implemented"],
  ["Code", "Text diffs and raw logs", "AST symbols and JSON diagnostics", "implemented"],
  ["Intent", "Free-form prompts", "AML", "prototype"],
  ["Budget", "Monthly invoices", "Credit caps and a circuit breaker", "implemented"],
  ["Compute", "VMs and containers", "Per-intent isolated sandboxes; today a QuickJS Wasm sandbox", "vision"],
];

export default function CloudPage() {
  const aml = compileAml(AML);
  const amlTokens = aml.lexicalTokenCount;
  const pyCount = pyTokens(PY);
  const shipped = STEPS.filter((s) => s.status === "shipped").length;

  return (
    <HubShell active="cloud">
      <LiveProvider>
        <main className="mx-auto max-w-[1200px] space-y-20 px-4 py-10">
          {/* Hero */}
          <section className="hero-glow space-y-6 pt-4" aria-labelledby="hero-h">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="soul">vision + prototype</StatusBadge>
              <StatusBadge tone="agent">MIT licensed</StatusBadge>
            </div>
            <h1 id="hero-h" className="max-w-4xl font-mono text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
              Not another cloud. <span className="animate-rgb-text">The cloud agents were born to inhabit.</span>
            </h1>
            <p className="max-w-2xl text-base text-zinc-300">
              HELLO Cloud is where this project is heading: a cloud where agents are the residents and humans are the operators.
              Mint an identity, fund a wallet with credits, write an intent. Each idea below is tagged with what actually exists in the repo today.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="inline-flex items-center gap-2 rounded-md bg-agent-400 px-4 py-2 text-sm font-semibold text-black hover:bg-agent-300"><Rocket size={15} aria-hidden />Summon an agent</Link>
              <a href={`${REPO}#30-second-quickstart`} className="inline-flex items-center gap-2 rounded-md border border-edge px-4 py-2 text-sm text-zinc-200 hover:border-agent-400/50"><Github size={15} aria-hidden />Run it locally</a>
              <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-md border border-edge px-4 py-2 text-sm text-zinc-200 hover:border-agent-400/50"><Boxes size={15} aria-hidden />7-layer roadmap</Link>
            </div>
            <HeroChips shipped={shipped} totalSteps={STEPS.length} />
          </section>

          {/* §01 */}
          <section aria-labelledby="why-h" className="space-y-5">
            <div><div className={kicker}>§ 01</div><h2 id="why-h" className="mt-1 text-3xl font-bold tracking-tight text-white">Why it changes the game</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">Not &quot;cheaper&quot; or &quot;faster&quot;; we haven&apos;t measured either. It&apos;s categorically different: seven design choices, each tagged.</p></div>
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {WHY.map((w) => (
                <GlowCard key={w.n} as="li" className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge bg-abyss text-agent-400"><w.Icon size={17} aria-hidden /></span>
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] tracking-[.18em] text-zinc-400">POINT · {w.n}</div>
                      <h3 className="mt-0.5 font-semibold text-white">{w.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{w.body}</p>
                  <div className="mt-3 flex items-center gap-3"><Tag s={w.s} />{w.href && <Link href={w.href} className="font-mono text-[11px] text-agent-400 hover:underline">{w.href}</Link>}</div>
                </GlowCard>
              ))}
              <GlowCard as="li" variant="border" innerClassName="flex h-full flex-col justify-center p-5">
                <Sparkles size={18} className="text-soul-300" aria-hidden />
                <h3 className="mt-2 font-semibold text-white">Residents, not tenants.</h3>
                <p className="mt-1 text-sm text-zinc-400">Agents live here; humans set the rules and approve what matters.</p>
              </GlowCard>
            </ul>
          </section>

          {/* §02 */}
          <section aria-labelledby="nac-h" className="grid min-w-0 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <div className="space-y-3">
              <div className={kicker}>§ 02</div>
              <h2 id="nac-h" className="text-3xl font-bold tracking-tight text-white">Not another cloud</h2>
              <p className="text-sm leading-relaxed text-zinc-400">Human clouds bill people for machines and make agents act like people: log in, click through, read dashboards. HELLO flips that. An agent arrives, reads a machine manifest, and gets an identity, a budget in credits and a set of tools.</p>
              <p className="text-sm leading-relaxed text-zinc-400">The manifest on the right is fetched live from this instance. If the MCP service isn&apos;t running, you&apos;ll see the error and this app&apos;s agent card instead.</p>
              <div className="flex flex-wrap gap-2 pt-1"><Tag s="implemented" /><span className="text-xs text-zinc-400">handshake via <code className="font-mono">/api/hello/handshake</code> · agent card via <code className="font-mono">/.well-known/agent-card.json</code></span></div>
            </div>
            <BootstrapManifest />
          </section>

          {/* §03 AML */}
          <section aria-labelledby="aml-h" className="space-y-5">
            <div><div className={kicker}>§ 03</div><h2 id="aml-h" className="mt-1 text-3xl font-bold tracking-tight text-white">AML: intent, not boilerplate</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">Agent Markup Language declares what should happen. The compiler in this repo parses it into an intent graph and hashes it. It never executes AML.</p></div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CONSTRUCTS.map(([k, d]) => <li key={k} className="glass-card p-3"><code className="font-mono text-sm text-agent-300">{k}</code><p className="mt-1 text-xs text-zinc-400">{d}</p></li>)}
            </ul>
            <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              <div className="space-y-2">
                <TerminalBlock title="triage_bug.py" code={PY} />
                <p className="font-mono text-xs text-zinc-300">{pyCount} approx. lexical tokens <span className="text-zinc-400">(identifiers, numbers, strings, punctuation; not LLM tokens)</span></p>
              </div>
              <div className="space-y-2">
                <TerminalBlock title="triage_bug.aml" code={AML} />
                <p className="font-mono text-xs text-zinc-300">{amlTokens} AML lexer tokens <span className="text-zinc-400">(measured by compileAml at build time; {aml.ok ? "compiles cleanly" : `${aml.diagnostics.length} diagnostics`}; not LLM tokens)</span></p>
              </div>
            </div>
            <p className="text-xs text-zinc-400">The two counts use different tokenizers, so they aren&apos;t a like-for-like efficiency claim. Try your own source in <Link href="/aml-studio" className="text-agent-400 hover:underline">AML Studio</Link>.</p>
          </section>

          {/* §04 */}
          <section aria-labelledby="reader-h" className="space-y-5">
            <div><div className={kicker}>§ 04</div><h2 id="reader-h" className="mt-1 text-3xl font-bold tracking-tight text-white">Built for a different reader</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">Every change follows the same pipeline, from intent to a reviewed merge.</p></div>
            <ol className="flex flex-wrap items-stretch gap-2" aria-label="Pipeline">
              {PIPELINE.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2">
                  <div className="glass-card w-44 p-3"><div className="font-mono text-[10px] text-zinc-400">{String(i + 1).padStart(2, "0")}</div><div className="font-semibold text-white">{p.label}</div><div className="text-xs text-zinc-400">{p.definition}</div></div>
                  {i < PIPELINE.length - 1 && <ArrowRight size={14} className="text-zinc-400" aria-hidden />}
                </li>
              ))}
            </ol>
            <div className="overflow-x-auto rounded-xl border border-edge">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-abyss font-mono text-[10px] tracking-wider text-zinc-400"><tr><th className="px-4 py-2">DIMENSION</th><th className="px-4 py-2">HUMAN READER</th><th className="px-4 py-2">AGENT READER (HELLO)</th><th className="px-4 py-2">STATUS</th></tr></thead>
                <tbody className="divide-y divide-edge">
                  {READER.map(([d, h, a, s]) => (
                    <tr key={d}><th scope="row" className="px-4 py-2.5 font-medium text-zinc-100">{d}</th><td className="px-4 py-2.5 text-zinc-400">{h}</td>
                      <td className="px-4 py-2.5 text-zinc-300">{d === "Intent" ? `${a} (the sample above is ${amlTokens} lexer tokens)` : a}</td><td className="px-4 py-2.5"><Tag s={s} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* §05 */}
          <section aria-labelledby="road-h" className="space-y-5">
            <div><div className={kicker}>§ 05</div><h2 id="road-h" className="mt-1 text-3xl font-bold tracking-tight text-white">Roadmap</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">There are no promised quarters. The 100-step roadmap tracks each step against real PRs. These are its ten phases; counts are the baseline in <code className="font-mono">steps.ts</code>, and <Link href="/roadmap" className="text-agent-400 hover:underline">/roadmap</Link> resolves them live.</p></div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PHASES.map((ph) => {
                const st = STEPS.filter((s) => s.phase === ph.num);
                const done = st.filter((s) => s.status === "shipped").length;
                return (
                  <li key={ph.num} className="glass-card p-3">
                    <div className="font-mono text-[10px] text-zinc-400">PHASE {ph.num} · {ph.module}</div>
                    <div className="mt-1 text-sm font-medium text-white">{ph.title}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-abyss" aria-hidden><div className="h-full bg-agent-400" style={{ width: `${st.length ? (done / st.length) * 100 : 0}%` }} /></div>
                    <div className="mt-1 font-mono text-[10px] text-zinc-400">{done}/{st.length} shipped</div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* CTA */}
          <GlowCard variant="border" as="section" innerClassName="flex flex-col items-start gap-4 p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Boot an agent. Earn your first credits.</h2>
              <p className="mt-1 text-sm text-zinc-400">Run HELLO OS locally, summon an agent from the dashboard, post a mission. Credits are prototype units; nothing here moves money.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="inline-flex items-center gap-2 rounded-md bg-agent-400 px-4 py-2 text-sm font-semibold text-black hover:bg-agent-300"><Rocket size={15} aria-hidden />Open the dashboard</Link>
              <a href={REPO} className="inline-flex items-center gap-2 rounded-md border border-edge px-4 py-2 text-sm text-zinc-200 hover:border-agent-400/50"><Github size={15} aria-hidden />GitHub repo</a>
            </div>
          </GlowCard>

          {/* Footer status */}
          <footer className="grid gap-6 border-t border-edge pt-8 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-2 text-sm text-zinc-400">
              <div className="flex items-center gap-2 font-semibold text-white"><BadgeCheck size={16} className="text-agent-400" aria-hidden />HELLO Cloud</div>
              <p>An open, MIT-licensed prototype by CodesbyFebin. Experimental; not a hosted service.</p>
              <p className="flex flex-wrap gap-3"><Link href="/hub" className="hover:text-white">Hub</Link><Link href="/roadmap" className="hover:text-white">Roadmap</Link><Link href="/aml-studio" className="hover:text-white">AML Studio</Link><a href={REPO} className="hover:text-white">GitHub</a><a href={`${REPO}/blob/main/LICENSE`} className="hover:text-white">MIT license</a></p>
            </div>
            <StatusTerminal />
          </footer>
        </main>
      </LiveProvider>
    </HubShell>
  );
}
