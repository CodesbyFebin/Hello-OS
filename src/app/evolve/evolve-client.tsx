"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FlaskConical, Pause, Play, RotateCcw, StepForward, Swords, TriangleAlert } from "lucide-react";
import { HubShell, DemoBadge, RealBadge, card, kicker } from "@/components/hub/hub-shell";
import { GENE_NAMES, createInitialPopulation, createRandom, evolvePopulation, rankPopulation, summarizePopulation, type Candidate, type Profile } from "@/lib/evolution";

const POP = 32;
const MUTATION = 0.12;
const PROFILE: Profile = "balanced";
const MAX_GEN = 200;

type Snapshot = { generation: number; best: number; avg: number; mutations: number; champion: Candidate; population: Candidate[] };
type Fact = { gen: number; type: "mutation" | "archive" | "champion"; text: string };
type Run = { id: string; name: string; profile: string; status: string; currentGeneration: number; bestFitness: number; populationSize: number; updatedAt?: string };

function snapshot(generation: number, population: Candidate[], mutations: number): Snapshot {
  const s = summarizePopulation(population);
  return { generation, best: s.bestFitness, avg: s.averageFitness, mutations, champion: s.champion as Candidate, population };
}

export function EvolveClient() {
  const [seed, setSeed] = React.useState(20261020);
  const [snaps, setSnaps] = React.useState<Snapshot[]>(() => [snapshot(0, createInitialPopulation(POP, PROFILE, 20261020), 0)]);
  const [playing, setPlaying] = React.useState(false);
  const [view, setView] = React.useState<number | null>(null); // null = follow latest
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"sim" | "runs">("sim");
  const [runs, setRuns] = React.useState<Run[] | null>(null);
  const [runsError, setRunsError] = React.useState("");
  const [output, setOutput] = React.useState<string[]>(["Simulation state is in this browser tab; no database is queried."]);

  const facts = React.useMemo(() => {
    const out: Fact[] = [];
    for (let i = snaps.length - 1; i > 0 && out.length < 300; i -= 1) {
      const s = snaps[i], prev = snaps[i - 1];
      if (s.best > prev.best) out.push({ gen: s.generation, type: "champion", text: `new best ${s.champion.id} · ${s.best.toFixed(2)}` });
      out.push({ gen: s.generation, type: "mutation", text: `${s.mutations} gene mutations` });
      out.push({ gen: s.generation, type: "archive", text: `${POP - 1} candidates replaced` });
    }
    return out;
  }, [snaps]);
  const latest = snaps[snaps.length - 1];
  const shown = view === null ? latest : snaps[view];
  const ranked = React.useMemo(() => rankPopulation(shown.population), [shown]);
  const selected = ranked.find((c) => c.id === selectedId) ?? ranked[0];

  const step = React.useCallback(() => {
    setSnaps((prev) => {
      const last = prev[prev.length - 1];
      if (last.generation >= MAX_GEN) return prev;
      const g = last.generation + 1;
      const { population, mutationCount } = evolvePopulation(last.population, g, POP, MUTATION, PROFILE, seed);
      const next = snapshot(g, population, mutationCount);
      return [...prev, next];
    });
  }, [seed]);

  React.useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(step, 700);
    return () => window.clearInterval(t);
  }, [playing, step]);

  function reset() {
    const s = (seed * 1103515245 + 12345) % 2147483647;
    setPlaying(false); setSeed(s); setView(null); setSelectedId(null);
    setSnaps([snapshot(0, createInitialPopulation(POP, PROFILE, s), 0)]);
  }

  async function loadRuns() {
    setMode("runs");
    try { const r = await fetch("/api/evolution/runs", { cache: "no-store" }); if (!r.ok) throw new Error(String(r.status)); const j = await r.json(); setRuns(j.runs ?? []); setRunsError(""); }
    catch (e) { setRunsError(`Could not load saved runs (${e instanceof Error ? e.message : "error"}).`); setRuns([]); }
  }

  const match = React.useMemo(() => {
    const r = createRandom((seed ^ (shown.generation * 2654435761)) >>> 0);
    const a = ranked[Math.floor(r() * ranked.length)], b = ranked[Math.floor(r() * ranked.length)];
    return { a, b, winner: a.fitness >= b.fitness ? a : b };
  }, [ranked, seed, shown.generation]);

  function runQuery(q: string) {
    const key = q.trim().toLowerCase();
    const lines: Record<string, () => string[]> = {
      recent: () => facts.slice(0, 10).map((f) => `[G${f.gen}] ${f.type}: ${f.text}`),
      mutations: () => { const m = facts.filter((f) => f.type === "mutation"); return [`${m.length} mutation events`, ...m.slice(0, 5).map((f) => `  G${f.gen} ${f.text}`)]; },
      dead_ends: () => [`${facts.filter((f) => f.type === "archive").length} replacement events`],
      champions: () => rankPopulation(latest.population).slice(0, 5).map((c, i) => `  ${i + 1}. ${c.id} · fitness ${c.fitness.toFixed(2)}`),
    };
    const result = lines[key] ? lines[key]() : [`unknown query: ${q.slice(0, 60)}`, "try: recent, mutations, dead_ends, champions"];
    setOutput((o) => [...o, `simulation query: ${q}`, ...(result.length ? result : ["(no rows yet: run a few generations)"])].slice(-60));
  }

  const chart = snaps.slice(-60);
  const path = (k: "best" | "avg") => chart.map((s, i) => `${i ? "L" : "M"}${(i / Math.max(1, chart.length - 1)) * 300},${200 - (s[k] / 100) * 190}`).join(" ");
  const idx = view ?? snaps.length - 1;
  const delta = snaps.length > 1 ? latest.best - snaps[0].best : 0;

  return (
    <HubShell active="evolve">
      <div className="sticky top-[57px] z-20 border-b border-amber-400/30 bg-[#1a1405]/95 px-4 py-2 text-center text-xs text-amber-200" role="note">
        <TriangleAlert size={13} className="mr-1 inline" /><b>SIMULATION: not live agents.</b> These are candidate genomes scored by a toy fitness function in your browser. No models run and nothing here is a benchmark.
      </div>
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={kicker}>HELLO EVOLVE · LAB</div>
            <h1 className="mt-1 font-mono text-4xl font-bold tracking-tight text-white md:text-5xl">Agents don&apos;t get built.<br /><span className="text-[#43e6a5]">They evolve.</span> <span className="text-base text-zinc-500">(simulated)</span></h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">A seeded genetic algorithm using HELLO OS&apos;s <code>src/lib/evolution.ts</code>. The best candidate is kept each generation (elitism), and the rest are bred by tournament selection and mutation.</p>
          </div>
          <div className="flex gap-2">
            <div role="group" aria-label="Data source" className="flex rounded-md border border-white/10 p-0.5 text-xs">
              <button aria-pressed={mode === "sim"} onClick={() => setMode("sim")} className={`rounded px-3 py-1 ${mode === "sim" ? "bg-white/10 text-white" : "text-zinc-500"}`}>Simulation</button>
              <button aria-pressed={mode === "runs"} onClick={() => void loadRuns()} className={`rounded px-3 py-1 ${mode === "runs" ? "bg-white/10 text-white" : "text-zinc-500"}`}>Saved runs (API)</button>
            </div>
          </div>
        </section>

        {mode === "runs" && (
          <section className={`${card} p-4`}>
            <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2"><span className={kicker}>SAVED EVOLUTION RUNS</span><RealBadge /></span><Link href="/evolution" className="text-xs text-[#43e6a5] hover:underline">Create or step runs in the Evolution Lab →</Link></div>
            <p className="mb-3 text-xs text-zinc-500">From <code>/api/evolution/runs</code>. These runs are deterministic proxy-fitness experiments stored in the local database. They are not model evaluations.</p>
            {runsError && <p className="text-xs text-rose-400">{runsError}</p>}
            {runs === null ? <p className="text-xs text-zinc-500">Loading…</p> : runs.length === 0 ? <p className="text-xs text-zinc-500">No saved runs yet.</p> : (
              <table className="w-full text-left text-xs"><thead className="text-zinc-500"><tr><th className="py-1">Name</th><th>Profile</th><th>Status</th><th>Generation</th><th>Best fitness</th><th>Population</th></tr></thead>
                <tbody>{runs.map((r) => <tr key={r.id} className="border-t border-white/[.05]"><td className="py-1.5 text-white">{r.name}</td><td>{r.profile}</td><td>{r.status}</td><td>{r.currentGeneration}</td><td>{r.bestFitness.toFixed(2)}</td><td>{r.populationSize}</td></tr>)}</tbody></table>
            )}
          </section>
        )}

        {mode === "sim" && (<>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[["GENERATION", String(latest.generation)], ["POPULATION", String(POP)], ["BEST FITNESS", latest.best.toFixed(2)], ["AVG FITNESS", latest.avg.toFixed(2)], ["BEST Δ SINCE G0", `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`]].map(([k, v]) => (
              <div key={k} className={`${card} p-3`}><div className={kicker}>{k}</div><div className="mt-1 font-mono text-2xl font-bold text-white">{v}</div></div>
            ))}
          </section>

          <section className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPlaying((p) => !p)} disabled={latest.generation >= MAX_GEN} className="flex items-center gap-1 rounded-md border border-[#43e6a5]/40 px-3 py-1.5 font-mono text-xs text-[#43e6a5] hover:bg-[#43e6a5]/10 disabled:opacity-40">{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? "PAUSE" : "START SIMULATION"}</button>
            <button onClick={step} disabled={playing || latest.generation >= MAX_GEN} className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 font-mono text-xs disabled:opacity-40"><StepForward size={13} />STEP</button>
            <button onClick={reset} className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 font-mono text-xs"><RotateCcw size={13} />NEW SEED</button>
            <span className="font-mono text-[11px] text-zinc-500">seed {seed} · mutation {MUTATION} · profile {PROFILE} · stops at G{MAX_GEN}</span>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <section className={`${card} p-4`}>
              <div className="mb-3 flex items-center justify-between"><span className={kicker}>EVOLUTION CHAMBER · G{shown.generation}{view !== null && " (history)"}</span><span className="text-[10px] text-zinc-500">size = fitness · click a candidate</span></div>
              <div className="grid grid-cols-8 gap-2">
                {ranked.map((c, i) => {
                  const tier = i < Math.ceil(POP * 0.15) ? "bg-[#43e6a5]" : c.fitness >= shown.avg ? "bg-[#a78bfa]" : "bg-zinc-600";
                  const lo = ranked[ranked.length - 1].fitness, hi = ranked[0].fitness;
                  const size = 8 + (hi > lo ? (c.fitness - lo) / (hi - lo) : 1) * 24;
                  return <button key={c.id} title={`${c.id} · ${c.fitness.toFixed(2)}`} aria-label={`Candidate ${c.id}, fitness ${c.fitness.toFixed(2)}`} onClick={() => setSelectedId(c.id)} className={`grid aspect-square place-items-center rounded-md border ${selected?.id === c.id ? "border-white/60" : "border-white/[.05]"} bg-black/30`}><span className={`rounded-full ${tier}`} style={{ width: size, height: size }} /></button>;
                })}
              </div>
              <div className="mt-3 flex gap-4 text-[10px] text-zinc-500"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#43e6a5]" />elite (top 15%)</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#a78bfa]" />above average</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-zinc-600" />below average</span></div>
            </section>

            <section className={`${card} p-4`}>
              <div className={kicker}>FITNESS OVER TIME (last {chart.length})</div>
              <svg viewBox="0 0 300 200" className="mt-2 h-[200px] w-full" role="img" aria-label="Best and average fitness by generation">
                <path d={path("avg")} fill="none" stroke="#43e6a5" strokeWidth="1.5" />
                <path d={path("best")} fill="none" stroke="#f5bf62" strokeWidth="1.5" />
              </svg>
              <div className="flex gap-4 text-[10px] text-zinc-500"><span className="text-[#f5bf62]">— best</span><span className="text-[#43e6a5]">— average</span></div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className={`${card} p-4`}>
              <div className={kicker}>GENOME VIEWER</div>
              {selected && <>
                <div className="mt-2 font-mono text-sm text-white">{selected.id}</div>
                <div className="text-[11px] text-zinc-500">fitness {selected.fitness.toFixed(2)} · parents {selected.parentIds.join(", ") || "none (G0)"} · {selected.mutations} mutations</div>
                <div className="mt-3 space-y-2">{GENE_NAMES.map((g) => <div key={g}><div className="flex justify-between text-[11px]"><span>{g}</span><span className="font-mono">{selected.genes[g].toFixed(3)}</span></div><div className="h-1.5 rounded bg-white/5"><div className="h-full rounded bg-[#a78bfa]" style={{ width: `${selected.genes[g] * 100}%` }} /></div></div>)}</div>
              </>}
            </section>

            <section className={`${card} p-4`}>
              <div className="flex items-center gap-2"><Swords size={13} className="text-[#f5bf62]" /><span className={kicker}>TOURNAMENT ARENA · G{shown.generation}</span></div>
              <p className="mt-1 text-[11px] text-zinc-500">A sample head-to-head pairing from this generation. Higher fitness wins.</p>
              {[match.a, match.b].map((c, i) => <div key={i} className="mt-3"><div className="flex justify-between text-xs"><span className={c.id === match.winner.id ? "text-[#43e6a5]" : ""}>{c.id}{c.id === match.winner.id && " ✓"}</span><span className="font-mono">{c.fitness.toFixed(2)}</span></div><div className="h-1.5 rounded bg-white/5"><div className={`h-full rounded ${i ? "bg-[#a78bfa]" : "bg-[#43e6a5]"}`} style={{ width: `${c.fitness}%` }} /></div></div>)}
            </section>

            <section className={`${card} p-4`}>
              <div className="flex items-center justify-between"><span className={kicker}>SIMULATION INSPECTOR</span><DemoBadge label="Browser state only" /></div>
              <div className="mt-2 flex flex-wrap gap-1">{["recent", "mutations", "dead_ends", "champions"].map((k) => <button key={k} onClick={() => runQuery(k)} className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] hover:text-white">{k}</button>)}</div>
              <div className="mt-2 h-36 overflow-auto rounded bg-black/40 p-2 font-mono text-[11px] text-zinc-400" aria-live="polite">{output.map((l, i) => <div key={i} className="whitespace-pre-wrap">{l}</div>)}</div>
              <p className="mt-2 text-[10px] text-zinc-600">Choose a fixed inspection above. Free-form input and code execution are not supported.</p>
            </section>
          </div>

          <section className={`${card} p-4`}>
            <div className="flex items-center justify-between">
              <span className={kicker}>GENERATION TIMELINE</span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button aria-label="Previous generation" onClick={() => setView(Math.max(0, idx - 1))} disabled={idx === 0} className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"><ChevronLeft size={13} /></button>
                <span>G{snaps[idx].generation} / G{latest.generation}</span>
                <button aria-label="Next generation" onClick={() => setView(idx + 1 >= snaps.length - 1 ? null : idx + 1)} disabled={view === null} className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"><ChevronRight size={13} /></button>
                <button onClick={() => setView(null)} disabled={view === null} className="rounded border border-white/10 px-2 py-1 text-[10px] disabled:opacity-30">latest</button>
              </div>
            </div>
            <div className="mt-3 flex gap-[3px] overflow-x-auto pb-1">
              {snaps.map((s, i) => <button key={s.generation} title={`G${s.generation} · best ${s.best.toFixed(2)}`} aria-label={`Generation ${s.generation}`} onClick={() => setView(i === snaps.length - 1 ? null : i)} className={`h-8 w-2 flex-none rounded-sm ${i === idx ? "bg-[#f5bf62]" : "bg-[#43e6a5]/40 hover:bg-[#43e6a5]"}`} style={{ opacity: 0.3 + (s.best / 100) * 0.7 }} />)}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs"><div><div className={kicker}>BEST</div>{shown.best.toFixed(2)}</div><div><div className={kicker}>AVERAGE</div>{shown.avg.toFixed(2)}</div><div><div className={kicker}>MUTATIONS</div>{shown.mutations}</div></div>
          </section>

          <section className={`${card} border-dashed p-4`}>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2"><FlaskConical size={13} /><span className={kicker}>MODEL MICROVM FLEET</span></span><DemoBadge label="Vision · not built" /></div>
            <p className="mt-2 text-xs text-zinc-400">Proposed: run each candidate in an isolated sandbox with checkpoint, fork and rollback. HELLO OS doesn&apos;t include Firecracker or any microVM runtime today, so there are no latency figures to show.</p>
          </section>
        </>)}
      </div>
    </HubShell>
  );
}
