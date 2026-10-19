"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";

type Run = { id: string; ok: boolean; output: string; durationMs: number; createdAt: string };
type Job = { id: string; name: string; kind: string; intervalSec: number; enabled: boolean; nextRunAt: string; lastRunAt: string | null; lastOk: boolean | null; runCount: number; runs: Run[] };

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`);
  return b as T;
}

export default function SchedulerPage() {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [kinds, setKinds] = React.useState<string[]>([]);
  const [kind, setKind] = React.useState("heartbeat");
  const [interval, setIntervalSec] = React.useState("60");
  const [auto, setAuto] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => {
    try { const r = await j<{ jobs: Job[]; kinds: string[] }>("/api/scheduler/jobs"); setJobs(r.jobs); setKinds(r.kinds); } catch (e) { setMsg(String(e)); }
  }, []);
  const doTick = React.useCallback(async () => {
    try { const r = await j<{ due: number; ranAt: string }>("/api/scheduler/tick", { method: "POST" }); setMsg(`Tick at ${new Date(r.ranAt).toLocaleTimeString()}: ${r.due} job(s) due`); await load(); } catch (e) { setMsg(String(e)); }
  }, [load]);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);
  React.useEffect(() => { if (!auto) return; const t = window.setInterval(() => { void doTick(); }, 10000); return () => window.clearInterval(t); }, [auto, doTick]);

  async function add() {
    try { await j("/api/scheduler/jobs", { method: "POST", body: JSON.stringify({ kind, intervalSec: Number(interval) }) }); await load(); } catch (e) { setMsg(String(e)); }
  }
  async function patch(id: string, body: Record<string, unknown>) { try { await j(`/api/scheduler/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) }); await load(); } catch (e) { setMsg(String(e)); } }

  return (
    <OpsFrame title="Heartbeat scheduler" subtitle="Jobs run when a tick arrives: POST /api/scheduler/tick from system cron or CI, or the auto-tick toggle below (only while this page is open). There is no hidden background daemon.">
      <section className={`${opsCard} flex flex-wrap items-center gap-2 text-xs`}>
        <Badge kind="real">LOCAL DB</Badge>
        <select aria-label="Job kind" value={kind} onChange={(e) => setKind(e.target.value)} className="rounded border border-white/10 bg-black/30 px-2 py-1">{kinds.map((k) => <option key={k}>{k}</option>)}</select>
        <input aria-label="Interval seconds" value={interval} onChange={(e) => setIntervalSec(e.target.value.slice(0, 8))} className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1" /> sec
        <button className={opsBtn} onClick={add}>Add job</button>
        <span className="mx-2 h-4 w-px bg-white/10" />
        <button className={opsBtn} onClick={doTick}>Tick now</button>
        <label className="flex items-center gap-1"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> auto-tick every 10s</label>
        {msg && <span className="ml-auto text-zinc-400">{msg}</span>}
      </section>
      {jobs.length === 0 && <p className="text-xs text-zinc-500">No jobs yet.</p>}
      {jobs.map((job) => (
        <section key={job.id} className={opsCard}>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <b className="text-sm text-white">{job.name}</b><span className="font-mono text-zinc-400">{job.kind}</span><span>every {job.intervalSec}s</span>
            <span>runs: {job.runCount}</span><span>next: {new Date(job.nextRunAt).toLocaleTimeString()}</span>
            {job.lastOk !== null && <Badge kind={job.lastOk ? "real" : "warn"}>{job.lastOk ? "LAST RUN OK" : "LAST RUN FAILED"}</Badge>}
            <span className="ml-auto space-x-1"><button className={opsBtn} onClick={() => patch(job.id, { runNow: true })}>Due now</button><button className={opsBtn} onClick={() => patch(job.id, { enabled: !job.enabled })}>{job.enabled ? "Disable" : "Enable"}</button></span>
          </div>
          <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-zinc-400">{job.runs.map((r) => <li key={r.id}><span className="text-zinc-600">{new Date(r.createdAt).toLocaleTimeString()}</span> {r.ok ? "ok" : "fail"} {r.durationMs}ms {r.output}</li>)}</ul>
        </section>
      ))}
    </OpsFrame>
  );
}
