"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";
import { errText, j } from "@/components/ops/ops-fetch";

type Stats = { entries: number; lookups: number; hits: number; measuredHitRate: number | null };
type Look = { hit: boolean; score: number; response: string | null; matchedPrompt: string | null };
const input = "rounded border border-white/10 bg-black/30 px-2 py-1";

export default function CachePage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [p, setP] = React.useState(""); const [r, setR] = React.useState("");
  const [q, setQ] = React.useState(""); const [threshold, setThreshold] = React.useState("0.9");
  const [look, setLook] = React.useState<Look | null>(null); const [msg, setMsg] = React.useState("");
  const load = React.useCallback(async () => { try { setStats(await j<Stats>("/api/cache")); } catch (e) { setMsg(errText(e)); } }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);
  async function store() { try { await j("/api/cache", { method: "POST", body: JSON.stringify({ prompt: p, response: r }) }); setP(""); setR(""); setMsg("Stored."); await load(); } catch (e) { setMsg(errText(e)); } }
  async function lookup() { try { setLook(await j<Look>("/api/cache/lookup", { method: "POST", body: JSON.stringify({ prompt: q, threshold: Number(threshold) }) })); await load(); } catch (e) { setMsg(errText(e)); } }
  return (
    <OpsFrame title="Semantic cache" subtitle="Local hashed-trigram similarity, with no embedding model and no LLM calls. The hit rate below is counted from real lookups on this instance. No savings figure is claimed.">
      <section className={`${opsCard} flex flex-wrap gap-6 text-sm`}>
        <Badge kind="real">MEASURED</Badge>
        <span>entries <b className="text-white">{stats?.entries ?? "…"}</b></span><span>lookups <b className="text-white">{stats?.lookups ?? "…"}</b></span><span>hits <b className="text-white">{stats?.hits ?? "…"}</b></span>
        <span>measured hit rate <b className="text-white">{stats ? (stats.measuredHitRate === null ? "n/a (no lookups yet)" : `${(stats.measuredHitRate * 100).toFixed(1)}%`) : "…"}</b></span>
      </section>
      <section className={`${opsCard} grid gap-2 text-xs`}>
        <b className="text-white">Store a response</b>
        <input aria-label="Prompt" value={p} onChange={(e) => setP(e.target.value.slice(0, 8000))} placeholder="prompt" className={input} />
        <textarea aria-label="Response" value={r} onChange={(e) => setR(e.target.value.slice(0, 32000))} placeholder="response" rows={2} className={input} />
        <button className={`${opsBtn} w-fit`} disabled={!p || !r} onClick={store}>Store</button>
      </section>
      <section className={`${opsCard} grid gap-2 text-xs`}>
        <div className="flex items-center gap-2"><b className="text-white">Lookup</b> threshold <input aria-label="Threshold" value={threshold} onChange={(e) => setThreshold(e.target.value.slice(0, 5))} className={`${input} w-16`} /></div>
        <input aria-label="Lookup prompt" value={q} onChange={(e) => setQ(e.target.value.slice(0, 8000))} placeholder="new prompt" className={input} />
        <button className={`${opsBtn} w-fit`} disabled={!q} onClick={lookup}>Look up</button>
        {look && <div className={look.hit ? "text-emerald-300" : "text-zinc-400"}>{look.hit ? `HIT (similarity ${look.score}) · matched “${look.matchedPrompt}” → ${look.response}` : `MISS (best similarity ${look.score})`}</div>}
        {msg && <p className="text-zinc-500">{msg}</p>}
      </section>
    </OpsFrame>
  );
}