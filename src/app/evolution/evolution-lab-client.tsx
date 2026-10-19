"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowLeft, BookOpen, BrainCircuit, CircleAlert, GitBranch, Pause, Play, RefreshCw, Users, WandSparkles } from "lucide-react";

type Stats = { counts: { agents: number; activeAgents: number; missions: number; openMissions: number; traces: number; memories: number } };
type Person = { id: string; name: string; did?: string; avatar?: string | null; guardianTier?: string };
type Apprenticeship = { id: string; status: string; procedure?: string | null; createdAt?: string; mentor?: Person | null; apprentice?: Person | null };
type CurriculumNode = { id: string; label: string; parent: string | null; difficulty: string };
type LabData = { stats: Stats; apprenticeships: Apprenticeship[]; curriculum: CurriculumNode[] };
type Candidate = { id: string; genes: Record<string, number>; fitness: number; parentIds: string[]; mutations: number };
type Generation = { id: string; generation: number; bestFitness: number; averageFitness: number; mutationCount: number; populationJson: string; championJson: string; createdAt: string };
type EvolutionRun = { id: string; name: string; profile: string; status: string; populationSize: number; mutationRate: number; generationLimit: number; currentGeneration: number; bestFitness: number; seed: number; createdAt: string; generations?: Generation[] };
const compact = (n: number) => new Intl.NumberFormat("en", { notation: n > 999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
const geneNames = ["reasoning", "coding", "memory", "collaboration"];

export function EvolutionLabClient() {
  const [data, setData] = React.useState<LabData | null>(null);
  const [runs, setRuns] = React.useState<EvolutionRun[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [selected, setSelected] = React.useState<EvolutionRun | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const stopRef = React.useRef(false);
  const selectedIdRef = React.useRef("");
  selectedIdRef.current = selectedId;
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null);
  const [name, setName] = React.useState("Balanced baseline");
  const [profile, setProfile] = React.useState("balanced");

  const loadDetail = React.useCallback(async (id: string) => {
    if (!id) { setSelected(null); return; }
    const response = await fetch(`/api/evolution/runs/${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Could not load run (HTTP ${response.status}).`);
    setSelected(result.run as EvolutionRun);
  }, []);

  const refresh = React.useCallback(async (preferId?: string) => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }),
        fetch("/api/evolution/apprenticeships", { cache: "no-store" }),
        fetch("/api/evolution/curriculum", { cache: "no-store" }),
        fetch("/api/evolution/runs", { cache: "no-store" }),
      ]);
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error(`HELLO OS API returned HTTP ${failed.status}. Apply the database schema, start the app, then refresh.`);
      const [stats, apprenticeshipResult, curriculumResult, runResult] = await Promise.all(responses.map((response) => response.json()));
      setData({
        stats: stats as Stats,
        apprenticeships: (apprenticeshipResult.apprenticeships || []) as Apprenticeship[],
        curriculum: (curriculumResult.tree || []) as CurriculumNode[],
      });
      const nextRuns = (runResult.runs || []) as EvolutionRun[];
      setRuns(nextRuns);
      const currentId = selectedIdRef.current;
      const nextId = preferId || (nextRuns.some((run) => run.id === currentId) ? currentId : nextRuns[0]?.id || "");
      selectedIdRef.current = nextId;
      setSelectedId(nextId);
      if (nextId) await loadDetail(nextId);
      else setSelected(null);
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load evolution data.");
    } finally {
      setLoading(false);
    }
  }, [loadDetail]);

  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load the selected run."));
  }, [selectedId, loadDetail]);

  const createRun = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/evolution/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, profile, populationSize: 16, mutationRate: 0.12, generationLimit: 12 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create the run.");
      setName("");
      await refresh(result.run.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the run.");
    } finally {
      setSaving(false);
    }
  };

  const step = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/evolution/runs/${encodeURIComponent(selected.id)}/step`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not advance generation.");
      await refresh(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not advance generation.");
    } finally {
      setSaving(false);
    }
  };

  const setRunStatus = async (action: "pause" | "resume") => {
    if (!selected) return;
    if (action === "pause") stopRef.current = true;
    setError("");
    try {
      const response = await fetch(`/api/evolution/runs/${encodeURIComponent(selected.id)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update run status.");
      await refresh(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update run status.");
    }
  };

  const runToEnd = async () => {
    if (!selected || running) return;
    stopRef.current = false;
    setRunning(true);
    setError("");
    try {
      while (!stopRef.current) {
        const response = await fetch(`/api/evolution/runs/${encodeURIComponent(selected.id)}/step`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 409 && stopRef.current) break;
          throw new Error(result.error || "Could not advance generation.");
        }
        setSelected((current) => current ? { ...current, currentGeneration: result.generation.generation, bestFitness: result.generation.bestFitness, status: result.run.status, generations: [result.generation, ...(current.generations || [])].slice(0, 50) } : current);
        if (result.run.status === "completed") break;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      await refresh(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Run stopped unexpectedly.");
    } finally {
      setRunning(false);
    }
  };

  const counts = data?.stats.counts;
  const graduated = data?.apprenticeships.filter((item) => item.status === "graduated").length ?? 0;
  const inProgress = data?.apprenticeships.filter((item) => !["graduated", "cancelled"].includes(item.status)).length ?? 0;
  const generations = [...(selected?.generations || [])].sort((a, b) => a.generation - b.generation);
  const latest = generations.at(-1);
  let population: Candidate[] = [];
  try { population = latest ? JSON.parse(latest.populationJson) as Candidate[] : []; } catch { population = []; }

  return (
    <main className="min-h-screen bg-[#05060a] text-slate-200">
      <div className="border-b border-white/10 bg-black/40 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-mono text-xs font-bold tracking-[.16em] text-emerald-300"><ArrowLeft size={15} aria-hidden="true" /> HELLO OS</Link>
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-amber-300" : error ? "bg-rose-300" : "bg-emerald-300"}`} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{loading ? "Loading API data" : error ? "API issue" : "Database connected"}</span>
            <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh evolution data" className="rounded border border-white/10 p-2 text-slate-400 hover:text-white disabled:opacity-40"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
        <p className="mb-3 font-mono text-xs uppercase tracking-[.22em] text-emerald-300">HELLO://EVOLUTION-LAB</p>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Run evolution experiments you can inspect.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-400">Create a bounded optimization run, evolve its population one generation at a time, and inspect every saved candidate and score.</p>
          </div>
          <div className="font-mono text-[10px] text-slate-500">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Waiting for data"}</div>
        </div>

        <div className="mt-7 rounded-xl border border-amber-300/25 bg-amber-300/[.05] p-4 text-sm leading-6 text-amber-100/80">
          <strong className="text-amber-100">What this evolves:</strong> a seeded synthetic gene vector scored against a selectable test objective. Fitness is a mathematical proxy for that objective, not an AI benchmark. Runs do not train models, change model weights, or alter live HELLO agents.
        </div>

        {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[.05] p-4 text-sm text-rose-200"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}

        <section aria-label="Current application metrics" className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Users size={16} />} label="Agent records" value={counts ? compact(counts.agents) : "—"} detail={counts ? `${compact(counts.activeAgents)} marked active` : "API data required"} />
          <Metric icon={<Activity size={16} />} label="Mission records" value={counts ? compact(counts.missions) : "—"} detail={counts ? `${compact(counts.openMissions)} open` : "API data required"} />
          <Metric icon={<BrainCircuit size={16} />} label="Apprenticeships" value={data ? compact(data.apprenticeships.length) : "—"} detail={data ? `${inProgress} in progress · ${graduated} graduated` : "API data required"} />
          <Metric icon={<BookOpen size={16} />} label="Curriculum nodes" value={data ? compact(data.curriculum.length) : "—"} detail={counts ? `${compact(counts.traces)} traces · ${compact(counts.memories)} memories` : "Workspace records"} />
        </section>

        <section className="mt-8 rounded-2xl border border-emerald-300/20 bg-[#0a0b14] p-5 md:p-7" aria-labelledby="optimizer-title">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div><div className="flex items-center gap-2 text-emerald-300"><WandSparkles size={18} /><span className="font-mono text-[10px] uppercase tracking-[.18em]">Persistent optimizer</span></div><h2 id="optimizer-title" className="mt-2 text-2xl font-semibold text-white">Evolution runs</h2><p className="mt-1 text-sm text-slate-500">Seeded selection, crossover, bounded mutation, and generation snapshots stored in the HELLO OS database.</p></div>
            <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase text-slate-400">{runs.length} recent runs</span>
          </div>

          <form onSubmit={createRun} className="mt-5 grid gap-3 sm:grid-cols-[1fr_190px_auto]">
            <label className="sr-only" htmlFor="run-name">Experiment name</label>
            <input id="run-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="Experiment name" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50" />
            <label className="sr-only" htmlFor="run-profile">Optimization profile</label>
            <select id="run-profile" value={profile} onChange={(event) => setProfile(event.target.value)} className="rounded-lg border border-white/10 bg-[#10111a] px-3 py-2 text-sm text-white">
              {["balanced", "reasoning", "coding", "memory", "collaboration"].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)} objective</option>)}
            </select>
            <button disabled={saving || loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"><WandSparkles size={15} />{saving ? "Saving…" : "Create run"}</button>
          </form>
          <p className="mt-2 text-[11px] text-slate-600">Defaults: population 16 · mutation 12% per gene · 12 generations · server-generated seed. API bounds population to 8–64 and runs to 100 generations.</p>

          <div className="mt-6 grid gap-5 xl:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Saved experiments</h3>
              {runs.length ? <ul className="mt-2 space-y-2">{runs.map((run) => <li key={run.id}><button onClick={() => setSelectedId(run.id)} className={`w-full rounded-lg border p-3 text-left ${selectedId === run.id ? "border-emerald-300/40 bg-emerald-300/[.06]" : "border-white/[.07] bg-white/[.02] hover:border-white/20"}`}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm text-slate-200">{run.name}</span><span className="font-mono text-[9px] uppercase text-slate-500">{run.status}</span></span><span className="mt-1 block font-mono text-[10px] text-slate-500">gen {run.currentGeneration}/{run.generationLimit} · proxy {run.bestFitness.toFixed(2)}</span></button></li>)}</ul> : <div className="mt-2 rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-500">{loading ? "Loading saved runs…" : "Create your first experiment."}</div>}
            </div>

            <div className="rounded-xl border border-white/[.07] bg-black/20 p-4 md:p-5">
              {selected ? <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h3 className="text-lg font-semibold text-white">{selected.name}</h3><p className="mt-1 font-mono text-[10px] uppercase text-slate-500">{selected.profile} objective · seed {selected.seed} · population {selected.populationSize}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "active" && <button type="button" onClick={() => void step()} disabled={saving || running} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">Step one generation</button>}
                    {selected.status === "active" && !running && <button type="button" onClick={() => void runToEnd()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950"><Play size={13} />Run to finish</button>}
                    {selected.status === "active" && <button type="button" onClick={() => void setRunStatus("pause")} className="inline-flex items-center gap-2 rounded-lg border border-amber-300/20 px-3 py-2 text-xs text-amber-100"><Pause size={13} />Pause</button>}
                    {selected.status === "paused" && <button type="button" onClick={() => void setRunStatus("resume")} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 px-3 py-2 text-xs text-emerald-100"><Play size={13} />Resume</button>}
                    {running && <span className="rounded-lg border border-emerald-300/20 px-3 py-2 text-xs text-emerald-200">Evolving…</span>}
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <Mini label="Status" value={selected.status} />
                  <Mini label="Generation" value={`${selected.currentGeneration} / ${selected.generationLimit}`} />
                  <Mini label="Best proxy score" value={selected.bestFitness.toFixed(2)} />
                  <Mini label="Latest mean" value={latest ? latest.averageFitness.toFixed(2) : "—"} />
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
                  <div><h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Generation history</h4>
                    <div className="mt-3 space-y-2">{generations.map((generation) => <div key={generation.id} className="grid grid-cols-[48px_1fr_52px] items-center gap-2 text-[10px]"><span className="font-mono text-slate-500">G{generation.generation}</span><div className="h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(100, generation.bestFitness)}%` }} /></div><span className="text-right font-mono text-slate-300">{generation.bestFitness.toFixed(1)}</span></div>)}</div>
                  </div>
                  <div><h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Latest candidate vectors</h4>
                    <div className="mt-3 overflow-x-auto rounded-lg border border-white/[.06]"><table className="w-full min-w-[430px] text-left text-[10px]"><thead className="bg-white/[.03] font-mono uppercase text-slate-500"><tr><th className="p-2">Candidate</th>{geneNames.map((gene) => <th key={gene} className="p-2">{gene.slice(0, 4)}</th>)}<th className="p-2">Proxy</th></tr></thead><tbody>{[...population].sort((a, b) => b.fitness - a.fitness).slice(0, 8).map((candidate) => <tr key={candidate.id} className="border-t border-white/[.05] text-slate-300"><td className="p-2 font-mono">{candidate.id}</td>{geneNames.map((gene) => <td key={gene} className="p-2 tabular-nums">{candidate.genes[gene].toFixed(2)}</td>)}<td className="p-2 font-mono text-emerald-200">{candidate.fitness.toFixed(1)}</td></tr>)}</tbody></table></div>
                    <p className="mt-2 text-[10px] text-slate-600">Showing the top 8 of {population.length} saved vectors. Mutation count this generation: {latest?.mutationCount ?? 0}.</p>
                  </div>
                </div>
              </> : <div className="flex min-h-56 items-center justify-center text-sm text-slate-500">{loading ? "Loading run…" : "Select or create a run to inspect generations."}</div>}
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-[#0a0b14] p-5" aria-labelledby="curriculum-title">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4"><BookOpen className="text-emerald-300" size={18} /><div><h2 id="curriculum-title" className="font-mono text-sm font-semibold text-white">Curriculum Commons</h2><p className="mt-1 text-xs text-slate-500">Skill definitions from the curriculum API</p></div></div>
            {data?.curriculum.length ? <ul className="mt-4 space-y-2">{data.curriculum.map((node) => <li key={node.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/[.06] bg-white/[.02] p-3"><div className="min-w-0"><p className="truncate text-sm text-slate-200">{node.label}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-500">{node.id}{node.parent ? ` · requires ${node.parent}` : " · root skill"}</p></div><span className="shrink-0 rounded-full border border-white/10 px-2 py-1 font-mono text-[9px] uppercase text-slate-400">{node.difficulty}</span></li>)}</ul> : <Empty loading={loading} error={!!error} text="No curriculum data returned." />}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0a0b14] p-5" aria-labelledby="apprenticeship-title">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4"><GitBranch className="text-violet-300" size={18} /><div><h2 id="apprenticeship-title" className="font-mono text-sm font-semibold text-white">Apprenticeships</h2><p className="mt-1 text-xs text-slate-500">Mentor and apprentice records from the database</p></div></div>
            {data?.apprenticeships.length ? <ul className="mt-4 space-y-2">{data.apprenticeships.slice(0, 8).map((item) => <li key={item.id} className="rounded-lg border border-white/[.06] bg-white/[.02] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-200">{item.mentor?.name ?? "Unknown mentor"} <span className="text-slate-600">→</span> {item.apprentice?.name ?? "Unknown apprentice"}</p><span className="rounded-full border border-violet-300/20 px-2 py-1 font-mono text-[9px] uppercase text-violet-200">{item.status}</span></div><p className="mt-2 break-all font-mono text-[10px] text-slate-500">record {item.id}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ""}</p></li>)}</ul> : <Empty loading={loading} error={!!error} text="No apprenticeship records yet." />}
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm">
          <Link href="/ecosystem" className="text-emerald-200 hover:text-emerald-100">Open Ecosystem dashboard</Link>
          <Link href="/universe" className="text-emerald-200 hover:text-emerald-100">Explore HELLO OS universe</Link>
          <Link href="https://codesbyfebin.github.io/Hello-OS/agent-guide/" className="text-emerald-200 hover:text-emerald-100">Agent Guide</Link>
          <Link href="https://github.com/CodesbyFebin/Hello-OS/tree/main/src/app/api/evolution" className="text-slate-400 hover:text-white">Evolution API source</Link>
        </div>
      </div>
    </main>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-white/10 bg-[#0a0b14] p-4"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">{icon}{label}</div><p className="mt-3 font-mono text-2xl text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-3"><p className="font-mono text-[9px] uppercase text-slate-500">{label}</p><p className="mt-1 truncate font-mono text-sm text-slate-200">{value}</p></div>;
}
function Empty({ loading, error, text }: { loading: boolean; error: boolean; text: string }) {
  return <div className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-500">{loading ? "Loading records…" : error ? "Unavailable while the API is offline." : text}</div>;
}
