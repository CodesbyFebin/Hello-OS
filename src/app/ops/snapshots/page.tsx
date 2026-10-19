"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";
import { errText, j } from "@/components/ops/ops-fetch";

type Snap = { id: string; agentId: string; label: string; sha256: string; createdAt: string; resumedAt: string | null };
type Agent = { id: string; name: string };

export default function SnapshotsPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [snaps, setSnaps] = React.useState<Snap[]>([]);
  const [agentId, setAgentId] = React.useState("");
  const [task, setTask] = React.useState('{ "mission": "migrate schema", "step": 3, "of": 7 }');
  const [doc, setDoc] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => {
    try { const [a, s] = await Promise.all([j<{ agents: Agent[] }>("/api/agents?limit=100"), j<{ snapshots: Snap[] }>("/api/snapshots")]); setAgents(a.agents); setSnaps(s.snapshots); } catch (e) { setMsg(errText(e)); }
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  async function create() {
    try { const t = JSON.parse(task); const r = await j<{ sha256: string }>("/api/snapshots", { method: "POST", body: JSON.stringify({ agentId, task: t, label: "manual" }) }); setMsg(`Sealed ${r.sha256.slice(0, 16)}…`); await load(); }
    catch (e) { setMsg(errText(e)); }
  }
  async function exportSnap(id: string) { try { setDoc(JSON.stringify(await j(`/api/snapshots/${id}`), null, 2)); } catch (e) { setMsg(errText(e)); } }
  async function resume() {
    try { const d = JSON.parse(doc); const r = await j<{ restoredMemories: number; task: unknown }>("/api/snapshots/resume", { method: "POST", body: JSON.stringify(d) }); setMsg(`Resumed: ${r.restoredMemories} memories restored · task ${JSON.stringify(r.task)}`); await load(); }
    catch (e) { setMsg(errText(e)); }
  }

  return (
    <OpsFrame title="Checkpoints & resume" subtitle="A snapshot holds public identity, latest soul hash, working memories, wallet figures and your task state, sealed with SHA-256. It does not capture model internals, and resume never moves credits.">
      <section className={`${opsCard} flex flex-wrap items-center gap-2 text-xs`}>
        <Badge kind="real">LOCAL DB</Badge>
        <select aria-label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="rounded border border-white/10 bg-black/30 px-2 py-1"><option value="">agent…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <input aria-label="Task state JSON" value={task} onChange={(e) => setTask(e.target.value.slice(0, 2000))} className="w-96 rounded border border-white/10 bg-black/30 px-2 py-1 font-mono" />
        <button className={opsBtn} disabled={!agentId} onClick={create}>Seal snapshot</button>
      </section>
      {msg && <p className="text-xs text-zinc-400">{msg}</p>}
      <section className={opsCard}>
        <table className="w-full text-left text-xs"><thead className="text-zinc-500"><tr><th>when</th><th>agent</th><th>sha256</th><th>resumed</th><th /></tr></thead><tbody>
          {snaps.map((s) => <tr key={s.id} className="border-t border-white/5"><td className="py-1.5">{new Date(s.createdAt).toLocaleString()}</td><td className="font-mono">{agents.find((a) => a.id === s.agentId)?.name ?? s.agentId.slice(0, 8)}</td><td className="font-mono">{s.sha256.slice(0, 20)}…</td><td>{s.resumedAt ? new Date(s.resumedAt).toLocaleTimeString() : "—"}</td><td className="text-right"><button className={opsBtn} onClick={() => exportSnap(s.id)}>Export</button></td></tr>)}
        </tbody></table>
      </section>
      <section className={opsCard}>
        <div className="mb-2 flex items-center gap-2 text-xs"><b className="text-white">Portable document</b><span className="text-zinc-500">edit a byte and resume to see the seal check fail</span><button className={`${opsBtn} ml-auto`} disabled={!doc} onClick={resume}>Verify &amp; resume</button></div>
        <textarea aria-label="Snapshot JSON" value={doc} onChange={(e) => setDoc(e.target.value.slice(0, 200000))} rows={12} className="w-full rounded border border-white/10 bg-black/30 p-2 font-mono text-[11px]" />
      </section>
    </OpsFrame>
  );
}
