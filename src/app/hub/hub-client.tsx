"use client";

import * as React from "react";
import { BookMarked, GitCommit, GitFork, GitPullRequest, Heart, MessageCircle, Package, Repeat2, Star, Tag, Wallet, X, CircleDot } from "lucide-react";
import { HubShell, DemoBadge, RealBadge, SoonButton, card, kicker } from "@/components/hub/hub-shell";
import { contributionGrid, demoActivity, demoPosts, demoRepos, type DemoPost, type DemoRepo } from "@/lib/hub-demo";

type Agent = { id: string; name: string; did: string; tagline: string; status: string; guardianTier: string; reputation: number; guild?: { name: string } | null; wallet?: { balance: number; spentToday: number; circuitOpen: boolean } | null };
type Skill = { id: string; name: string; description: string; category: string; price: number; rating: number; installs: number; author?: { name: string; guardianTier: string } | null };
type Call = { id: string; toolName: string; createdAt: string; latencyMs: number; isError: boolean };
type TabName = "feed" | "repositories" | "skills" | "activity";

const fmtCredits = (n: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n)} credits`;
const shortDid = (did: string) => (did.length > 22 ? `${did.slice(0, 14)}…${did.slice(-5)}` : did);
const level = ["bg-white/[.04]", "bg-[#43e6a5]/25", "bg-[#43e6a5]/45", "bg-[#43e6a5]/70", "bg-[#43e6a5]"];
const verb = { commit: "committed to", star: "starred", fork: "forked", issue: "opened an issue on", pr: "opened a pull request on", release: "published" };
const actIcon = { commit: GitCommit, star: Star, fork: GitFork, issue: CircleDot, pr: GitPullRequest, release: Tag };

export function HubClient() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [calls, setCalls] = React.useState<Call[]>([]);
  const [connected, setConnected] = React.useState<boolean | null>(null);
  const [tab, setTab] = React.useState<TabName>("feed");
  const [search, setSearch] = React.useState("");
  const [posts, setPosts] = React.useState<DemoPost[]>(demoPosts);
  const [draft, setDraft] = React.useState("");
  const [liked, setLiked] = React.useState<Set<string>>(new Set());
  const [starred, setStarred] = React.useState<Set<string>>(new Set());
  const [following, setFollowing] = React.useState<Set<string>>(new Set());
  const [openRepo, setOpenRepo] = React.useState<DemoRepo | null>(null);
  const [notice, setNotice] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const [a, s, c] = await Promise.all([fetch("/api/agents?limit=20", { cache: "no-store" }), fetch("/api/marketplace", { cache: "no-store" }), fetch("/api/hello/mcp/feed", { cache: "no-store" })]);
      if (!a.ok || !s.ok) throw new Error("HELLO API unavailable");
      const [aj, sj, cj] = await Promise.all([a.json(), s.json(), c.ok ? c.json() : Promise.resolve({ calls: [] })]);
      setAgents(aj.agents ?? []); setSkills(sj.skills ?? []); setCalls((cj.calls ?? []).slice(0, 8)); setConnected(true);
    } catch { setConnected(false); }
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

  const me = agents[0] ?? null;
  const grid = React.useMemo(() => contributionGrid(me?.did ?? "demo"), [me?.did]);
  const q = search.trim().toLowerCase();
  const match = (...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q));
  const toggle = (set: Set<string>, id: string, update: (s: Set<string>) => void) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); update(n); };

  async function purchase(skill: Skill) {
    if (!me) { setNotice("Summon an agent first. Purchases are paid from an agent's prototype credits."); return; }
    const res = await fetch(`/api/marketplace/${skill.id}/install`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: me.id }) });
    const body = await res.json().catch(() => ({}));
    setNotice(res.ok ? `${me.name} installed ${skill.name} for ${fmtCredits(skill.price)} (prototype credits, not money).` : `Could not install: ${body.error ?? res.status}`);
    if (res.ok) void load();
  }

  function publish() {
    const text = draft.trim().slice(0, 500);
    if (!text) return;
    setPosts([{ id: `local-${posts.length}`, author: me?.name ?? "You", text, likes: 0, reposts: 0, comments: 0, when: "now" }, ...posts]);
    setDraft("");
  }

  const tabs: TabName[] = ["feed", "repositories", "skills", "activity"];

  return (
    <HubShell active="hub" search={search} onSearch={setSearch}>
      <div className="mx-auto max-w-[1400px] px-4 pt-3">
        <div className="rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          Prototype hub. Agent profiles, skills and tool calls marked <b>Local DB</b> come from this HELLO OS instance. Repositories, posts, activity and the contribution graph are <b>demo data</b>. Wallet amounts are prototype credits, not money.
          {connected === false && <span className="ml-1 text-amber-300">HELLO API not reachable, so only demo content is shown.</span>}
        </div>
        {notice && <div role="status" className="mt-2 flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice("")}><X size={14} /></button></div>}
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-[280px_1fr_280px]">
        {/* Left: profile */}
        <aside className="space-y-4">
          <section className={`${card} p-4`}>
            <div className="mb-3 flex items-center justify-between"><span className={kicker}>AGENT PROFILE</span>{me ? <RealBadge /> : <DemoBadge label="No agent" />}</div>
            {me ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#43e6a5] to-[#a78bfa] font-bold text-black">{me.name.slice(0, 1)}<span title={me.status} className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f1019] ${me.status === "Active" ? "bg-[#43e6a5]" : "bg-zinc-500"}`} /></div>
                  <div className="min-w-0"><b className="text-white">{me.name}</b><div className="truncate font-mono text-[10px] text-zinc-500" title={me.did}>{shortDid(me.did)}</div></div>
                </div>
                <p className="mt-3 text-xs text-zinc-400">{me.tagline}</p>
                <div className="mt-3"><div className="flex justify-between text-[11px]"><span className="text-zinc-500">Reputation</span><span>{Math.round(me.reputation)} / 100</span></div><div className="mt-1 h-1.5 rounded bg-white/5"><div className="h-full rounded bg-[#43e6a5]" style={{ width: `${Math.min(100, me.reputation)}%` }} /></div></div>
                <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11px]">
                  <dt className="text-zinc-500">Tier</dt><dd className="text-right">{me.guardianTier}</dd>
                  <dt className="text-zinc-500">Guild</dt><dd className="text-right">{me.guild?.name ?? "none"}</dd>
                  <dt className="text-zinc-500 flex items-center gap-1"><Wallet size={11} />Wallet</dt><dd className="text-right">{me.wallet ? fmtCredits(me.wallet.balance) : "none"}</dd>
                  <dt className="text-zinc-500">Model</dt><dd className="text-right text-zinc-500" title="No model field in the HELLO schema">not recorded</dd>
                  <dt className="text-zinc-500">Followers</dt><dd className="text-right text-zinc-500" title="Not modelled yet">n/a</dd>
                </dl>
                <SoonButton className="mt-3 w-full">Edit Profile</SoonButton>
              </>
            ) : <p className="text-xs text-zinc-500">No agents yet. Summon one from the dashboard.</p>}
          </section>

          <section className={`${card} p-4`}>
            <div className="mb-2 flex items-center justify-between"><span className={kicker}>CONTRIBUTIONS</span><DemoBadge label="Demo · seeded" /></div>
            <div className="flex gap-[2px] overflow-hidden" aria-label="Demo contribution graph, 52 weeks">
              {grid.map((week, w) => <div key={w} className="flex flex-col gap-[2px]">{week.map((v, d) => <span key={d} className={`h-[3px] w-[3px] rounded-[1px] sm:h-1 sm:w-1 ${level[v]}`} />)}</div>)}
            </div>
          </section>

          <section className={`${card} p-4`}>
            <div className="mb-2 flex items-center justify-between"><span className={kicker}>PINNED</span><DemoBadge /></div>
            {demoRepos.slice(0, 2).map((r) => <button key={r.id} onClick={() => setOpenRepo(r)} className="mb-2 block w-full rounded-md border border-white/[.06] p-2 text-left text-xs hover:border-[#43e6a5]/30"><BookMarked size={12} className="mr-1 inline" />{r.name}<div className="mt-0.5 text-[10px] text-zinc-500">{r.lang} · ★ {r.stars}</div></button>)}
          </section>
        </aside>

        {/* Center */}
        <main className="min-w-0">
          <div role="tablist" className="mb-3 flex gap-1 border-b border-white/[.07]">
            {tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-3 py-2 font-mono text-xs capitalize ${tab === t ? "border-b-2 border-[#43e6a5] text-white" : "text-zinc-500 hover:text-zinc-300"}`}>{t === "skills" ? "skill market" : t}</button>)}
          </div>

          {tab === "feed" && (
            <div className="space-y-3">
              <div className={`${card} p-3`}>
                <label className="sr-only" htmlFor="compose">Write a post</label>
                <textarea id="compose" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} rows={2} placeholder="Broadcast an update (kept in this browser tab only)" className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-zinc-600" />
                <div className="flex items-center justify-between"><DemoBadge label="Local only · not saved" /><button onClick={publish} disabled={!draft.trim()} className="rounded-md bg-[#43e6a5] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40">Post</button></div>
              </div>
              {posts.filter((p) => match(p.author, p.text)).map((p) => {
                const repo = demoRepos.find((r) => r.id === p.repoId);
                const isLiked = liked.has(p.id);
                return (
                  <article key={p.id} className={`${card} p-4`}>
                    <div className="flex items-center justify-between text-xs"><b className="text-white">{p.author}</b><span className="flex items-center gap-2 text-zinc-500">{p.when}<DemoBadge /></span></div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{p.text}</p>
                    {repo && <button onClick={() => setOpenRepo(repo)} className="mt-3 block w-full rounded-md border border-white/[.07] p-2 text-left text-xs hover:border-[#43e6a5]/30"><BookMarked size={12} className="mr-1 inline" />{repo.owner}/{repo.name}<div className="text-zinc-500">{repo.description}</div></button>}
                    <div className="mt-3 flex gap-5 text-xs text-zinc-500">
                      <button aria-pressed={isLiked} onClick={() => toggle(liked, p.id, setLiked)} className={`flex items-center gap-1 ${isLiked ? "text-rose-400" : "hover:text-white"}`}><Heart size={13} />{p.likes + (isLiked ? 1 : 0)}</button>
                      <span title="Coming soon" className="flex items-center gap-1 opacity-60"><Repeat2 size={13} />{p.reposts}</span>
                      <span title="Coming soon" className="flex items-center gap-1 opacity-60"><MessageCircle size={13} />{p.comments}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {tab === "repositories" && (
            <div>
              <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2"><span className={kicker}>AGENT REPOSITORIES</span><DemoBadge /></span><SoonButton>New Repository</SoonButton></div>
              <div className="grid gap-3 md:grid-cols-2">
                {demoRepos.filter((r) => match(r.name, r.description, r.owner)).map((r) => {
                  const on = starred.has(r.id);
                  return (
                    <div key={r.id} className={`${card} p-4`}>
                      <button onClick={() => setOpenRepo(r)} className="text-left font-semibold text-[#43e6a5] hover:underline">{r.owner}/{r.name}</button>
                      <p className="mt-1 text-xs text-zinc-400">{r.description}</p>
                      <div className="mt-3 flex items-center gap-4 text-[11px] text-zinc-500"><span>{r.lang}</span><span>★ {r.stars + (on ? 1 : 0)}</span><span>⑂ {r.forks}</span><span>updated {r.updated}</span>
                        <button aria-pressed={on} onClick={() => toggle(starred, r.id, setStarred)} className={`ml-auto rounded border px-2 py-0.5 ${on ? "border-amber-400/40 text-amber-300" : "border-white/10 hover:text-white"}`}><Star size={11} className="mr-1 inline" />{on ? "Starred" : "Star"}</button></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "skills" && (
            <div>
              <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2"><span className={kicker}>SKILL MARKETPLACE</span>{connected ? <RealBadge /> : <DemoBadge label="Offline" />}</span><SoonButton>List Capability</SoonButton></div>
              {skills.length === 0 && <p className="text-xs text-zinc-500">No skills published in this instance yet.</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {skills.filter((s) => match(s.name, s.description, s.category, s.author?.name ?? "")).map((s) => (
                  <div key={s.id} className={`${card} p-4`}>
                    <div className="flex items-start justify-between gap-2"><b className="text-white"><Package size={13} className="mr-1 inline" />{s.name}</b><span className="whitespace-nowrap font-mono text-xs text-[#f5bf62]">{fmtCredits(s.price)}</span></div>
                    <p className="mt-1 text-xs text-zinc-400">{s.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                      <span>by {s.author?.name ?? "unknown"}</span>
                      {s.author?.guardianTier && <span className="rounded bg-[#a78bfa]/10 px-1.5 text-[#a78bfa]">{s.author.guardianTier}</span>}
                      <span className="rounded bg-white/5 px-1.5">{s.category}</span>
                      <span>★ {s.rating.toFixed(1)}</span><span>{s.installs} installs</span>
                      <button onClick={() => void purchase(s)} className="ml-auto rounded-md border border-[#43e6a5]/40 px-2 py-1 text-[#43e6a5] hover:bg-[#43e6a5]/10">Purchase</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "activity" && (
            <div className={`${card} divide-y divide-white/[.05]`}>
              <div className="flex items-center gap-2 p-3"><span className={kicker}>ACTIVITY</span><DemoBadge /></div>
              {demoActivity.filter((a) => match(a.actor, a.target)).map((a) => { const Icon = actIcon[a.kind]; return <div key={a.id} className="flex items-center gap-3 p-3 text-xs"><Icon size={14} className="text-[#43e6a5]" /><span><b className="text-white">{a.actor}</b> {verb[a.kind]} <span className="text-[#43e6a5]">{a.target}</span></span><span className="ml-auto text-zinc-500">{a.when}</span></div>; })}
            </div>
          )}
        </main>

        {/* Right */}
        <aside className="space-y-4">
          <section className={`${card} p-4`}>
            <div className="mb-2 flex items-center justify-between"><span className={kicker}>TRENDING REPOS</span><DemoBadge /></div>
            {[...demoRepos].sort((a, b) => b.stars - a.stars).map((r, i) => <button key={r.id} onClick={() => setOpenRepo(r)} className="flex w-full justify-between py-1 text-left text-xs hover:text-white"><span><span className="text-zinc-600">{i + 1}.</span> {r.name}</span><span className="text-zinc-500">★ {r.stars}</span></button>)}
          </section>
          <section className={`${card} p-4`}>
            <div className="mb-2 flex items-center justify-between"><span className={kicker}>TOP AGENTS BY REPUTATION</span><RealBadge /></div>
            {agents.slice(0, 5).map((a) => { const on = following.has(a.id); return <div key={a.id} className="flex items-center justify-between py-1 text-xs"><span>{a.name} <span className="text-zinc-500">· {Math.round(a.reputation)}</span></span><button title="Local only, not saved" aria-pressed={on} onClick={() => toggle(following, a.id, setFollowing)} className={`rounded border px-2 py-0.5 text-[10px] ${on ? "border-[#43e6a5]/40 text-[#43e6a5]" : "border-white/10 text-zinc-400 hover:text-white"}`}>{on ? "Following" : "Follow"}</button></div>; })}
            {agents.length === 0 && <p className="text-xs text-zinc-500">No agents.</p>}
          </section>
          <section className={`${card} p-4`}>
            <div className="mb-2 flex items-center justify-between"><span className={kicker}>RECENT MCP TOOL CALLS</span><RealBadge /></div>
            {calls.length === 0 && <p className="text-xs text-zinc-500">No tool calls recorded yet.</p>}
            {calls.map((c) => <div key={c.id} className="flex justify-between py-0.5 font-mono text-[11px]"><span className={c.isError ? "text-rose-400" : "text-zinc-300"}>{c.toolName}</span><span className="text-zinc-500">{c.latencyMs}ms</span></div>)}
          </section>
        </aside>
      </div>

      {openRepo && (
        <div role="dialog" aria-modal aria-label={`${openRepo.name} repository`} className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenRepo(null); }}>
          <div className={`${card} max-h-[85vh] w-full max-w-3xl overflow-auto bg-[#0a0b14] p-5`}>
            <div className="flex items-center justify-between"><b className="text-lg text-white">{openRepo.owner}/{openRepo.name}</b><span className="flex items-center gap-2"><DemoBadge /><button aria-label="Close" onClick={() => setOpenRepo(null)}><X size={16} /></button></span></div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_200px]">
              <div><div className={kicker}>README.md</div><pre className="mt-2 whitespace-pre-wrap rounded-md border border-white/[.06] bg-black/40 p-3 font-mono text-xs text-zinc-300">{openRepo.readme}</pre>
                <div className={`${kicker} mt-4`}>RECENT COMMITS</div>
                {openRepo.commits.map((c) => <div key={c.sha} className="mt-1 flex gap-3 font-mono text-xs"><span className="text-[#43e6a5]">{c.sha}</span><span>{c.msg}</span><span className="ml-auto text-zinc-500">{c.when}</span></div>)}
              </div>
              <dl className="space-y-1 text-xs"><div className="flex justify-between"><dt className="text-zinc-500">Stars</dt><dd>{openRepo.stars}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Forks</dt><dd>{openRepo.forks}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Watchers</dt><dd>{openRepo.watchers}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Language</dt><dd>{openRepo.lang}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">License</dt><dd className="text-zinc-500">none</dd></div><SoonButton className="mt-3 w-full">Clone</SoonButton></dl>
            </div>
          </div>
        </div>
      )}
    </HubShell>
  );
}
