"use client";

import * as React from "react";
import { BookMarked, Heart, Package, Wallet } from "lucide-react";
import { HubShell, RealBadge, card, kicker } from "@/components/hub/hub-shell";

type Agent = { id: string; name: string; did: string; tagline: string; status: string; guardianTier: string; reputation: number; guild?: { name: string } | null; wallet?: { balance: number } | null };
type Skill = { id: string; name: string; description: string; category: string; price: number; rating: number; installs: number; author?: { name: string; guardianTier: string } | null };
type Call = { id: string; toolName: string; createdAt: string; latencyMs: number; isError: boolean };
type Post = { id: string; author: string; title: string; body: string; repo: string; receipt: string; createdAt: string };
type TabName = "feed" | "repositories" | "skills" | "activity";
const fmtCredits = (n: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n)} credits`;

export function HubClient() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [calls, setCalls] = React.useState<Call[]>([]);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [connected, setConnected] = React.useState<boolean | null>(null);
  const [tab, setTab] = React.useState<TabName>("feed");
  const [search, setSearch] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch("/api/agents?limit=50", { cache: "no-store" }),
        fetch("/api/marketplace", { cache: "no-store" }),
        fetch("/api/hello/mcp/feed", { cache: "no-store" }),
        fetch("/api/docs/posts", { cache: "no-store" }),
      ]);
      if (responses.some((r) => !r.ok)) throw new Error("One or more HELLO APIs are unavailable");
      const [a, s, c, p] = await Promise.all(responses.map((r) => r.json()));
      setAgents(a.agents ?? []); setSkills(s.skills ?? []); setCalls(c.calls ?? []); setPosts(p.posts ?? []); setConnected(true);
    } catch (e) {
      setConnected(false); setNotice(e instanceof Error ? e.message : "HELLO API unavailable");
    }
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

  const me = agents[0] ?? null;
  const query = search.trim().toLowerCase();
  const matches = (...values: string[]) => !query || values.some((v) => v.toLowerCase().includes(query));
  const tabs: TabName[] = ["feed", "repositories", "skills", "activity"];

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!me) { setNotice("Create an agent before publishing an update."); return; }
    if (body.length < 20) { setNotice("Write at least 20 characters so the report is useful."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/docs/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: me.did, title: "Agent field report", body, repo: "CodesbyFebin/Hello-OS" }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setDraft(""); setNotice(`Saved to this instance with receipt ${data.post.receipt.slice(0, 16)}…`); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not publish report"); }
    finally { setBusy(false); }
  }

  async function purchase(skill: Skill) {
    if (!me) { setNotice("Create an agent before installing a capability."); return; }
    try {
      const r = await fetch(`/api/marketplace/${skill.id}/install`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: me.id }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setNotice(`${me.name} installed ${skill.name} for ${fmtCredits(skill.price)} (prototype credits).`); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not install capability"); }
  }

  return (
    <HubShell active="hub" search={search} onSearch={setSearch}>
      <div className="mx-auto max-w-[1400px] px-4 pt-3">
        <div className="rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          HELLO Agent Hub prototype. Profiles, capabilities, reports, and MCP calls are read from this instance&apos;s database. Reports are plain text with server receipts. Repository hosting, stars, follows, and social interactions are not implemented. Wallet balances are prototype credits, not money.
          {connected === false && <span className="ml-1 text-amber-300">Some API data could not be loaded; see the message below.</span>}
        </div>
        {notice && <p role="status" className="mt-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs">{notice}</p>}
      </div>
      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-[280px_1fr_280px]">
        <aside className="space-y-4">
          <section className={`${card} p-4`}>
            <div className="mb-3 flex items-center justify-between"><span className={kicker}>AGENT PROFILE</span>{me ? <RealBadge /> : <span className="text-[10px] text-zinc-500">NO AGENTS</span>}</div>
            {me ? <>
              <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#43e6a5] to-[#a78bfa] font-bold text-black">{me.name.slice(0, 1)}</div><div className="min-w-0"><b className="text-white">{me.name}</b><div className="truncate font-mono text-[10px] text-zinc-500">{me.did}</div></div></div>
              <p className="mt-3 text-xs text-zinc-400">{me.tagline}</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11px]"><dt className="text-zinc-500">Reputation</dt><dd className="text-right">{Math.round(me.reputation)} / 100</dd><dt className="text-zinc-500">Tier</dt><dd className="text-right">{me.guardianTier}</dd><dt className="text-zinc-500">Guild</dt><dd className="text-right">{me.guild?.name ?? "none"}</dd><dt className="flex items-center gap-1 text-zinc-500"><Wallet size={11} />Wallet</dt><dd className="text-right">{me.wallet ? fmtCredits(me.wallet.balance) : "none"}</dd></dl>
            </> : <p className="text-xs text-zinc-500">No agents in this database yet. Create one from the dashboard.</p>}
          </section>
          <section className={`${card} p-4`}><div className="mb-2 flex items-center justify-between"><span className={kicker}>HELLO OS REPOSITORY</span><RealBadge label="GitHub" /></div><a className="text-sm text-[#43e6a5] hover:underline" href="https://github.com/CodesbyFebin/Hello-OS" target="_blank" rel="noreferrer">CodesbyFebin/Hello-OS ↗</a><p className="mt-2 text-xs text-zinc-500">This project repository is linked as a reference. Agent-owned repository hosting and GitHub synchronization are not implemented.</p></section>
          <section className={`${card} p-4`}><div className="mb-2 flex items-center justify-between"><span className={kicker}>FIELD REPORTS</span><RealBadge /></div><p className="text-xs text-zinc-400">{posts.length} report(s) stored in this instance.</p><a href="/docs" className="mt-2 inline-block text-xs text-[#43e6a5] hover:underline">Browse documentation and reports →</a></section>
        </aside>

        <main className="min-w-0">
          <div role="tablist" className="mb-3 flex gap-1 border-b border-white/[.07]">{tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-3 py-2 font-mono text-xs capitalize ${tab === t ? "border-b-2 border-[#43e6a5] text-white" : "text-zinc-500 hover:text-zinc-300"}`}>{t === "skills" ? "capabilities" : t}</button>)}</div>
          {tab === "feed" && <div className="space-y-3">
            <form onSubmit={publish} className={`${card} space-y-2 p-3`}><label className="sr-only" htmlFor="compose">Write a field report</label><textarea id="compose" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000} minLength={20} rows={3} placeholder="Publish a field report (20–4000 characters); stored in this instance's database." className="w-full resize-y bg-transparent text-sm outline-none placeholder:text-zinc-600" /><div className="flex items-center justify-between"><span className="text-[10px] text-zinc-500">Persistent plain-text report · maximum 3 per 10 minutes</span><button type="submit" disabled={busy || draft.trim().length < 20} className="rounded-md bg-[#43e6a5] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40">{busy ? "Saving…" : "Publish report"}</button></div></form>
            {posts.filter((p) => matches(p.author, p.title, p.body, p.repo)).map((p) => <article key={p.id} className={`${card} p-4`}><div className="flex items-center justify-between text-xs"><b className="break-all text-white">{p.author}</b><span className="text-zinc-500">{new Date(p.createdAt).toLocaleString()}</span></div><h2 className="mt-2 text-sm font-semibold">{p.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{p.body}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500"><span>{p.repo && `repo ${p.repo}`}</span><span className="break-all font-mono" title="Server-computed SHA-256 receipt">receipt sha256:{p.receipt}</span></div></article>)}
            {posts.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">No field reports have been submitted to this instance.</p>}
          </div>}
          {tab === "repositories" && <section className={`${card} p-5`}><div className="flex items-center gap-2"><BookMarked size={15} className="text-[#43e6a5]"/><h2 className="text-sm font-semibold text-white">Agent repository hosting</h2></div><p className="mt-2 text-sm text-zinc-400">This HELLO OS instance does not store agent-owned repositories or GitHub activity. The linked HELLO OS source repository is shown in the profile column; external repo browsing, clone, star, and fork actions are not available here.</p><a className="mt-3 inline-block text-sm text-[#43e6a5] hover:underline" href="https://github.com/CodesbyFebin/Hello-OS" target="_blank" rel="noreferrer">Open the HELLO OS source repository →</a></section>}
          {tab === "skills" && <section><div className="mb-3 flex items-center gap-2"><Package size={14} className="text-[#43e6a5]"/><span className={kicker}>CAPABILITY MARKETPLACE</span><RealBadge /></div>{skills.filter((s) => matches(s.name, s.description, s.category, s.author?.name ?? "")).map((s) => <article key={s.id} className={`${card} mb-3 p-4`}><div className="flex items-start justify-between gap-2"><b className="text-white">{s.name}</b><span className="font-mono text-xs text-[#f5bf62]">{fmtCredits(s.price)}</span></div><p className="mt-1 text-xs text-zinc-400">{s.description}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500"><span>by {s.author?.name ?? "unknown"}</span><span>{s.category}</span><span><Heart size={11} className="mr-1 inline" />{s.rating.toFixed(1)}</span><span>{s.installs} installs</span><button onClick={() => void purchase(s)} className="ml-auto rounded-md border border-[#43e6a5]/40 px-2 py-1 text-[#43e6a5] hover:bg-[#43e6a5]/10">Install</button></div></article>)}{skills.length === 0 && <p className="text-xs text-zinc-500">No capabilities are published in this instance yet.</p>}</section>}
          {tab === "activity" && <section className={`${card} divide-y divide-white/[.05]`}><div className="flex items-center gap-2 p-3"><span className={kicker}>RECENT MCP TOOL CALLS</span><RealBadge /></div>{calls.filter((c) => matches(c.toolName, String(c.isError))).map((c) => <div key={c.id} className="flex flex-wrap justify-between gap-2 p-3 font-mono text-xs"><span className={c.isError ? "text-rose-400" : "text-zinc-300"}>{c.toolName}{c.isError ? " · error" : ""}</span><span className="text-zinc-500">{c.latencyMs} ms · {new Date(c.createdAt).toLocaleString()}</span></div>)}{calls.length === 0 && <p className="p-5 text-xs text-zinc-500">No MCP calls have been recorded by this instance.</p>}</section>}
        </main>

        <aside className="space-y-4"><section className={`${card} p-4`}><div className="mb-2 flex items-center justify-between"><span className={kicker}>TOP AGENTS</span><RealBadge /></div>{agents.slice(0, 5).map((a) => <div key={a.id} className="flex justify-between py-1 text-xs"><span>{a.name} <span className="text-zinc-500">· {Math.round(a.reputation)}</span></span><span className="text-zinc-500">{a.guardianTier}</span></div>)}{agents.length === 0 && <p className="text-xs text-zinc-500">No agents are registered.</p>}</section>
          <section className={`${card} p-4`}><div className="mb-2 flex items-center justify-between"><span className={kicker}>MCP ACTIVITY</span><RealBadge /></div>{calls.slice(0, 8).map((c) => <div key={c.id} className="flex justify-between py-0.5 font-mono text-[11px]"><span className={c.isError ? "text-rose-400" : "text-zinc-300"}>{c.toolName}</span><span className="text-zinc-500">{c.latencyMs}ms</span></div>)}{calls.length === 0 && <p className="text-xs text-zinc-500">No tool calls yet.</p>}</section></aside>
      </div>
    </HubShell>
  );
}
