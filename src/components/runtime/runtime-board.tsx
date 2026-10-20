"use client";

import * as React from "react";
import Link from "next/link";
import { Brain, Clock, Database, GitFork, History, Network, ShieldCheck, Bug, Vote, Wallet, Box, type LucideIcon } from "lucide-react";

type Probe = { status: number | null; body: unknown };
type Pillar = {
  n: number; title: string; icon: LucideIcon; what: string;
  endpoint?: string; ui?: string; pr?: string;
  summarize?: (b: unknown) => string[];
  partial?: string; // related code that exists but is not the full feature
};

const PILLARS: Pillar[] = [
  { n: 1, title: "Heartbeat / cron scheduler", icon: Clock, what: "Interval jobs triggered by ticks from cron or CI, with run history.", endpoint: "/api/scheduler/jobs", ui: "/ops/scheduler", pr: "#6",
    summarize: (b: any) => { const jobs = b.jobs ?? []; const next = jobs.filter((j: any) => j.enabled).map((j: any) => new Date(j.nextRunAt).getTime()).sort()[0]; return [`${jobs.length} job(s) configured`, next ? `next due ${new Date(next).toLocaleTimeString()}` : "no enabled jobs"]; } },
  { n: 2, title: "Delegation tree", icon: GitFork, what: "Parents fund sub-agents with hard credit caps; recall returns unspent credits.", endpoint: "/api/delegation", ui: "/ops/delegation", pr: "#6",
    summarize: (b: any) => { const count = (n: any): number => 1 + (n.children ?? []).reduce((s: number, c: any) => s + count(c), 0); const t = (b.trees ?? []).filter(Boolean); return [`${t.length} root agent(s)`, `${t.reduce((s: number, x: any) => s + count(x) - 1, 0)} sub-agent(s)`]; } },
  { n: 3, title: "Permission-scoped second brain", icon: Brain, what: "Shared knowledge index with role-based access, so agents inherit only what they may see.", endpoint: "/api/knowledge", ui: "/ops/knowledge", pr: "#12",
    summarize: (b: any) => [`${(b.docs ?? []).length} document(s)`, `${(b.assignments ?? []).length} role assignment(s)`] },
  { n: 4, title: "Approval & reversibility gate", icon: ShieldCheck, what: "Risk-tiered gate on spends and installs, operator kill switch, audit log.", endpoint: "/api/operator", ui: "/ops/approvals", pr: "#5",
    summarize: (b: any) => [`kill switch ${b.control?.killSwitch ? "ON" : "off"}`, `approval above ${b.control?.approvalThreshold} credits`, b.devMode ? "dev mode: no operator token set" : "operator token required"] },
  { n: 5, title: "Wasm code sandbox", icon: Box, what: "Run agent-written snippets in a sandbox with time and memory limits.", endpoint: "/api/sandbox", ui: "/ops/sandbox", pr: "#14",
    summarize: (b: any) => [String(b.engine ?? ""), `limits ${b.limits?.defaultTimeoutMs} ms / ${Math.round((b.limits?.defaultMemoryBytes ?? 0) / 1048576)} MB default`, `exposed: ${(b.exposed ?? []).join(", ")}`] },
  { n: 6, title: "Semantic cache", icon: Database, what: "Reuse answers for near-duplicate prompts. The hit rate shown is measured from logged lookups.", endpoint: "/api/cache", ui: "/ops/cache", pr: "#12",
    summarize: (b: any) => [`${b.entries} entries · ${b.lookups} lookups`, b.measuredHitRate === null ? "measured hit rate: n/a (no lookups yet)" : `measured hit rate: ${(b.measuredHitRate * 100).toFixed(1)}%`] },
  { n: 7, title: "Consensus & debate protocol", icon: Vote, what: "Agents with opposing priorities argue a change, then vote weighted by reputation.", endpoint: "/api/consensus", ui: "/ops/consensus", pr: "#13",
    summarize: (b: any) => { const d = b.debates ?? []; return [`${d.length} debate(s)`, `${d.filter((x: any) => x.status === "open").length} open`]; } },
  { n: 8, title: "Checkpoint & resume", icon: History, what: "Serialize an agent's task state to a sealed JSON snapshot and resume it.", endpoint: "/api/snapshots", ui: "/ops/snapshots", pr: "#11",
    summarize: (b: any) => { const s = b.snapshots ?? []; return [`${s.length} snapshot(s)`, `${s.filter((x: any) => x.resumedAt).length} resumed`]; } },
  { n: 9, title: "Failure library & auto-debug loop", icon: Bug, what: "Build and test failures in a dead-end registry agents consult before retrying.", endpoint: "/api/failures", ui: "/ops/failures", pr: "#11",
    summarize: (b: any) => [`${(b.failures ?? []).length} failure signature(s)`, `${b.deadEnds ?? 0} dead end(s) without a fix`] },
  { n: 10, title: "Treasury reallocation", icon: Wallet, what: "Move prototype credits between agents through the approval gate and wallet caps.", endpoint: "/api/treasury", ui: "/ops/treasury", pr: "#13",
    summarize: (b: any) => [`${(b.moves ?? []).filter((m: any) => m.type === "debit").length} recent move(s)`, `${b.pending ?? 0} awaiting approval`] },
];

function StatusTag({ p, pillar }: { p?: Probe; pillar: Pillar }) {
  const base = "rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wider";
  if (!pillar.endpoint) return <span className={`${base} border-zinc-500/40 bg-zinc-500/10 text-zinc-400`}>NOT BUILT YET</span>;
  if (!p) return <span className={`${base} border-white/10 text-zinc-500`}>CHECKING…</span>;
  if (p.status === 200) return <span className={`${base} ${pillar.partial ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>{pillar.partial ? "PARTIAL · API RESPONDS" : "PROTOTYPE · API RESPONDS"}</span>;
  if (p.status === 404) return <span className={`${base} border-zinc-500/40 bg-zinc-500/10 text-zinc-400`}>NOT IN THIS BUILD{pillar.pr ? ` · PR ${pillar.pr}` : ""}</span>;
  return <span className={`${base} border-red-400/30 bg-red-400/10 text-red-300`}>{p.status === null ? "UNREACHABLE" : `HTTP ${p.status}`}</span>;
}

export function RuntimeBoard() {
  const [probes, setProbes] = React.useState<Record<number, Probe>>({});
  const [at, setAt] = React.useState("");
  const check = React.useCallback(async () => {
    const res = await Promise.all(PILLARS.filter((p) => p.endpoint).map(async (p) => {
      try { const r = await fetch(p.endpoint!, { cache: "no-store" }); return [p.n, { status: r.status, body: r.ok ? await r.json() : null }] as const; }
      catch { return [p.n, { status: null, body: null }] as const; }
    }));
    setProbes(Object.fromEntries(res)); setAt(new Date().toLocaleTimeString());
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void check(); }, 0); return () => window.clearTimeout(t); }, [check]);

  const live = PILLARS.filter((p) => probes[p.n]?.status === 200 && !p.partial).length;
  return (
    <div className="min-h-screen bg-void text-zinc-300">
      <header className="border-b border-white/[.07] px-4 py-3"><div className="mx-auto flex max-w-6xl items-center gap-3 font-mono text-xs"><Link href="/" className="text-zinc-400 hover:text-white">mission control</Link><span className="text-zinc-600">/</span><span className="text-white">runtime</span><Link href="/frontier" className="ml-auto text-zinc-400 hover:text-white">frontier lab →</Link></div></header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="font-mono text-[10px] tracking-[.18em] text-zinc-500">§ RUNTIME · 10 PILLARS</div>
        <h1 className="mt-2 text-3xl font-bold text-white">Enterprise runtime: what&apos;s built, what isn&apos;t</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">Status below comes from live requests to this instance{at ? ` (checked ${at})` : ""}. {live} of 10 pillars have a responding prototype API here. A responding API means a working prototype, not production readiness. Credits are prototype credits, not money.</p>
        <button onClick={check} className="mt-3 rounded-md border border-white/10 px-3 py-1.5 font-mono text-xs hover:bg-white/5">Re-check</button>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {PILLARS.map((p) => {
            const Icon = p.icon; const pr = probes[p.n];
            const lines = pr?.status === 200 && p.summarize ? (() => { try { return p.summarize!(pr.body); } catch { return []; } })() : [];
            return (
              <article key={p.n} className="rounded-xl border border-white/[.07] bg-[#0f1019]/80 p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/30"><Icon size={17} className="text-zinc-300" /></span>
                  <div className="min-w-0 flex-1"><div className="font-mono text-[11px] font-semibold text-white">{String(p.n).padStart(2, "0")} · {p.title}</div><p className="mt-1 text-xs text-zinc-400">{p.what}</p></div>
                  <StatusTag p={pr} pillar={p} />
                </div>
                {lines.length > 0 && <ul className="mt-3 space-y-0.5 rounded-md border border-white/[.06] bg-black/30 p-2 font-mono text-[11px] text-zinc-300">{lines.map((l) => <li key={l}>› {l}</li>)}</ul>}
                {p.partial && pr?.status === 200 && <p className="mt-2 text-[11px] text-amber-200/80">{p.partial}</p>}
                <div className="mt-3 flex gap-3 font-mono text-[10px] text-zinc-500">{p.endpoint && <span>{p.endpoint}</span>}{p.ui && pr?.status === 200 && <Link className="text-[#43e6a5] underline" href={p.ui}>open panel</Link>}</div>
              </article>
            );
          })}
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-zinc-500"><Network size={13} /> Longer-range, not-yet-possible ideas live in the <Link href="/frontier" className="text-[#43e6a5] underline">Frontier Lab</Link>.</p>
      </main>
    </div>
  );
}
