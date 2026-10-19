"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HubShell, card, kicker } from "@/components/hub/hub-shell";
import { CATEGORY_LABELS, CONNECTORS, type ConnectorCategory, type ConnectorStatus } from "@/lib/integrations/registry";
import { BRIDGES } from "@/lib/integrations/bridges";
import type { CheckState, StatusCheck } from "@/lib/integrations/status";

type View = "overview" | "connectors" | "bridges" | "status";

const STATUS_STYLE: Record<ConnectorStatus, string> = {
  WORKING: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  PLANNED: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  VISION: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};
const STATUS_TITLE: Record<ConnectorStatus, string> = {
  WORKING: "Implemented in this repo and covered by tests",
  PLANNED: "Not built yet",
  VISION: "Not built; would involve real money or chains and require operator approval",
};
const DOT: Record<CheckState, string> = {
  connected: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
  configured: "bg-emerald-400/70",
  "not-configured": "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
  unreachable: "bg-zinc-500",
};

function Badge({ s }: { s: ConnectorStatus }) {
  return <span title={STATUS_TITLE[s]} className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${STATUS_STYLE[s]}`}>{s}</span>;
}

const working = CONNECTORS.filter((c) => c.status === "WORKING");
const implementedBridges = BRIDGES.filter((b) => b.status === "implemented");

export default function IntegrationsClient() {
  const [view, setView] = useState<View>("overview");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ConnectorCategory | "all">("all");
  const [status, setStatus] = useState<ConnectorStatus | "all">("all");
  const [live, setLive] = useState<{ checkedAt: string; checks: StatusCheck[] } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/integrations/status", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setLive(await r.json());
      setLiveError(null);
    } catch (e) {
      setLiveError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/integrations/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { if (alive) setLive(d); })
      .catch((e: Error) => { if (alive) setLiveError(e.message); });
    return () => { alive = false; };
  }, []);

  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => CONNECTORS.filter((c) => (cat === "all" || c.category === cat) && (status === "all" || c.status === status)
    && (!needle || `${c.id} ${c.name} ${c.description} ${c.note ?? ""}`.toLowerCase().includes(needle))), [needle, cat, status]);
  const bridgeRows = useMemo(() => BRIDGES.filter((b) => !needle || `${b.id} ${b.name} ${b.description}`.toLowerCase().includes(needle)), [needle]);
  const counts = useMemo(() => CONNECTORS.reduce((m, c) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {} as Record<string, number>), []);
  const connectedChecks = live?.checks.filter((c) => c.state === "connected" || c.state === "configured").length ?? 0;

  const pill = (on: boolean) => `rounded-md border px-2.5 py-1 font-mono text-[11px] ${on ? "border-[#43e6a5] bg-[#43e6a5]/10 text-[#43e6a5]" : "border-white/10 text-zinc-400 hover:text-white"}`;
  const tabs: [View, string][] = [["overview", "bridge diagram"], ["connectors", "connectors"], ["bridges", "bridges"], ["status", "live status"]];

  return (
    <HubShell active="integrations">
      <div className="border-b border-white/[.07] bg-black/30">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2 font-mono text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5 text-[#43e6a5]"><span className="h-1.5 w-1.5 rounded-full bg-[#43e6a5]" />HELLO://INTEGRATION_REGISTRY</span>
          <span>100 CONNECTORS · 50 BRIDGES · MCP-FIRST</span>
          <span className="ml-auto">{working.length}/100 working · {live ? `${connectedChecks}/${live.checks.length} live checks passing` : liveError ? "status unavailable" : "checking…"}</span>
        </div>
      </div>
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map(([v, label]) => <button key={v} className={pill(view === v)} onClick={() => setView(v)}>{label}</button>)}
          <input aria-label="Search connectors and bridges" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search connectors, bridges…" className="ml-auto w-64 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs outline-none placeholder:text-zinc-600" />
        </div>

        {view === "overview" && (
          <section className="mt-6 space-y-6">
            <div className="py-6 text-center">
              <p className={kicker}>MCP-FIRST · READ-ONLY BY DEFAULT</p>
              <h1 className="mt-3 font-mono text-3xl font-bold tracking-tight text-white md:text-4xl">Bridge your <span className="text-rose-400">legacy stack</span> into <span className="bg-gradient-to-r from-[#43e6a5] via-violet-400 to-cyan-400 bg-clip-text text-transparent">HELLO OS</span></h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400">A registry of 100 proposed connectors and 50 bridge techniques. {working.length} connectors and {implementedBridges.length} techniques are built and tested today; the rest are labelled planned or vision.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[["CONNECTORS", "100", "in the registry"], ["WORKING", String(working.length), "implemented + tested"], ["BRIDGES", "50", "techniques"], ["IMPLEMENTED", String(implementedBridges.length), "bridge techniques"], ["CATEGORIES", "5", "A–E"]].map(([k, v, s]) => (
                <div key={k} className={`${card} p-4`}><div className={kicker}>{k}</div><div className="mt-1 font-mono text-2xl font-bold text-white">{v}</div><div className="font-mono text-[10px] text-zinc-500">{s}</div></div>
              ))}
            </div>
            <div className={`${card} p-5`}>
              <p className={kicker}>THE BRIDGE · WHAT EXISTS TODAY</p>
              <div className="mt-4 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-4"><div className="font-mono text-xs text-rose-300">LEGACY SOURCES</div><ul className="mt-2 space-y-1 text-xs text-zinc-400"><li>SQLite via Prisma</li><li>GitHub REST (public or token)</li><li>OpenAPI 3 documents</li><li>Signed GitHub webhooks</li></ul></div>
                <div className="hidden self-center font-mono text-zinc-600 md:block">→</div>
                <div className="rounded-lg border border-[#43e6a5]/20 bg-[#43e6a5]/5 p-4"><div className="font-mono text-xs text-[#43e6a5]">READ-ONLY MCP TOOLS</div><ul className="mt-2 space-y-1 font-mono text-[11px] text-zinc-400">{["connector.sql.query", "connector.sql.schema", "connector.sql.fingerprint", "connector.github.read", "connector.openapi.reflect", "connector.webhook.transpile"].map((t) => <li key={t}>{t}</li>)}</ul></div>
                <div className="hidden self-center font-mono text-zinc-600 md:block">→</div>
                <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-4"><div className="font-mono text-xs text-violet-300">HELLO OS AGENTS</div><ul className="mt-2 space-y-1 text-xs text-zinc-400"><li>hello-mcp service (/tools, /mcp)</li><li>Agent card at /.well-known/agent.json</li><li>Observe-only intents; no write tools</li></ul></div>
              </div>
            </div>
          </section>
        )}

        {view === "connectors" && (
          <section className="mt-5">
            <div className={`${card} flex flex-wrap items-center gap-2 p-3`}>
              <button className={pill(cat === "all")} onClick={() => setCat("all")}>all categories</button>
              {(Object.keys(CATEGORY_LABELS) as ConnectorCategory[]).map((k) => <button key={k} className={pill(cat === k)} onClick={() => setCat(k)}>{k} · {CATEGORY_LABELS[k]}</button>)}
              <span className="mx-1 h-5 w-px bg-white/10" />
              {(["all", "WORKING", "PLANNED", "VISION"] as const).map((s) => <button key={s} className={pill(status === s)} onClick={() => setStatus(s)}>{s === "all" ? "any status" : `${s.toLowerCase()} (${counts[s] ?? 0})`}</button>)}
            </div>
            <p className="mt-3 font-mono text-[11px] text-zinc-500">{rows.length} of {CONNECTORS.length} shown · payment/crypto connectors are VISION: real-money actions would need operator approval and are disabled by default</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((c) => (
                <article key={c.id} className={`${card} p-3`}>
                  <div className="flex items-start gap-2"><span className="font-mono text-xs text-zinc-500">#{c.id}</span><h2 className="flex-1 text-sm font-medium text-white">{c.name}</h2><Badge s={c.status} /></div>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">{c.category} · {CATEGORY_LABELS[c.category]}</p>
                  <p className="mt-2 text-xs text-zinc-400">{c.description}</p>
                  {c.implementation && <p className="mt-2 font-mono text-[10px] text-emerald-300/80">{c.implementation}</p>}
                  {c.note && <p className="mt-1 text-[11px] text-zinc-500">{c.note}</p>}
                </article>
              ))}
              {rows.length === 0 && <p className="text-sm text-zinc-500">No connectors match.</p>}
            </div>
          </section>
        )}

        {view === "bridges" && (
          <section className="mt-5">
            <h2 className="font-mono text-xl font-bold text-white">50 Bridge Techniques</h2>
            <p className="mt-1 text-xs text-zinc-500">{implementedBridges.length} implemented, {50 - implementedBridges.length} planned. Full text in docs/bridges.md.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {bridgeRows.map((b) => (
                <article key={b.id} className={`${card} p-3`}>
                  <div className="flex items-start gap-2"><span className="font-mono text-xs text-zinc-500">#{b.id}</span><h3 className="flex-1 text-sm font-medium text-white">{b.name}</h3>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${b.status === "implemented" ? STATUS_STYLE.WORKING : STATUS_STYLE.PLANNED}`}>{b.status.toUpperCase()}</span></div>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">{b.group}</p>
                  <p className="mt-2 text-xs text-zinc-400">{b.description}</p>
                  {b.implementation && <p className="mt-2 font-mono text-[10px] text-emerald-300/80">{b.implementation}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "status" && (
          <section className="mt-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-mono text-xl font-bold text-white">Live Connection Status</h2>
              <button className={pill(false)} onClick={() => void refresh()}>re-check</button>
              <span className="font-mono text-[11px] text-zinc-500">{live ? `checked ${new Date(live.checkedAt).toLocaleTimeString()}` : ""}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Real server-side checks of the implemented connectors only (GET /api/integrations/status). Secrets are reported as set or not set, never shown. Planned and vision connectors have nothing to check.</p>
            {liveError && <p className="mt-3 text-sm text-rose-300">Status check failed: {liveError}</p>}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {live?.checks.map((c) => (
                <div key={c.id} className={`${card} flex items-start gap-3 p-3`}>
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[c.state]}`} />
                  <div className="flex-1"><div className="flex items-center gap-2"><span className="font-mono text-xs text-white">{c.label}</span><span className="font-mono text-[10px] text-zinc-500">{c.state}</span></div>
                    <p className="mt-1 text-[11px] text-zinc-400">{c.detail}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">connectors {c.connectorIds.map((i) => `#${i}`).join(", ")}</p></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </HubShell>
  );
}
