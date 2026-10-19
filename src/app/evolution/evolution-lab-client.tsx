"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowLeft, BookOpen, BrainCircuit, CircleAlert, GitBranch, RefreshCw, Users } from "lucide-react";

type Stats = { counts: { agents: number; activeAgents: number; missions: number; openMissions: number; traces: number; memories: number } };
type Person = { id: string; name: string; did?: string; avatar?: string | null; guardianTier?: string };
type Apprenticeship = { id: string; status: string; procedure?: string | null; createdAt?: string; mentor?: Person | null; apprentice?: Person | null };
type CurriculumNode = { id: string; label: string; parent: string | null; difficulty: string };
type LabData = { stats: Stats; apprenticeships: Apprenticeship[]; curriculum: CurriculumNode[] };

const compact = (n: number) => new Intl.NumberFormat("en", { notation: n > 999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

export function EvolutionLabClient() {
  const [data, setData] = React.useState<LabData | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }),
        fetch("/api/evolution/apprenticeships", { cache: "no-store" }),
        fetch("/api/evolution/curriculum", { cache: "no-store" }),
      ]);
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error(`HELLO OS API returned HTTP ${failed.status}. Start the app and database, then refresh.`);
      const [stats, apprenticeshipResult, curriculumResult] = await Promise.all(responses.map((response) => response.json()));
      setData({
        stats: stats as Stats,
        apprenticeships: (apprenticeshipResult.apprenticeships || []) as Apprenticeship[],
        curriculum: (curriculumResult.tree || []) as CurriculumNode[],
      });
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load evolution data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const counts = data?.stats.counts;
  const graduated = data?.apprenticeships.filter((item) => item.status === "graduated").length ?? 0;
  const inProgress = data?.apprenticeships.filter((item) => !["graduated", "cancelled"].includes(item.status)).length ?? 0;

  return (
    <main className="min-h-screen bg-[#05060a] text-slate-200">
      <div className="border-b border-white/10 bg-black/40 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-mono text-xs font-bold tracking-[.16em] text-emerald-300"><ArrowLeft size={15} aria-hidden="true" /> HELLO OS</Link>
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-amber-300" : error ? "bg-rose-300" : "bg-emerald-300"}`} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{loading ? "Loading API data" : error ? "API unavailable" : "Connected to app APIs"}</span>
            <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh evolution data" className="rounded border border-white/10 p-2 text-slate-400 hover:text-white disabled:opacity-40"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
        <p className="mb-3 font-mono text-xs uppercase tracking-[.22em] text-emerald-300">HELLO://EVOLUTION-LAB</p>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Learning systems, made inspectable.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-400">A live view of the agent, apprenticeship, and skill-curriculum records exposed by the HELLO OS application. The page reads current API data; it does not simulate evolution.</p>
          </div>
          <div className="font-mono text-[10px] text-slate-500">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Waiting for data"}</div>
        </div>

        <div className="mt-7 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-4 text-sm leading-6 text-cyan-100/80">
          <strong className="text-cyan-100">Scope:</strong> This view reports database-backed counts and curriculum definitions. It does not train or mutate model weights, run tournaments, spawn Firecracker microVMs, or claim that agents automatically become more capable.
        </div>

        {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[.05] p-4 text-sm text-rose-200"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}

        <section aria-label="Current application metrics" className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Users size={16} />} label="Agent records" value={counts ? compact(counts.agents) : "—"} detail={counts ? `${compact(counts.activeAgents)} marked active` : "API data required"} />
          <Metric icon={<Activity size={16} />} label="Mission records" value={counts ? compact(counts.missions) : "—"} detail={counts ? `${compact(counts.openMissions)} open` : "API data required"} />
          <Metric icon={<BrainCircuit size={16} />} label="Apprenticeships" value={data ? compact(data.apprenticeships.length) : "—"} detail={data ? `${inProgress} in progress · ${graduated} graduated` : "API data required"} />
          <Metric icon={<BookOpen size={16} />} label="Curriculum nodes" value={data ? compact(data.curriculum.length) : "—"} detail={counts ? `${compact(counts.traces)} traces · ${compact(counts.memories)} memories` : "Workspace records"} />
        </section>

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-[#0a0b14] p-5" aria-labelledby="curriculum-title">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4"><BookOpen className="text-emerald-300" size={18} /><div><h2 id="curriculum-title" className="font-mono text-sm font-semibold text-white">Curriculum Commons</h2><p className="mt-1 text-xs text-slate-500">Skill definitions from the curriculum API</p></div></div>
            {data?.curriculum.length ? <ul className="mt-4 space-y-2">{data.curriculum.map((node) => <li key={node.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/[.06] bg-white/[.02] p-3">
              <div className="min-w-0"><p className="truncate text-sm text-slate-200">{node.label}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-500">{node.id}{node.parent ? ` · requires ${node.parent}` : " · root skill"}</p></div>
              <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 font-mono text-[9px] uppercase text-slate-400">{node.difficulty}</span>
            </li>)}</ul> : <Empty loading={loading} error={!!error} text="No curriculum data returned." />}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0a0b14] p-5" aria-labelledby="apprenticeship-title">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4"><GitBranch className="text-violet-300" size={18} /><div><h2 id="apprenticeship-title" className="font-mono text-sm font-semibold text-white">Apprenticeships</h2><p className="mt-1 text-xs text-slate-500">Mentor and apprentice records from the database</p></div></div>
            {data?.apprenticeships.length ? <ul className="mt-4 space-y-2">{data.apprenticeships.map((item) => <li key={item.id} className="rounded-lg border border-white/[.06] bg-white/[.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-200">{item.mentor?.name ?? "Unknown mentor"} <span className="text-slate-600">→</span> {item.apprentice?.name ?? "Unknown apprentice"}</p><span className="rounded-full border border-violet-300/20 px-2 py-1 font-mono text-[9px] uppercase text-violet-200">{item.status}</span></div>
              <p className="mt-2 break-all font-mono text-[10px] text-slate-500">record {item.id}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ""}</p>
            </li>)}</ul> : <Empty loading={loading} error={!!error} text="No apprenticeship records yet." />}
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#0a0b14] p-5">
          <h2 className="font-mono text-sm font-semibold text-white">What the current records mean</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Info title="Agent activity" body="Counts come from the HELLO OS stats API and reflect records in the configured database. Empty or zero values can be normal for a fresh workspace." />
            <Info title="Curriculum" body="The curriculum endpoint currently returns a defined skill tree and optional per-agent progress. A listed skill is not evidence that an agent has passed it." />
            <Info title="Apprenticeship" body="The records API lists mentor-apprentice relationships and their stored status. This page is read-only and does not create or graduate records." />
          </div>
        </section>

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
function Empty({ loading, error, text }: { loading: boolean; error: boolean; text: string }) {
  return <div className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-500">{loading ? "Loading records…" : error ? "Unavailable while the API is offline." : text}</div>;
}
function Info({ title, body }: { title: string; body: string }) {
  return <article className="rounded-lg border border-white/[.06] bg-white/[.02] p-4"><h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-300">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p></article>;
}
