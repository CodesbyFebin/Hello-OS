"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";
import { errText, j } from "@/components/ops/ops-fetch";

type F = { id: string; source: string; message: string; location: string; count: number; deadEnd: boolean; resolution: string; lastSeen: string; score?: number };

export default function FailuresPage() {
  const [failures, setFailures] = React.useState<F[]>([]);
  const [log, setLog] = React.useState("");
  const [q, setQ] = React.useState("");
  const [matches, setMatches] = React.useState<F[] | null>(null);
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => { try { setFailures((await j<{ failures: F[] }>("/api/failures")).failures); } catch (e) { setMsg(errText(e)); } }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  async function ingest() { try { const r = await j<{ ingested: number }>("/api/failures", { method: "POST", body: JSON.stringify({ log }) }); setMsg(`${r.ingested} failure signature(s) recorded.`); setLog(""); await load(); } catch (e) { setMsg(errText(e)); } }
  async function search() { try { setMatches((await j<{ matches: F[] }>(`/api/failures/similar?q=${encodeURIComponent(q)}`)).matches); } catch (e) { setMsg(errText(e)); } }
  async function resolve(id: string) {
    const resolution = window.prompt("How was this resolved?")?.slice(0, 2000);
    if (!resolution) return;
    try { await j(`/api/failures/${id}`, { method: "PATCH", body: JSON.stringify({ resolution }) }); await load(); } catch (e) { setMsg(errText(e)); }
  }

  return (
    <OpsFrame title="Failure library" subtitle="Paste tsc, eslint or node:test output. Failures are normalised into signatures and counted, and they stay dead ends until someone records a fix. Agents query /api/failures/similar before retrying.">
      <section className={opsCard}>
        <div className="mb-2 flex items-center gap-2 text-xs"><Badge kind="real">LOCAL DB</Badge><b className="text-white">Ingest log</b><button className={`${opsBtn} ml-auto`} disabled={!log} onClick={ingest}>Parse &amp; record</button></div>
        <textarea aria-label="Build or test log" value={log} onChange={(e) => setLog(e.target.value.slice(0, 500000))} rows={5} placeholder="src/x.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'." className="w-full rounded border border-white/10 bg-black/30 p-2 font-mono text-[11px]" />
        {msg && <p className="mt-1 text-xs text-zinc-400">{msg}</p>}
      </section>
      <section className={opsCard}>
        <div className="flex items-center gap-2 text-xs"><b className="text-white">Have we seen this before?</b><input aria-label="Error to look up" value={q} onChange={(e) => setQ(e.target.value.slice(0, 2000))} className="flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 font-mono" placeholder="paste a new error message" /><button className={opsBtn} disabled={!q} onClick={search}>Retrieve</button></div>
        {matches && <ul className="mt-2 space-y-1 text-xs">{matches.length === 0 ? <li className="text-zinc-500">No similar failures recorded.</li> : matches.map((m) => <li key={m.id}><span className="font-mono text-zinc-500">{m.score?.toFixed(2)}</span> {m.message} {m.resolution ? <span className="text-emerald-300">→ fix: {m.resolution}</span> : <span className="text-amber-300">(dead end, no fix yet)</span>}</li>)}</ul>}
      </section>
      <section className={opsCard}>
        <table className="w-full text-left text-xs"><thead className="text-zinc-500"><tr><th>source</th><th>message</th><th>seen</th><th>status</th><th /></tr></thead><tbody>
          {failures.map((f) => <tr key={f.id} className="border-t border-white/5 align-top"><td className="py-1.5 font-mono">{f.source}</td><td><div>{f.message}</div><div className="font-mono text-[10px] text-zinc-600">{f.location}</div></td><td>{f.count}×</td><td>{f.deadEnd ? <Badge kind="warn">DEAD END</Badge> : <span className="text-emerald-300">fixed: {f.resolution}</span>}</td><td>{f.deadEnd && <button className={opsBtn} onClick={() => resolve(f.id)}>Record fix</button>}</td></tr>)}
        </tbody></table>
      </section>
    </OpsFrame>
  );
}
