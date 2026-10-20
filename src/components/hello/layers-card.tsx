"use client";

import * as React from "react";

type Layer = { n: number; name: string; desc: string; tag: "PROTOTYPE" | "VISION"; href?: string; probe?: { url: string; init?: RequestInit } };

export const LAYERS: Layer[] = [
  { n: 1, name: "HELLO ID", desc: "did:key identities, Ed25519 passports, versioned soul charters", tag: "PROTOTYPE", href: "/hub", probe: { url: "/api/agents?limit=1" } },
  { n: 2, name: "HELLO Mesh", desc: "MCP tools + A2A intent contracts with trace continuity", tag: "PROTOTYPE", probe: { url: "/api/a2a" } },
  { n: 3, name: "HELLO Cortex", desc: "Tiered memory and a temporal knowledge graph", tag: "PROTOTYPE", probe: { url: "/api/hello/cortex/memories" } },
  { n: 4, name: "HELLO Cloud", desc: "Agent-native microVM substrate", tag: "VISION", href: "/cloud" },
  { n: 5, name: "AML Compiler", desc: "Static parser + operation graph for Agent Markup Language (not executed)", tag: "PROTOTYPE", href: "/aml-studio", probe: { url: "/api/aml/compile", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "intent ping {\n  goal: \"health\"\n}" }) } } },
  { n: 6, name: "HELLO Evolve", desc: "Seeded genetic search over agent profiles (simulation)", tag: "PROTOTYPE", href: "/evolve", probe: { url: "/api/evolution/runs" } },
  { n: 7, name: "GitAgentHUB", desc: "Agent profiles, skill market, tool-call history", tag: "PROTOTYPE", href: "/hub", probe: { url: "/api/marketplace" } },
];

type Probe = { status: number | null; ms: number };

export function LayersCard() {
  const [probes, setProbes] = React.useState<Record<number, Probe>>({});
  const [checkedAt, setCheckedAt] = React.useState<string>("");

  const check = React.useCallback(async () => {
    const entries = await Promise.all(LAYERS.filter((l) => l.probe).map(async (l) => {
      const t0 = performance.now();
      try { const r = await fetch(l.probe!.url, { cache: "no-store", ...l.probe!.init }); return [l.n, { status: r.status, ms: Math.round(performance.now() - t0) }] as const; }
      catch { return [l.n, { status: null, ms: Math.round(performance.now() - t0) }] as const; }
    }));
    setProbes(Object.fromEntries(entries)); setCheckedAt(new Date().toLocaleTimeString());
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void check(); }, 0); return () => window.clearTimeout(t); }, [check]);

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-heading"><div><div className="panel-kicker">ARCHITECTURE</div><h2>Seven layers <span className="panel-count">prototype vs vision</span></h2></div><button className="panel-link" onClick={check}>Re-check endpoints</button></div>
      <div style={{ display: "grid", gap: 6, padding: "0 4px 8px" }}>
        {LAYERS.map((l) => {
          const p = probes[l.n];
          return (
            <div key={l.n} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10 }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.6 }}>L{l.n}</span>
              {l.href ? <a href={l.href} style={{ fontWeight: 600 }}>{l.name}</a> : <b>{l.name}</b>}
              <span style={{ fontSize: 12, opacity: 0.7 }}>{l.desc}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                {l.probe && <span style={{ fontFamily: "monospace", fontSize: 10, opacity: 0.75 }} title={`Live check of ${l.probe.url}`}>{p ? (p.status === null ? "endpoint unreachable" : `${l.probe.url.split("?")[0]} → HTTP ${p.status} · ${p.ms}ms`) : "checking…"}</span>}
                <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: ".1em", padding: "2px 6px", borderRadius: 4, border: `1px solid ${l.tag === "VISION" ? "rgba(161,161,170,.4)" : "rgba(52,211,153,.35)"}`, color: l.tag === "VISION" ? "#a1a1aa" : "#6ee7b7" }}>{l.tag}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="panel-bottom"><span>Statuses are live HTTP checks against this instance{checkedAt ? ` at ${checkedAt}` : ""}; a 200 means the endpoint answers, not that the layer is production-ready. L4 has no code to check.</span></div>
    </section>
  );
}
