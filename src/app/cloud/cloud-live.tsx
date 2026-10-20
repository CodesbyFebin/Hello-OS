"use client";

import * as React from "react";
import { TerminalBlock } from "@/components/design/terminal-block";
import { StatusBadge } from "@/components/design/status-badge";
import { LAYERS } from "@/components/hello/layers-card";

type Probe<T> = { state: "loading" } | { state: "ok"; status: number; ms: number; data: T } | { state: "error"; status: number | null; ms: number };

async function probe<T>(url: string): Promise<Probe<T>> {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { cache: "no-store" });
    const ms = Math.round(performance.now() - t0);
    if (!r.ok) return { state: "error", status: r.status, ms };
    return { state: "ok", status: r.status, ms, data: (await r.json()) as T };
  } catch { return { state: "error", status: null, ms: Math.round(performance.now() - t0) }; }
}

type Stats = { counts?: { agents?: number; activeAgents?: number; missions?: number } };
type Handshake = { platform?: string; version?: string; toolCount?: number; [k: string]: unknown };
type Card = { name?: string; version?: string; [k: string]: unknown };

function useLive() {
  const [stats, setStats] = React.useState<Probe<Stats>>({ state: "loading" });
  const [hs, setHs] = React.useState<Probe<Handshake>>({ state: "loading" });
  const [card, setCard] = React.useState<Probe<Card>>({ state: "loading" });
  const [at, setAt] = React.useState<string>("");
  React.useEffect(() => {
    let alive = true;
    const t = window.setTimeout(async () => {
      const [a, b, c] = await Promise.all([probe<Stats>("/api/stats"), probe<Handshake>("/api/hello/handshake"), probe<Card>("/.well-known/agent-card.json")]);
      if (!alive) return;
      setStats(a); setHs(b); setCard(c); setAt(new Date().toISOString());
    }, 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, []);
  return { stats, hs, card, at };
}

const LiveCtx = React.createContext<ReturnType<typeof useLive> | null>(null);
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const v = useLive();
  return <LiveCtx.Provider value={v}>{children}</LiveCtx.Provider>;
}
const useLiveCtx = () => React.useContext(LiveCtx)!;

const proto = LAYERS.filter((l) => l.tag === "PROTOTYPE").length;
const vision = LAYERS.filter((l) => l.tag === "VISION").length;

export function HeroChips({ shipped, totalSteps }: { shipped: number; totalSteps: number }) {
  const { stats, hs } = useLiveCtx();
  const tools = hs.state === "ok" && typeof hs.data.toolCount === "number" ? String(hs.data.toolCount) : hs.state === "loading" ? "…" : "MCP offline";
  const agents = stats.state === "ok" ? String(stats.data.counts?.agents ?? 0) : stats.state === "loading" ? "…" : "unavailable";
  const chips: [string, string, "agent" | "soul" | "cortex" | "ember"][] = [
    ["Layers", `${proto} prototype · ${vision} vision`, "cortex"],
    ["MCP tools", tools, "agent"],
    ["Resident agents", agents, "soul"],
    ["Roadmap", `${shipped}/${totalSteps} steps shipped (baseline)`, "ember"],
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Live status">
      {chips.map(([k, v, tone]) => (
        <li key={k} className="glass-card p-3">
          <div className="font-mono text-[10px] tracking-[.18em] text-zinc-400">{k.toUpperCase()}</div>
          <div className="mt-1 flex items-center gap-2 text-sm font-medium text-zinc-100" aria-live="polite">{v}</div>
          <div className="mt-1.5"><StatusBadge tone={tone} dot>{k === "Roadmap" ? "from steps.ts" : k === "Layers" ? "from layer list" : "live"}</StatusBadge></div>
        </li>
      ))}
    </ul>
  );
}

export function BootstrapManifest() {
  const { hs, card } = useLiveCtx();
  if (hs.state === "loading") return <TerminalBlock title="GET /api/hello/handshake" code="loading…" lineNumbers={false} />;
  if (hs.state === "ok") return <TerminalBlock maxHeight={440} title={`GET /api/hello/handshake · HTTP ${hs.status} · ${hs.ms} ms`} code={JSON.stringify(hs.data, null, 2)} />;
  const note = `# /api/hello/handshake → ${hs.status ?? "unreachable"} (${hs.ms} ms): the hello-mcp service (npm run mcp, :3030) isn't running.\n# Showing this app's own agent card instead.\n`;
  if (card.state === "ok") return <TerminalBlock title={`GET /.well-known/agent-card.json · HTTP ${card.status} · ${card.ms} ms`} maxHeight={440} code={note + JSON.stringify(card.data, null, 2)} />;
  return <TerminalBlock title="manifest unavailable" code={note + "# /.well-known/agent-card.json also failed."} lineNumbers={false} />;
}

export function StatusTerminal() {
  const { stats, hs, card, at } = useLiveCtx();
  const line = (k: string, v: string) => `${k.padEnd(16)}${v}`;
  const fmt = (p: Probe<unknown>) => p.state === "ok" ? `HTTP ${p.status} · ${p.ms} ms` : p.state === "loading" ? "checking…" : `${p.status === null ? "unreachable" : `HTTP ${p.status}`} · ${p.ms} ms`;
  const code = [
    line("platform", card.state === "ok" ? `${card.data.name ?? "?"} v${card.data.version ?? "?"}` : "…"),
    line("agents", stats.state === "ok" ? String(stats.data.counts?.agents ?? 0) : "…"),
    line("active_agents", stats.state === "ok" ? String(stats.data.counts?.activeAgents ?? 0) : "…"),
    line("missions", stats.state === "ok" ? String(stats.data.counts?.missions ?? 0) : "…"),
    line("/api/stats", fmt(stats)),
    line("handshake", fmt(hs)),
    line("agent_card", fmt(card)),
    line("checked_at", at || "…"),
  ].join("\n");
  return <TerminalBlock title="hello --status (measured from this browser)" code={code} />;
}
