"use client";

import { useMemo, useState } from "react";
import { HubShell, card, kicker } from "@/components/hub/hub-shell";
import { CATEGORY_LABELS, CONNECTORS, type ConnectorCategory, type ConnectorStatus } from "@/lib/integrations/registry";

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

function Badge({ s }: { s: ConnectorStatus }) {
  return <span title={STATUS_TITLE[s]} className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${STATUS_STYLE[s]}`}>{s}</span>;
}

export default function IntegrationsClient() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ConnectorCategory | "all">("all");
  const [status, setStatus] = useState<ConnectorStatus | "all">("all");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CONNECTORS.filter((c) => (cat === "all" || c.category === cat) && (status === "all" || c.status === status)
      && (!needle || `${c.id} ${c.name} ${c.description} ${c.note ?? ""}`.toLowerCase().includes(needle)));
  }, [q, cat, status]);

  const counts = useMemo(() => CONNECTORS.reduce((m, c) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {} as Record<string, number>), []);
  const pill = (on: boolean) => `rounded-md border px-2.5 py-1 font-mono text-[11px] ${on ? "border-[#43e6a5] bg-[#43e6a5]/10 text-[#43e6a5]" : "border-white/10 text-zinc-400 hover:text-white"}`;

  return (
    <HubShell active="integrations">
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <p className={kicker}>CONNECTOR REGISTRY</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Integrations</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          100 proposed connectors. Only entries marked <Badge s="WORKING" /> are implemented in this repo, as read-only MCP tools in the hello-mcp service, and covered by <code className="font-mono text-xs">tests/connectors.test.mjs</code>.
          Everything else is unbuilt. Payment and crypto connectors are <Badge s="VISION" />: any real-money action would need operator approval and is disabled by default.
          Bridge techniques are in <code className="font-mono text-xs">docs/bridges.md</code>.
        </p>

        <div className={`${card} mt-5 flex flex-wrap items-center gap-2 p-3`}>
          <input aria-label="Search connectors" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number, description" className="w-64 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none placeholder:text-zinc-600" />
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button className={pill(cat === "all")} onClick={() => setCat("all")}>all categories</button>
          {(Object.keys(CATEGORY_LABELS) as ConnectorCategory[]).map((k) => (
            <button key={k} className={pill(cat === k)} onClick={() => setCat(k)}>{k} · {CATEGORY_LABELS[k]}</button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/10" />
          {(["all", "WORKING", "PLANNED", "VISION"] as const).map((s) => (
            <button key={s} className={pill(status === s)} onClick={() => setStatus(s)}>{s === "all" ? "any status" : `${s.toLowerCase()} (${counts[s] ?? 0})`}</button>
          ))}
        </div>

        <p className="mt-3 font-mono text-[11px] text-zinc-500">{rows.length} of {CONNECTORS.length} shown</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <article key={c.id} className={`${card} p-3`}>
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs text-zinc-500">#{c.id}</span>
                <h2 className="flex-1 text-sm font-medium text-white">{c.name}</h2>
                <Badge s={c.status} />
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-500">{c.category} · {CATEGORY_LABELS[c.category]}</p>
              <p className="mt-2 text-xs text-zinc-400">{c.description}</p>
              {c.implementation && <p className="mt-2 font-mono text-[10px] text-emerald-300/80">{c.implementation}</p>}
              {c.note && <p className="mt-1 text-[11px] text-zinc-500">{c.note}</p>}
            </article>
          ))}
          {rows.length === 0 && <p className="text-sm text-zinc-500">No connectors match.</p>}
        </div>
      </main>
    </HubShell>
  );
}
