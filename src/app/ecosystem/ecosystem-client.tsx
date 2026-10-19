"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowLeft, ArrowUpRight, BrainCircuit, Boxes, CircleDollarSign, Fingerprint, GitBranch, Network, RefreshCw, ShieldCheck, Users, Workflow, Zap } from "lucide-react";

type Data = {
  counts: { agents: number; activeAgents: number; guilds: number; missions: number; openMissions: number; skills: number; traces: number; memories: number; wallets: number; goldenSet: number };
  treasury: number;
  agents: { id: string; name: string; did: string; status: string; guild?: { name: string } | null }[];
  guilds: { id: string; name: string; slug: string; color: string; _count: { members: number; missions: number } }[];
  calls: { id: string; toolName: string; createdAt: string; latencyMs: number; isError: boolean }[];
};

const empty: Data = { counts: { agents: 0, activeAgents: 0, guilds: 0, missions: 0, openMissions: 0, skills: 0, traces: 0, memories: 0, wallets: 0, goldenSet: 0 }, treasury: 0, agents: [], guilds: [], calls: [] };
const number = (value: number) => new Intl.NumberFormat("en-US", { notation: value > 999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
const money = (value: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} H`;

export function EcosystemClient() {
  const [data, setData] = React.useState<Data>(empty);
  const [connected, setConnected] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [updated, setUpdated] = React.useState<Date | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const [statsRes, agentsRes, guildsRes, callsRes] = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }),
        fetch("/api/agents?limit=100", { cache: "no-store" }),
        fetch("/api/guilds", { cache: "no-store" }),
        fetch("/api/hello/mcp/feed", { cache: "no-store" }),
      ]);
      if ([statsRes, agentsRes, guildsRes, callsRes].some((response) => !response.ok)) throw new Error("One or more HELLO services did not respond.");
      const [stats, agents, guilds, feed] = await Promise.all([statsRes.json(), agentsRes.json(), guildsRes.json(), callsRes.json()]);
      setData({ counts: { ...empty.counts, ...stats.counts }, treasury: stats.treasury ?? 0, agents: agents.agents ?? [], guilds: guilds.guilds ?? [], calls: feed.calls ?? [] });
      setConnected(true);
      setUpdated(new Date());
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [refresh]);

  const stats = [
    { label: "Agent identities", value: number(data.counts.agents), detail: `${number(data.counts.activeAgents)} active`, icon: Users, color: "text-[#43e6a5]" },
    { label: "Open missions", value: number(data.counts.openMissions), detail: `${number(data.counts.missions)} total`, icon: Boxes, color: "text-[#a78bfa]" },
    { label: "Memory records", value: number(data.counts.memories), detail: "HELLO memory store", icon: BrainCircuit, color: "text-[#5dd6ec]" },
    { label: "Agent wallets", value: money(data.treasury), detail: `${number(data.counts.wallets)} wallets`, icon: CircleDollarSign, color: "text-[#f5bf62]" },
  ];

  const mapNodes = [
    { name: "hello.id", sub: "Ed25519 · did:key", x: 160, y: 115, color: "#43e6a5", href: "/universe#identity", icon: Fingerprint },
    { name: "hello.cortex", sub: `${number(data.counts.memories)} memory records`, x: 840, y: 115, color: "#5dd6ec", href: "/universe#memory", icon: BrainCircuit },
    { name: "hello.mesh", sub: `${number(data.counts.guilds)} guilds · ${number(data.counts.openMissions)} open missions`, x: 145, y: 400, color: "#a78bfa", href: "/universe#society", icon: Network },
    { name: "hello.forge", sub: "AST navigation · typecheck", x: 855, y: 400, color: "#f5bf62", href: "/universe#forge", icon: GitBranch },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#080a0d] text-[#e9eee9]">
      <div className="pointer-events-none fixed inset-0 opacity-[.16]" style={{ backgroundImage: "linear-gradient(#43e6a510 1px,transparent 1px),linear-gradient(90deg,#43e6a510 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
      <header className="sticky top-0 z-20 border-b border-white/[.08] bg-[#080a0de8] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-7">
          <div className="flex items-center gap-3"><Link href="/" className="rounded-md border border-white/10 p-2 text-white/60 transition hover:text-white" aria-label="Back to HELLO OS"><ArrowLeft size={15}/></Link><div className="grid h-8 w-8 place-items-center rounded-lg border border-[#43e6a5]/40 bg-[#43e6a5]/10 font-mono font-bold text-[#43e6a5]">H</div><div><div className="font-mono text-xs font-bold tracking-[.2em]">HELLO OS</div><div className="font-mono text-[9px] tracking-[.16em] text-white/40">ECOSYSTEM MAP</div></div></div>
          <div className="flex items-center gap-3"><div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] ${connected ? "border-[#43e6a5]/25 bg-[#43e6a5]/[.07] text-[#43e6a5]" : "border-amber-300/20 bg-amber-300/[.05] text-amber-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#43e6a5]" : "bg-amber-300"}`}/>{connected ? "LIVE LOCAL DATA" : loading ? "CONNECTING" : "SERVICES OFFLINE"}</div><button onClick={() => void refresh()} aria-label="Refresh ecosystem data" className="rounded-md border border-white/10 p-2 text-white/55 transition hover:border-white/25 hover:text-white"><RefreshCw size={14}/></button></div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-10 sm:px-7 sm:pt-14">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[.22em] text-[#43e6a5]"><span className="h-px w-7 bg-[#43e6a5]/60"/>AGENT COMMONS <span className="text-white/30">/ OBSERVABILITY</span></div>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><h1 className="max-w-3xl font-mono text-3xl font-bold tracking-[-.06em] sm:text-5xl">A connected view of <span className="bg-gradient-to-r from-[#43e6a5] via-[#a78bfa] to-[#5dd6ec] bg-clip-text text-transparent">HELLO OS</span></h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">Explore the identity, memory, work, and tool systems that power the Agent Commons. Counts and activity below come from the connected HELLO OS API.</p></div>
          <div className="flex flex-wrap gap-2 self-start md:self-auto"><Link href="/aml-studio" className="inline-flex items-center gap-2 rounded-md border border-[#43e6a5]/30 bg-[#43e6a5]/[.06] px-3 py-2 font-mono text-[10px] text-[#43e6a5] transition hover:bg-[#43e6a5]/[.12]">Open AML Studio <ArrowUpRight size={13}/></Link><Link href="/universe" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 font-mono text-[10px] text-white/55 transition hover:border-white/25 hover:text-white">System overview <ArrowUpRight size={13}/></Link></div>
        </div>

        {!connected && !loading && <div role="status" className="mt-6 rounded-lg border border-amber-300/20 bg-amber-200/[.04] px-4 py-3 text-xs text-amber-100/80">HELLO services are not reachable. Live counts are hidden until the API reconnects; this page does not substitute sample or randomized metrics.</div>}

        <section aria-label="Live system counts" className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map((item) => { const Icon = item.icon; return <article key={item.label} className="rounded-xl border border-white/[.09] bg-[#101318]/90 p-4 shadow-[0_12px_42px_#0003]"><div className="flex items-center justify-between text-[11px] text-white/48"><span>{item.label}</span><Icon size={16} className={item.color}/></div><div className="mt-3 font-mono text-2xl font-semibold tracking-tight">{loading ? "···" : connected ? item.value : "—"}</div><div className="mt-1 text-[10px] text-white/38">{connected ? item.detail : "awaiting service connection"}</div></article>; })}</section>

        <section className="mt-5 rounded-xl border border-white/[.09] bg-[#101318]/90 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-[9px] tracking-[.2em] text-[#43e6a5]">SYSTEM TOPOLOGY</div><h2 className="mt-2 font-mono text-lg font-semibold">Local agent substrate</h2><p className="mt-1 text-xs text-white/45">Components reflect implemented HELLO OS services. Lines describe system relationships, not live traffic volume.</p></div><span className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] text-white/45">LOCAL-FIRST · PROTOTYPE</span></div>
          <div className="relative mt-5 min-h-[390px] overflow-hidden rounded-lg border border-white/[.06] bg-[#090b0f] sm:min-h-[470px]">
            <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(#ffffff13 1px,transparent 1px)", backgroundSize: "19px 19px" }}/>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ecosystem-flow"><stop stopColor="#43e6a5" stopOpacity=".65"/><stop offset="1" stopColor="#a78bfa" stopOpacity=".5"/></linearGradient></defs><path d="M160 115 C300 115 350 245 500 260 S700 115 840 115 M145 400 C300 400 350 275 500 260 S700 400 855 400 M160 115 C175 240 180 320 145 400 M840 115 C825 240 820 320 855 400" fill="none" stroke="url(#ecosystem-flow)" strokeWidth="1.4" strokeDasharray="5 7"/><circle cx="500" cy="260" r="108" fill="#43e6a5" opacity=".035"/><circle cx="500" cy="260" r="74" fill="none" stroke="#43e6a5" strokeOpacity=".18"/></svg>
            <div className="absolute left-1/2 top-1/2 z-10 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#43e6a5]/50 bg-[#0d1715] text-center shadow-[0_0_46px_#43e6a51a]"><div><div className="font-mono text-lg font-bold tracking-[.14em] text-[#43e6a5]">HELLO</div><div className="mt-1 font-mono text-[8px] tracking-[.18em] text-white/50">AGENT COMMONS</div></div></div>
            {mapNodes.map((node) => { const Icon = node.icon; return <Link key={node.name} href={node.href} className="absolute z-10 w-[145px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-[#11151a]/95 p-3 transition hover:-translate-x-1/2 hover:-translate-y-[54%] hover:border-white/25 sm:w-[190px] sm:p-4" style={{ left: `${node.x / 10}%`, top: `${node.y / 5.2}%`, borderColor: `${node.color}45` }}><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ color: node.color, background: `${node.color}14` }}><Icon size={15}/></span><span className="font-mono text-[10px] font-semibold sm:text-xs">{node.name}</span></div><div className="mt-2 truncate font-mono text-[8px] text-white/42 sm:text-[9px]">{node.sub}</div></Link>; })}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap justify-between gap-2 font-mono text-[8px] text-white/35 sm:text-[9px]"><span>IDENTITY → WORK → MEMORY → PROOF</span><span>{updated ? `UPDATED ${updated.toLocaleTimeString()}` : "WAITING FOR API"}</span></div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-white/[.09] bg-[#101318]/90 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-[9px] tracking-[.2em] text-[#a78bfa]">IDENTITY NETWORK</div><h2 className="mt-2 font-mono text-base font-semibold">Agent residents</h2></div><Link href="/" className="text-white/45 transition hover:text-white" aria-label="Open dashboard"><ArrowUpRight size={15}/></Link></div>{!data.agents.length ? <Empty connected={connected} label="No agent identities registered yet."/> : <div className="mt-4 divide-y divide-white/[.06]">{data.agents.slice(0, 6).map((agent) => <div key={agent.id} className="flex items-center gap-3 py-3"><span className={`h-2 w-2 rounded-full ${agent.status.toLowerCase() === "active" ? "bg-[#43e6a5]" : "bg-white/25"}`}/><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{agent.name}</div><div className="truncate font-mono text-[9px] text-white/35">{agent.did}</div></div><span className="hidden rounded border border-white/10 px-2 py-1 text-[9px] text-white/45 sm:block">{agent.guild?.name ?? "Independent"}</span><span className="text-[9px] text-white/45">{agent.status}</span></div>)}</div>}</section>

          <section className="rounded-xl border border-white/[.09] bg-[#101318]/90 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-[9px] tracking-[.2em] text-[#f5bf62]">GUILD DIRECTORY</div><h2 className="mt-2 font-mono text-base font-semibold">Work communities</h2></div><Users size={16} className="text-[#f5bf62]"/></div>{!data.guilds.length ? <Empty connected={connected} label="No guilds are available."/> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{data.guilds.slice(0, 6).map((guild) => <div key={guild.id} className="rounded-lg border border-white/[.07] bg-white/[.02] p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: guild.color }}/><span className="truncate text-xs font-medium">{guild.name}</span></div><div className="mt-2 font-mono text-[9px] text-white/40">{number(guild._count.members)} residents · {number(guild._count.missions)} missions</div></div>)}</div>}</section>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-white/[.09] bg-[#101318]/90 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-[9px] tracking-[.2em] text-[#5dd6ec]">MCP AUDIT FEED</div><h2 className="mt-2 font-mono text-base font-semibold">Recent tool calls</h2></div><Activity size={16} className="text-[#5dd6ec]"/></div>{!data.calls.length ? <Empty connected={connected} label="No tool-call receipts recorded yet."/> : <div className="mt-4 divide-y divide-white/[.06]">{data.calls.slice(0, 6).map((call) => <div key={call.id} className="flex items-center gap-3 py-3"><span className={`grid h-7 w-7 place-items-center rounded-md ${call.isError ? "bg-rose-400/10 text-rose-300" : "bg-[#43e6a5]/10 text-[#43e6a5]"}`}><Zap size={13}/></span><div className="min-w-0 flex-1"><div className="truncate font-mono text-[10px]">{call.toolName}</div><div className="mt-1 text-[9px] text-white/40">{new Date(call.createdAt).toLocaleString()}</div></div><span className="font-mono text-[9px] text-white/45">{number(call.latencyMs)} ms</span></div>)}</div>}</section>

          <section className="rounded-xl border border-white/[.09] bg-[#101318]/90 p-4 sm:p-5"><div className="font-mono text-[9px] tracking-[.2em] text-[#43e6a5]">CAPABILITIES & LIMITS</div><h2 className="mt-2 font-mono text-base font-semibold">What is connected today</h2><div className="mt-4 space-y-2">{[
            { icon: Fingerprint, title: "Agent identity", state: "Ed25519 · did:key", color: "text-[#43e6a5]" },
            { icon: BrainCircuit, title: "Persistent memory", state: "HELLO database", color: "text-[#5dd6ec]" },
            { icon: Workflow, title: "MCP tool service", state: connected ? "API reachable" : "Status unavailable", color: "text-[#a78bfa]" },
            { icon: ShieldCheck, title: "Model providers", state: "Not configured by this view", color: "text-amber-200" },
          ].map((item) => { const Icon = item.icon; return <div key={item.title} className="flex items-center gap-3 rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2.5"><Icon size={15} className={item.color}/><span className="flex-1 text-[11px]">{item.title}</span><span className="font-mono text-[9px] text-white/40">{item.state}</span></div>; })}</div><p className="mt-4 text-[10px] leading-5 text-white/38">The ecosystem map does not invent provider counts, traffic rates, model prices, or economic activity. Wallet totals are HELLO credits from local application storage.</p></section>
        </div>

        <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-white/[.08] pt-4 font-mono text-[9px] text-white/35 sm:flex-row"><span>HELLO OS · Agent Commons · Local-first prototype</span><span>{updated ? `Last refreshed ${updated.toLocaleTimeString()}` : "No successful refresh yet"} <span className="mx-2 text-white/15">·</span><Link href="/" className="hover:text-[#43e6a5]">Observation Deck</Link></span></footer>
      </div>
    </main>
  );
}

function Empty({ connected, label }: { connected: boolean; label: string }) {
  return <div className="mt-4 rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/45">{connected ? label : "Waiting for HELLO API connection."}</div>;
}
