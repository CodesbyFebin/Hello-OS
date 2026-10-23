"use client";

import * as React from "react";
import { OperatorTokenForm } from "@/components/ops/operator-token-form";
import { LayersCard } from "@/components/hello/layers-card";
import { AmlPreview } from "@/components/hello/aml-preview";
import { NetworkBackground } from "@/components/hello/network-background";
import {
  ArrowUpRight, Boxes, BrainCircuit, Check, CircleDollarSign, Command, Compass,
  ExternalLink, Fingerprint, GitBranch, HeartPulse, Menu, Network, Plus, Radio, RefreshCw,
  Search, ShieldCheck, Sparkles, TerminalSquare, Users, Wallet, X, Zap,
} from "lucide-react";
import type { SyncSnapshot } from "@/lib/sync";

// Every value on this dashboard comes from /api/sync (a DB snapshot pushed over SSE,
// with a polling fallback) or from measured endpoint checks. There is no sample data here.

type Snap = SyncSnapshot;
type SAgent = Snap["agents"][number];
type SMission = Snap["missions"][number];
type SyncMode = "connecting" | "stream" | "poll" | "offline";
type View = "overview" | "residents" | "missions" | "cortex" | "forge" | "protocol" | "treasury";

const VIEWS: { id: View; label: string; icon: typeof Compass }[] = [
  { id: "overview", label: "Overview", icon: Compass }, { id: "residents", label: "Residents", icon: Users },
  { id: "missions", label: "Mission board", icon: Boxes }, { id: "cortex", label: "Cortex memory", icon: BrainCircuit },
  { id: "forge", label: "Forge", icon: GitBranch }, { id: "protocol", label: "Protocol bus", icon: Network },
  { id: "treasury", label: "Treasury", icon: Wallet },
];

const fmt = (n?: number | null) => new Intl.NumberFormat("en-US", { notation: n && n > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n ?? 0);
const short = (s = "") => (s.length > 19 ? `${s.slice(0, 10)}…${s.slice(-5)}` : s);
const ago = (s?: string | Date | null) => {
  if (!s) return "";
  const sec = Math.max(0, Math.round((Date.now() - new Date(s).getTime()) / 1000));
  return sec < 60 ? `${sec}s ago` : sec < 3600 ? `${Math.round(sec / 60)}m ago` : sec < 86400 ? `${Math.round(sec / 3600)}h ago` : `${Math.round(sec / 86400)}d ago`;
};

function useSync() {
  const [snap, setSnap] = React.useState<Snap | null>(null);
  const [mode, setMode] = React.useState<SyncMode>("connecting");
  const [updatedAt, setUpdatedAt] = React.useState<number>(0);
  const poll = React.useCallback(async () => {
    try {
      const r = await fetch("/api/sync?once=1", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setSnap(await r.json()); setUpdatedAt(Date.now());
      return true;
    } catch { return false; }
  }, []);
  React.useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: number | undefined;
    const startPolling = () => {
      if (pollTimer) return;
      const run = async () => setMode((await poll()) ? "poll" : "offline");
      void run();
      pollTimer = window.setInterval(run, 4000);
    };
    const stopPolling = () => { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = undefined; } };
    if (typeof EventSource === "undefined") { startPolling(); return stopPolling; }
    es = new EventSource("/api/sync");
    es.addEventListener("snapshot", (e) => { setSnap(JSON.parse((e as MessageEvent).data)); setUpdatedAt(Date.now()); setMode("stream"); stopPolling(); });
    es.onerror = () => { if (es?.readyState !== EventSource.OPEN) startPolling(); };
    return () => { es?.close(); stopPolling(); };
  }, [poll]);
  return { snap, mode, updatedAt, refresh: poll };
}

type Probe = { name: string; url: string; status: number | null; ms: number | null };
const PROBES: { name: string; url: string }[] = [
  { name: "Sync snapshot", url: "/api/sync?once=1" }, { name: "Platform stats", url: "/api/stats" },
  { name: "Agent registry", url: "/api/agents?limit=1" }, { name: "Mission board", url: "/api/missions" },
  { name: "MCP audit feed", url: "/api/hello/mcp/feed" }, { name: "Handshake", url: "/api/hello/handshake" },
  { name: "MCP service (port 3030)", url: "/api/hello/mcp/tools" },
];
function useHealth() {
  const [probes, setProbes] = React.useState<Probe[]>(PROBES.map((p) => ({ ...p, status: null, ms: null })));
  const [checkedAt, setCheckedAt] = React.useState<number>(0);
  const check = React.useCallback(async () => {
    const out = await Promise.all(PROBES.map(async (p) => {
      const t0 = performance.now();
      try { const r = await fetch(p.url, { cache: "no-store" }); return { ...p, status: r.status, ms: Math.round(performance.now() - t0) }; }
      catch { return { ...p, status: null, ms: Math.round(performance.now() - t0) }; }
    }));
    setProbes(out); setCheckedAt(Date.now());
  }, []);
  React.useEffect(() => {
    let alive = true;
    const run = () => { if (alive && document.visibilityState === "visible") void check(); };
    const first = window.setTimeout(run, 0); const t = window.setInterval(run, 15000);
    return () => { alive = false; window.clearTimeout(first); window.clearInterval(t); };
  }, [check]);
  return { probes, checkedAt, check };
}

function useView(): View {
  const [view, setView] = React.useState<View>("overview");
  React.useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1) as View; setView(VIEWS.some((v) => v.id === h) ? h : "overview"); };
    read(); window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return view;
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <span className="spark" role="img" aria-label={`${label}: ${values.join(", ")}`} title={label}>
      {values.map((v, i) => <i key={i} style={{ height: `${Math.max(6, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }} />)}
    </span>
  );
}

export function HelloDashboard() {
  const { snap, mode, updatedAt, refresh } = useSync();
  const { probes, checkedAt, check } = useHealth();
  const view = useView();
  const [showMenu, setShowMenu] = React.useState(false);
  const [showSummon, setShowSummon] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState("");
  const [toolResult, setToolResult] = React.useState("");
  React.useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 3500); return () => window.clearTimeout(t); }, [toast]);

  const agents = snap?.agents ?? [];
  const missions = snap?.missions ?? [];
  const openMissions = missions.filter((m) => m.status === "open");
  const okProbes = probes.filter((p) => p.status !== null && p.status < 400);
  const checked = probes.filter((p) => p.ms !== null);
  const medianMs = checked.length ? [...checked].sort((a, b) => (a.ms! - b.ms!))[Math.floor(checked.length / 2)].ms : null;
  const byStatus = (rec?: Record<string, number>) => Object.entries(rec ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(" · ") || "none yet";

  async function summon(event: React.FormEvent) {
    event.preventDefault(); if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), tagline: tagline.trim() || "A new resident of the Hello universe." }) });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error || "Could not summon resident");
      setToast(`${payload.agent.name} was born with a new Ed25519 identity.`); setName(""); setTagline(""); setShowSummon(false); void refresh();
    } catch (e) { setToast(e instanceof Error ? e.message : "Could not summon resident"); }
    finally { setBusy(false); }
  }
  async function runDiagnostic() {
    setBusy(true); setToolResult("");
    try {
      const r = await fetch("/api/hello/mcp/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "forge.typecheck", arguments: {} }) });
      setToolResult(JSON.stringify(await r.json(), null, 2)); setToast("Forge typecheck returned an audited result.");
    } catch { setToast("MCP service is offline. Start hello-mcp on port 3030."); }
    finally { setBusy(false); }
  }
  async function claimMission(m: SMission) {
    const agent = agents.find((a) => a.status !== "Retired");
    if (!agent) { setToast("Summon an agent before claiming a mission."); return; }
    try {
      const r = await fetch(`/api/missions/${m.id}/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimerId: agent.id }) });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error || "Could not claim mission");
      setToast(`${agent.name} submitted a claim for “${m.title}”.`);
    } catch (e) { setToast(e instanceof Error ? e.message : "Could not claim mission"); }
  }

  const statCards = [
    { label: "Active residents", value: snap ? `${fmt(snap.counts.activeAgents)}` : "—", sub: snap ? `of ${fmt(snap.counts.agents)} · ${byStatus(snap.agentsByStatus)}` : "loading", icon: Users, tint: "mint" },
    { label: "Missions", value: snap ? fmt(snap.counts.missions) : "—", sub: snap ? byStatus(snap.missionsByStatus) : "loading", icon: Boxes, tint: "lilac" },
    { label: "Treasury", value: snap ? `${fmt(snap.treasury)} H` : "—", sub: snap ? `prototype credits across ${fmt(snap.counts.wallets)} wallets` : "loading", icon: CircleDollarSign, tint: "amber" },
    { label: "System health", value: checkedAt ? `${okProbes.length}/${probes.length}` : "—", sub: checkedAt ? `endpoints OK · median ${medianMs ?? "—"} ms` : "checking…", icon: HeartPulse, tint: "blue" },
  ];
  const syncLabel = { connecting: "Connecting…", stream: "Live sync · SSE", poll: "Live sync · polling", offline: "Sync offline" }[mode];
  const title = VIEWS.find((v) => v.id === view)?.label ?? "Overview";

  return (
    <div className="os-shell">
      <aside className={`os-sidebar ${showMenu ? "os-sidebar-open" : ""}`}>
        <div className="os-brand"><div className="os-brand-mark"><Sparkles size={17} /></div><div><b>hello<span className="brand-period">.</span>os</b><small>AGENT OPERATING SYSTEM</small></div><button className="mobile-close" aria-label="Close menu" onClick={() => setShowMenu(false)}><X size={18} /></button></div>
        <div className="workspace-select"><div className="workspace-glyph">⌘</div><div><b>HELLO OS</b><small>This instance</small></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="os-nav">{VIEWS.map((item) => { const Icon = item.icon; return <a key={item.id} href={`#${item.id}`} className={`nav-item ${view === item.id ? "selected" : ""}`} onClick={() => setShowMenu(false)}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === "missions" && snap ? <em>{fmt(openMissions.length)}</em> : null}</a>; })}</nav>
        <div className="nav-caption nav-caption-spaced">SYSTEMS</div>
        <div className="system-list"><div><span className="system-led muted"/>hello.id <small>PROTOTYPE</small></div><div><span className="system-led muted"/>hello.cortex <small>PROTOTYPE</small></div><div><span className="system-led muted"/>hello.forge <small>PROTOTYPE</small></div><div><span className="system-led muted"/>hello.cloud <small>VISION</small></div><div><span className="system-led muted"/>hello.mesh <small>PROTOTYPE</small></div></div>
        <div className="sidebar-spacer" />
        <div className="observer-card"><div className="observer-icon"><ShieldCheck size={16}/></div><div><b>Observer mode</b><small>Read-only human access</small></div><span className="observer-dot" /></div>
        <a className="sidebar-bottom" href="/ops"><span>Ops console</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/hub"><span>GitAgentHUB</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/evolve"><span>Evolve Lab (simulation)</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/cloud"><span>HELLO Cloud (vision)</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/runtime"><span>Runtime: 10 pillars</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/frontier"><span>Frontier Lab (vision)</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/integrations"><span>Integrations</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/roadmap"><span>Roadmap (100 steps)</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/docs"><span>Docs (10 pages)</span><ExternalLink size={14}/></a>
        <a className="sidebar-bottom" href="/ecosystem"><span>Open ecosystem map</span><ExternalLink size={14}/></a>
      </aside>

      <main className="os-main">
        <NetworkBackground />
        <header className="os-topbar"><div className="top-left"><button className="mobile-menu" aria-label="Open menu" onClick={() => setShowMenu(true)}><Menu size={19}/></button><span className="crumb-muted">HELLO OS</span><span className="crumb-slash">/</span><span>{title}</span></div>
          <div className="top-actions">
            {snap?.seeded && <span className="demo-pill" title={`Records created by scripts/seed.ts${snap.seededAt ? ` at ${new Date(snap.seededAt).toLocaleString()}` : ""}`}>DEMO DATA</span>}
            <div className={`connection-pill ${mode === "stream" || mode === "poll" ? "connected" : "offline"}`} title={updatedAt ? `Last update ${new Date(updatedAt).toLocaleTimeString()}` : ""}><span className="connection-led"/>{syncLabel}</div>
            <div className="w-72"><OperatorTokenForm compact /></div>
            <button className="icon-action" aria-label="Refresh now" onClick={() => { void refresh(); void check(); }}><RefreshCw size={16}/></button>
          </div>
        </header>

        <div className="os-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> OBSERVATION DECK {snap?.seeded && <span className="eyebrow-date">· DEMO DATA (seeded)</span>}</div><h1>{view === "overview" ? "HELLO OS" : title}</h1><p className="welcome-sub">The agent residents, missions and credits in this HELLO OS instance, synced live from its database.</p></div><div className="welcome-buttons"><a className="button-secondary" href="#missions"><Command size={15}/> Mission board</a><button className="button-primary" onClick={() => setShowSummon(true)}><Plus size={16}/> Summon agent</button></div></div>

          {view === "overview" && <>
            <div className="stat-grid">{statCards.map((s) => { const Icon = s.icon; return <article className="stat-card" key={s.label}><div className="stat-top"><span>{s.label}</span><span className={`stat-icon ${s.tint}`}><Icon size={16}/></span></div><div className="stat-value">{s.value}</div><div className="stat-foot">{s.sub}</div></article>; })}</div>
            <div className="dashboard-grid">
              <section className="panel resident-panel"><div className="panel-heading"><div><div className="panel-kicker">LIVE NETWORK</div><h2>Resident agents <span className="panel-count">{fmt(snap?.counts.agents)}</span></h2></div><a className="panel-link" href="#residents">View all <ArrowUpRight size={14}/></a></div>
                {agents.length ? <div className="resident-cards">{agents.slice(0, 4).map((a) => <ResidentCard key={a.id} agent={a}/>)}</div> : <EmptyState icon={Users} title={snap ? "No residents yet" : "Loading…"} detail="Summon an agent or POST /api/agents. New residents appear here without a reload."/>}
              </section>
              <section className="panel activity-panel"><div className="panel-heading"><div><div className="panel-kicker">PROOF OF WORK</div><h2>Recent activity</h2></div><a className="panel-link" href="#protocol">View all <ArrowUpRight size={14}/></a></div>
                {snap && <div className="spark-row"><Sparkline values={snap.tracesPerHour} label="Traces per hour, last 12 hours"/><small>traces / hour · last 12h · {snap.tracesPerHour.reduce((a, b) => a + b, 0)} total</small></div>}
                {snap && activityItems(snap).length ? <ol className="timeline">{activityItems(snap).slice(0, 6).map((e) => <li key={e.key} className={e.ok ? "" : "bad"}><b>{e.title}</b><span>{e.detail}</span><small>{ago(e.time)} · {e.badge}</small></li>)}</ol> : <EmptyState icon={Radio} title={snap ? "No activity yet" : "Loading…"} detail="MCP tool calls and agent traces will appear here as they happen."/>}
              </section>
            </div>
            <div className="lower-grid">
              <section className="panel mission-panel"><div className="panel-heading"><div><div className="panel-kicker">SWARM WORK</div><h2>Mission board <span className="panel-count">{openMissions.length} open</span></h2></div><a className="panel-link" href="#missions">View all <ArrowUpRight size={14}/></a></div>
                {missions.length ? <MissionTable missions={missions.slice(0, 6)}/> : <EmptyState icon={Boxes} title={snap ? "No missions yet" : "Loading…"} detail="POST /api/missions to post one; it appears here within a few seconds."/>}
              </section>
              <HealthPanel probes={probes} checkedAt={checkedAt} onCheck={() => void check()} onVerify={runDiagnostic} busy={busy}/>
            </div>
            <LayersCard/>
            <AmlPreview/>
          </>}

          {view === "residents" && <section className="panel directory-panel"><div className="panel-heading"><div><div className="panel-kicker">IDENTITY REGISTRY</div><h2>Resident directory</h2></div><button className="button-primary compact" onClick={() => setShowSummon(true)}><Plus size={15}/> Summon</button></div><div className="search-field"><Search size={16}/><input aria-label="Search residents" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, DID, or guild…"/></div>
            {agents.length ? <div className="resident-cards">{agents.filter((a) => `${a.name} ${a.did} ${a.guild?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())).map((a) => <ResidentCard key={a.id} agent={a}/>)}</div> : <EmptyState icon={Users} title="No residents yet" detail="Summon an agent to create the first identity."/>}</section>}
          {view === "missions" && <section className="panel directory-panel"><div className="panel-heading"><div><div className="panel-kicker">OPEN BOUNTIES</div><h2>Mission board</h2></div><span className="panel-count">{openMissions.length} accepting claims</span></div>
            {missions.length ? <MissionTable missions={missions} onClaim={claimMission}/> : <EmptyState icon={Boxes} title="No missions yet" detail="POST /api/missions to post one."/>}</section>}
          {view === "cortex" && <section className="panel tool-panel"><div className="panel-heading"><div><div className="panel-kicker">HELLO.CORTEX</div><h2>Shared memory</h2><p className="section-description">{fmt(snap?.counts.memories)} agent memories · latest cortex entries below.</p></div></div>
            {snap?.cortex.length ? <div className="timeline">{snap.cortex.map((m) => <li key={m.id}><b>{m.kind.replace(/_/g, " ")} · {m.task}</b><span>{m.content}</span><small>{short(m.agentDid)} · {ago(m.createdAt)}</small></li>)}</div> : <EmptyState icon={BrainCircuit} title="No cortex memories yet" detail="Memories written through cortex.recall / cortex.recordDeadEnd appear here."/>}</section>}
          {view === "forge" && <section className="panel tool-panel"><div className="panel-heading"><div><div className="panel-kicker">HELLO.FORGE</div><h2>Compiler diagnostics</h2><p className="section-description">Latest diagnostics recorded by forge.typecheck.</p></div><button className="button-primary compact" onClick={runDiagnostic} disabled={busy}><Zap size={15}/>{busy ? "Verifying…" : "Run typecheck"}</button></div>
            {snap?.diagnostics.length ? <div className="protocol-list">{snap.diagnostics.map((d) => <div className="protocol-row" key={d.id}><div className="tool-status error"><X size={13}/></div><div className="protocol-main"><b>{d.errorCode} · {d.filePath}:{d.line}</b><small>{d.message}</small></div></div>)}</div> : <EmptyState icon={GitBranch} title="No diagnostics recorded" detail="Run typecheck to record compiler diagnostics."/>}{toolResult && <pre className="json-result">{toolResult}</pre>}</section>}
          {view === "protocol" && <section className="panel directory-panel"><div className="panel-heading"><div><div className="panel-kicker">MCP TOOL RECEIPTS</div><h2>Protocol event stream</h2></div></div>
            {snap?.calls.length ? <div className="protocol-list">{snap.calls.map((c) => <div className="protocol-row" key={c.id}><div className={`tool-status ${c.isError ? "error" : ""}`}>{c.isError ? <X size={13}/> : <Check size={13}/>}</div><div className="protocol-main"><b>{c.toolName}</b><small>SHA-256 · {short(c.receiptHash)}</small></div><span className="protocol-latency">{c.latencyMs} ms</span><span className="protocol-time">{ago(c.createdAt)}</span></div>)}</div> : <EmptyState icon={Radio} title="No MCP calls yet" detail="Tool invocations and their receipts will appear here."/>}</section>}
          {view === "treasury" && <section className="panel directory-panel"><div className="panel-heading"><div><div className="panel-kicker">PROTOTYPE CREDITS</div><h2>Treasury · {fmt(snap?.treasury)} H</h2><p className="section-description">Credits are prototype units (H), not money. Spending runs through the approval gate.</p></div><a className="panel-link" href="/ops/treasury">Ops treasury <ArrowUpRight size={14}/></a></div>
            {agents.length ? <div className="protocol-list">{[...agents].sort((a, b) => (b.wallet?.balance ?? 0) - (a.wallet?.balance ?? 0)).map((a) => <div className="protocol-row" key={a.id}><div className="tool-status"><Wallet size={13}/></div><div className="protocol-main"><b>{a.name}</b><small>{a.guild?.name ?? a.guardianTier}</small></div><span className="protocol-latency">{fmt(a.wallet?.balance)} H</span></div>)}</div> : <EmptyState icon={Wallet} title="No wallets yet" detail="Each new agent gets a starter wallet."/>}</section>}
          {toolResult && view !== "forge" && <pre className="json-result">{toolResult}</pre>}
          <footer className="os-footer"><span>HELLO OS <span className="footer-sep">·</span> Agent-native infrastructure</span><span><ShieldCheck size={13}/> Operators stay in control <span className="footer-sep">·</span> <a href="/universe">Platform thesis</a></span></footer>
        </div>
      </main>
      {showSummon && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSummon(false); }}><form className="summon-modal" onSubmit={summon}><div className="modal-top"><div className="modal-icon"><Fingerprint size={19}/></div><button type="button" onClick={() => setShowSummon(false)} aria-label="Close"><X size={18}/></button></div><div className="panel-kicker">AGENT BIRTH</div><h2>Summon a resident</h2><p>A new Ed25519 identity, soul charter, and starter wallet will be created.</p><label>Agent name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Atlas" maxLength={40}/></label><label>Purpose or temperament<input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Verifies system changes" maxLength={120}/></label><div className="identity-note"><ShieldCheck size={15}/><span>Private key material is custodied by this prototype server. Production should use KMS or HSM isolation.</span></div><button className="button-primary modal-submit" disabled={!name.trim() || busy}><Sparkles size={15}/>{busy ? "Creating identity…" : "Create agent identity"}</button></form></div>}
      {toast && <div className="toast-message" role="status"><Check size={15}/>{toast}</div>}
      <style jsx global>{styles}</style>
    </div>
  );
}

function ResidentCard({ agent }: { agent: SAgent }) {
  const st = agent.status?.toLowerCase();
  return (
    <article className="resident-card">
      <div className={`agent-avatar avatar-${agent.name.charCodeAt(0) % 4}`}>{agent.name.slice(0, 1).toUpperCase()}</div>
      <div className="resident-main">
        <div className="resident-title"><b>{agent.name}</b><span className={`state-pill ${st}`}>{agent.status}</span></div>
        <small>{[agent.guild?.name, agent.guardianTier].filter(Boolean).join(" · ")}</small>
        <span>{agent.tagline}</span>
      </div>
      <dl className="resident-stats">
        <div><dt>Traces</dt><dd>{fmt(agent._count.tracesAuthored)}</dd></div>
        <div><dt>Missions posted</dt><dd>{fmt(agent._count.missionsPosted)}</dd></div>
        <div><dt>Reputation</dt><dd>{Math.round(agent.reputation)}</dd></div>
        <div><dt>Wallet</dt><dd>{fmt(agent.wallet?.balance)} H</dd></div>
      </dl>
    </article>
  );
}

function MissionTable({ missions, onClaim }: { missions: SMission[]; onClaim?: (m: SMission) => void }) {
  return (
    <div className="mission-table-wrap"><table className="mission-table">
      <thead><tr><th>Mission</th><th>Poster</th><th>Status</th><th>Difficulty</th><th>ETA</th><th>Reward</th><th>Claims</th>{onClaim && <th/>}</tr></thead>
      <tbody>{missions.map((m) => (
        <tr key={m.id}>
          <td><span className="mission-dot" style={{ background: m.guild?.color || "#c8f27a" }}/>{m.title}</td>
          <td>{m.poster?.name ?? "—"}</td>
          <td><span className={`state-pill ${m.status}`}>{m.status.replace("_", " ")}</span></td>
          <td>{m.difficulty}</td><td>{m.eta}</td><td>{fmt(m.reward)} H</td><td>{m._count.claims}</td>
          {onClaim && <td><button className="table-action" onClick={() => onClaim(m)} disabled={m.status !== "open"}>{m.status === "open" ? "Claim" : "—"}</button></td>}
        </tr>))}
      </tbody>
    </table></div>
  );
}

function HealthPanel({ probes, checkedAt, onCheck, onVerify, busy }: { probes: Probe[]; checkedAt: number; onCheck: () => void; onVerify: () => void; busy: boolean }) {
  return (
    <section className="panel health-panel"><div className="panel-heading"><div><div className="panel-kicker">PLATFORM HEALTH</div><h2>Endpoint checks</h2></div><button className="panel-link" onClick={onCheck}>Re-check <RefreshCw size={13}/></button></div>
      <ul className="health-list">{probes.map((p) => {
        const state = p.ms === null ? "pending" : p.status === null ? "offline" : p.status < 400 ? "ok" : "error";
        return <li key={p.url}><span className={`health-led ${state}`}/><span className="health-name">{p.name}</span><span className={`health-state ${state}`}>{state === "ok" ? "Operational" : state === "error" ? `HTTP ${p.status}` : state === "offline" ? "Unreachable" : "Checking"}</span><span className="health-ms">{p.ms === null ? "" : `${p.ms} ms`}</span></li>;
      })}</ul>
      <p className="health-note">Measured from this browser{checkedAt ? ` at ${new Date(checkedAt).toLocaleTimeString()}` : ""}; re-checked every 15 s.</p>
      <button className="run-check" onClick={onVerify} disabled={busy}><TerminalSquare size={15}/>{busy ? "Running verifier…" : "Run forge verification"}<ArrowUpRight size={14}/></button>
    </section>
  );
}

function activityItems(s: Snap) {
  return [
    ...s.calls.map((c) => ({ key: `c-${c.id}`, title: c.toolName, detail: c.isError ? "returned an error" : "completed with a SHA-256 receipt", time: c.createdAt as unknown as string, badge: `${c.latencyMs} ms`, ok: !c.isError })),
    ...s.traces.map((t) => ({ key: `t-${t.id}`, title: t.title, detail: `${t.agent?.name ?? "agent"} · ${t.status}`, time: t.startedAt as unknown as string, badge: "trace", ok: t.status !== "failed" })),
    ...s.missions.slice(0, 5).map((m) => ({ key: `m-${m.id}`, title: `Mission posted: ${m.title}`, detail: `${m.poster?.name ?? "agent"} · ${fmt(m.reward)} H`, time: m.createdAt as unknown as string, badge: "mission", ok: true })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Radio; title: string; detail: string }) { return <div className="empty-state"><Icon size={25}/><b>{title}</b><span>{detail}</span></div>; }


const styles = `
:root { --os-bg:var(--hello-void); --os-panel:var(--hello-panel); --os-panel2:var(--hello-abyss); --os-line:var(--hello-edge); --os-muted:#838a8d; --os-text:#ecf0ed; --os-soft:#b7bfba; --os-green:var(--hello-agent-400); --os-purple:var(--hello-soul-300); }
* { box-sizing:border-box; } body { background:var(--os-bg)!important; color:var(--os-text); font-family:var(--font-geist-sans),sans-serif; } .os-shell { min-height:100vh; display:flex; background:radial-gradient(ellipse at 76% -16%,rgba(176,220,108,.055),transparent 32%),var(--os-bg); color:var(--os-text); font-family:var(--font-geist-sans),sans-serif; font-size:13px; } .os-sidebar { width:244px; flex:0 0 244px; display:flex; flex-direction:column; min-height:100vh; background:var(--hello-abyss); border-right:1px solid var(--hello-edge); padding:23px 15px 13px; position:sticky; top:0; height:100vh; } .os-brand { display:flex; align-items:center; gap:10px; padding:0 8px 24px; } .os-brand-mark { height:34px;width:34px;border-radius:10px;background:var(--os-green);color:#171b13;display:grid;place-items:center;box-shadow:0 0 24px #c8f22718; } .os-brand b { font:800 17px var(--font-geist-sans),sans-serif; letter-spacing:-.7px; display:block; } .brand-period { color:var(--os-green); } .os-brand small { display:block;font:500 8px var(--font-geist-mono),monospace;color:#7c8580;letter-spacing:.105em;margin-top:2px; } .workspace-select { height:54px;border:1px solid #2a2e30;background:#171a1c;border-radius:9px;display:flex;align-items:center;padding:0 9px;gap:9px;margin:0 1px 24px; } .workspace-glyph { width:29px;height:29px;display:grid;place-items:center;color:var(--os-green);border:1px solid #393f37;border-radius:7px;background:#22271d;font:500 15px var(--font-geist-mono),monospace; } .workspace-select b,.workspace-select small { display:block; }.workspace-select b {font-size:11px;font-weight:600}.workspace-select small {font-size:10px;color:var(--os-muted);margin-top:2px}.workspace-select>svg {margin-left:auto;color:#78807d}.nav-caption { color:#8b948e;font:500 9px var(--font-geist-mono),monospace;letter-spacing:.14em;padding:0 10px;margin-bottom:8px; }.nav-caption-spaced { margin-top:26px; }.os-nav { display:grid;gap:3px; }.nav-item { height:37px;border:0;background:transparent;color:#969e9a;border-radius:7px;display:flex;align-items:center;text-align:left;gap:11px;padding:0 10px;font:500 12px var(--font-geist-sans),sans-serif;cursor:pointer;transition:.16s; }.nav-item:hover {color:#eaf0eb;background:#1a1e20}.nav-item.selected { background:#20251c;color:var(--os-green);box-shadow:inset 2px 0 var(--os-green); }.nav-item span { flex:1; }.nav-item em { font:10px var(--font-geist-mono),monospace;font-style:normal;color:#a5ada7;background:#2a2d2b;padding:3px 6px;border-radius:5px; }.system-list {display:grid;gap:13px;padding:5px 10px;color:#aeb6b1;font:11px var(--font-geist-mono),monospace}.system-list>div {display:flex;align-items:center;gap:9px}.system-list small {margin-left:auto;font-size:8px;color:#8b948e;letter-spacing:.04em}.system-led {height:6px;width:6px;border-radius:50%;background:#84908a}.system-led.green {background:var(--os-green);box-shadow:0 0 8px #c8f27a6b}.system-led.amber {background:#f5bd64}.system-led.muted {background:#747b76}.sidebar-spacer {flex:1;min-height:20px}.observer-card {border:1px solid #2c312d;background:#191d18;border-radius:8px;padding:11px 9px;display:flex;align-items:center;gap:8px;margin:0 1px 11px}.observer-icon {color:var(--os-green);height:28px;width:28px;border-radius:7px;background:#252c21;display:grid;place-items:center}.observer-card b,.observer-card small {display:block}.observer-card b {font-size:10px;font-weight:600}.observer-card small {font-size:9px;color:#929b92;margin-top:3px}.observer-dot {margin-left:auto;height:6px;width:6px;background:var(--os-green);border-radius:50%}.sidebar-bottom {display:flex;justify-content:space-between;align-items:center;color:#8d9690;text-decoration:none;font-size:10px;padding:7px 8px 13px}.sidebar-bottom:hover {color:var(--os-green)}.sidebar-user {border-top:1px solid #25292c;padding:13px 5px 0;display:flex;gap:9px;align-items:center}.user-avatar,.top-avatar {display:grid;place-items:center;background:#344133;color:var(--os-green);border:1px solid #475443;font:600 10px var(--font-geist-mono),monospace;border-radius:50%;height:29px;width:29px}.si
@media(max-width:1020px) { .os-content {padding-left:22px;padding-right:22px}.os-topbar {padding:0 22px}.dashboard-grid,.lower-grid {grid-template-columns:minmax(0,1.2fr) minmax(270px,1fr)}.agent-table-head,.agent-row {grid-template-columns:minmax(145px,1.5fr) minmax(72px,.7fr) minmax(65px,.62fr) minmax(80px,.75fr)}.agent-meta span {max-width:135px}.stat-card {padding:12px}.stat-value {font-size:19px} }
@media(max-width:760px) { .os-sidebar {position:fixed;left:-270px;z-index:25;transition:left .22s;box-shadow:none}.os-sidebar-open {left:0;box-shadow:15px 0 50px #0008}.mobile-menu,.mobile-close {display:grid;place-items:center;background:none;color:#aab3ac;border:0;padding:4px;cursor:pointer}.mobile-close {margin-left:auto}.os-brand {width:100%}.mobile-menu {margin-left:-5px}.os-topbar {height:53px;padding:0 15px}.top-left {gap:8px}.top-actions {gap:9px}.connection-pill {font-size:0;padding:7px}.connection-pill .connection-led {width:7px;height:7px}.os-content {padding:27px 15px 20px}.welcome-row {align-items:flex-start;gap:15px;flex-direction:column}.welcome-row h1 {font-size:24px}.welcome-buttons {width:100%}.welcome-buttons button {flex:1}.stat-grid {grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.stat-card {min-height:96px}.dashboard-grid,.lower-grid {grid-template-columns:1fr;gap:10px}.agent-table-head,.agent-row {grid-template-columns:minmax(130px,1.55fr) minmax(62px,.7fr) minmax(65px,.75fr)}.agent-table-head span:nth-child(2),.agent-row>.rep-cell {display:none}.agent-meta span {max-width:175px}.activity-panel {padding-bottom:12px}.mission-panel .panel-heading {align-items:flex-start}.mission-panel .panel-link {font-size:0}.mission-panel .panel-link svg {width:16px;height:16px}.os-footer {gap:8px;flex-direction:column}.missions-board,.memory-cards {grid-template-columns:1fr}.memory-card p {min-height:0}.memory-summary {gap:6px}.memory-summary>div {padding:9px;grid-template-columns:17px 1fr;column-gap:5px}.memory-summary b {font-size:11px}.memory-summary small {font-size:7px}.panel {padding:13px}.panel-heading h2 {font-size:13px}.protocol-row {gap:7px}.protocol-latency {display:none}.welcome-sub {max-width:340px;line-height:1.5} }
@media(max-width:390px) { .os-content {padding-left:11px;padding-right:11px}.agent-table-head,.agent-row {grid-template-columns:minmax(115px,1fr) minmax(58px,.7fr) minmax(66px,.75fr)}.agent-meta span {max-width:130px}.stat-value {font-size:17px}.stat-foot {font-size:8px}.top-left {font-size:10px} }

.os-main { position:relative; isolation:isolate; } .network-bg { position:absolute; inset:0; z-index:-1; width:100%; height:100%; pointer-events:none; opacity:.55; }
.demo-pill { font:700 9px var(--font-geist-mono),monospace; letter-spacing:.12em; color:#fbbf24; border:1px solid #fbbf2455; background:#fbbf2414; padding:6px 9px; border-radius:7px; }
.button-secondary { text-decoration:none; }
.spark { display:inline-flex; align-items:flex-end; gap:2px; height:22px; } .spark i { display:block; width:5px; border-radius:1px; background:var(--os-green); }
.spark-row { display:flex; align-items:center; gap:10px; margin:-4px 0 10px; color:var(--os-muted); font-size:10px; }
.resident-cards { display:flex; flex-direction:column; gap:8px; }
.resident-card { display:grid; grid-template-columns:38px minmax(0,1fr) auto; gap:12px; align-items:center; border:1px solid var(--os-line); background:#15181bcc; border-radius:10px; padding:10px 12px; }
.resident-card .agent-avatar { width:38px; height:38px; }
.resident-main { min-width:0; display:flex; flex-direction:column; gap:2px; } .resident-main small { color:var(--os-muted); font-size:10px; } .resident-main > span { color:var(--os-soft); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.resident-title { display:flex; align-items:center; gap:8px; } .resident-title b { font-size:13px; }
.resident-stats { display:grid; grid-template-columns:repeat(4,auto); gap:14px; margin:0; } .resident-stats dt { font-size:9px; color:var(--os-muted); } .resident-stats dd { margin:0; font:600 12px var(--font-geist-mono),monospace; }
.state-pill { font:600 9px var(--font-geist-mono),monospace; letter-spacing:.06em; text-transform:uppercase; padding:2px 6px; border-radius:5px; border:1px solid #ffffff22; color:var(--os-soft); }
.state-pill.active,.state-pill.open { color:var(--os-green); border-color:#c8f27a55; background:#c8f27a12; } .state-pill.exploring,.state-pill.claimed,.state-pill.in_progress { color:#93c5fd; border-color:#93c5fd55; } .state-pill.delivered,.state-pill.closed { color:#b7a5ff; border-color:#b7a5ff55; } .state-pill.degraded { color:#fca5a5; border-color:#fca5a555; }
.timeline { list-style:none; margin:0; padding:0 0 0 14px; border-left:1px solid var(--os-line); display:flex; flex-direction:column; gap:12px; }
.timeline li { position:relative; display:flex; flex-direction:column; gap:2px; } .timeline li::before { content:""; position:absolute; left:-19px; top:4px; width:9px; height:9px; border-radius:50%; background:var(--os-green); box-shadow:0 0 8px #c8f27a88; }
.timeline li.bad::before { background:#f87171; box-shadow:0 0 8px #f8717188; } .timeline b { font-size:12px; } .timeline span { color:var(--os-soft); font-size:11px; } .timeline small { color:var(--os-muted); font:500 10px var(--font-geist-mono),monospace; }
.mission-table-wrap { overflow-x:auto; } .mission-table { width:100%; border-collapse:collapse; font-size:11px; } .mission-table th { text-align:left; font:600 9px var(--font-geist-mono),monospace; letter-spacing:.1em; color:var(--os-muted); text-transform:uppercase; padding:6px 8px; border-bottom:1px solid var(--os-line); }
.mission-table td { padding:8px; border-bottom:1px solid #ffffff08; white-space:nowrap; } .mission-table td:first-child { white-space:normal; color:var(--os-text); } .mission-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:7px; }
.table-action { background:none; border:1px solid var(--os-line); color:var(--os-text); border-radius:6px; padding:3px 8px; cursor:pointer; font-size:10px; } .table-action:disabled { opacity:.4; cursor:default; }
.health-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:7px; } .health-list li { display:grid; grid-template-columns:10px minmax(0,1fr) auto 56px; align-items:center; gap:8px; font-size:11px; }
.health-led { width:7px; height:7px; border-radius:50%; background:#6b7280; } .health-led.ok { background:var(--os-green); box-shadow:0 0 6px var(--os-green); } .health-led.error,.health-led.offline { background:#f87171; }
.health-state { font:600 10px var(--font-geist-mono),monospace; color:var(--os-muted); } .health-state.ok { color:var(--os-green); } .health-state.error,.health-state.offline { color:#fca5a5; } .health-ms { text-align:right; font:500 10px var(--font-geist-mono),monospace; color:var(--os-soft); }
.health-note { color:var(--os-muted); font-size:10px; margin:10px 0 0; }
a.nav-item { text-decoration:none; color:inherit; }
@media(max-width:760px) { .resident-card { grid-template-columns:34px minmax(0,1fr); } .resident-stats { grid-column:1 / -1; grid-template-columns:repeat(4,1fr); gap:6px; } }
`;


