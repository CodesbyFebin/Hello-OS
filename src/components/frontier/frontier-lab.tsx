"use client";

import * as React from "react";
import { card, kicker } from "@/components/hub/hub-shell";
import { createInitialPopulation, createRandom, evolvePopulation, rankPopulation, type Candidate } from "@/lib/evolution";

type Sim = "replay" | "fork" | "sleep" | null;
type Idea = { n: number; title: string; what: string; whyNot: string; sim: Sim };

const IDEAS: Idea[] = [
  { n: 1, title: "Cross-model state handoff", what: "Move a running agent's working state (goals, plan, memory pointers) from one model backend to another mid-task and continue without loss.", whyNot: "Model internals (activations, KV caches) are not portable between architectures or vendors. Only text summaries can be handed over, and those lose information.", sim: null },
  { n: 2, title: "Self-forking agents", what: "An agent clones itself into variants, lets them compete on a task, and merges back the best behaviour.", whyNot: "Forking prompts and configs is easy. Forking and merging learned behaviour safely is not: there is no reliable way to merge what divergent copies learned, or to bound what a fork may do.", sim: "fork" },
  { n: 3, title: "Zero-knowledge belief proofs", what: "An agent proves a property of its reasoning (e.g. 'my answer did not use data X') without revealing the reasoning.", whyNot: "ZK proofs over full transformer inference are far too expensive today, and 'belief' has no formal definition you could prove things about.", sim: null },
  { n: 4, title: "Sleep consolidation", what: "When context gets long, the agent pauses, distils raw episodic logs into compact rules, and resumes with a smaller prompt.", whyNot: "LLM APIs are stateless and have no background lifecycle. Summarisation exists, but there's no reliable signal for 'reasoning is degrading', and summaries can drop the detail that matters.", sim: "sleep" },
  { n: 5, title: "Swarm dream-sharing", what: "Many agents sync their dead-ends and discoveries into a shared space overnight, so each inherits the others' lessons.", whyNot: "Shared retrieval stores are possible. Merging learning across many models is limited by privacy, sync cost, and catastrophic forgetting.", sim: null },
  { n: 6, title: "Quantum-safe passports with auto-revocation", what: "Post-quantum credentials that revoke themselves the moment an agent's behaviour drifts outside its charter.", whyNot: "Post-quantum signatures exist. Detecting 'semantic drift' reliably and in real time does not, and automatic revocation on a noisy signal would be unsafe. In HELLO OS today, revocation stays with the operator.", sim: null },
  { n: 7, title: "Legacy transpilation via execution deltas", what: "Run a legacy binary in a sandbox, observe execution and memory, and rewrite it as modern code without documentation.", whyNot: "Dynamic tracing only covers paths you exercise, and code models are trained on static text, not live instrumentation loops.", sim: null },
  { n: 8, title: "Deterministic replay & timeline forking", what: "Roll a multi-day workflow back to any step, change one tool output, and replay deterministically to see how decisions change.", whyNot: "Sampling makes LLM output non-deterministic, even at temperature 0 across hardware and batching, and external side effects (emails, payments) can't be replayed.", sim: "replay" },
  { n: 9, title: "Inter-agent contracts & arbitration", what: "Agents for different organisations negotiate and sign binding SLAs, and settle disputes with cryptographic evidence.", whyNot: "Agents have no legal personhood or liability framework. Signing messages is possible (HELLO OS does it), but making them legally binding is not.", sim: null },
  { n: 10, title: "Concept-level synthesis", what: "Compile abstract intent directly into executables, skipping natural-language and code intermediates.", whyNot: "Today's models predict tokens and need a symbolic bridge (code, AML) to produce reliable executable output.", sim: null },
];

function SimBanner({ text }: { text: string }) {
  return <div className="mb-2 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 font-mono text-[10px] tracking-wider text-amber-300">SIMULATION · {text}</div>;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Deterministic replay: a toy agent whose every choice comes from a seeded PRNG ---
const TOOLS = ["search", "read_file", "run_tests", "edit", "ask_reviewer"];
const OUTCOMES = ["ok", "ok", "ok", "fail", "partial"];
function toyRun(seed: number, steps: number, override?: { step: number; outcome: string }) {
  const out: { step: number; tool: string; outcome: string }[] = [];
  let state = seed >>> 0;
  for (let i = 0; i < steps; i++) {
    const rnd = createRandom(state);
    const tool = TOOLS[Math.floor(rnd() * TOOLS.length)];
    let outcome = OUTCOMES[Math.floor(rnd() * OUTCOMES.length)];
    if (override && override.step === i) outcome = override.outcome;
    out.push({ step: i, tool, outcome });
    // next decision depends on everything observed so far
    state = (Math.imul(state ^ (tool.length * 31 + outcome.length * 7 + i), 0x9e3779b1) + (outcome === "fail" ? 17 : 3)) >>> 0;
  }
  return out;
}

function ReplaySim() {
  const [seed, setSeed] = React.useState(42);
  const [forkStep, setForkStep] = React.useState(3);
  const [res, setRes] = React.useState<{ a: string; b: string; f: string; base: ReturnType<typeof toyRun>; fork: ReturnType<typeof toyRun> } | null>(null);
  async function run() {
    const base = toyRun(seed, 8);
    const again = toyRun(seed, 8);
    const flip = base[forkStep].outcome === "fail" ? "ok" : "fail";
    const fork = toyRun(seed, 8, { step: forkStep, outcome: flip });
    setRes({ a: await sha256(JSON.stringify(base)), b: await sha256(JSON.stringify(again)), f: await sha256(JSON.stringify(fork)), base, fork });
  }
  React.useEffect(() => { const t = window.setTimeout(() => { void run(); }, 0); return () => window.clearTimeout(t); }, []);
  return (
    <div>
      <SimBanner text="toy agent driven by a seeded PRNG, not an LLM; this is exactly the determinism real LLM runs lack" />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        seed <input aria-label="Seed" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1" />
        fork at step <input aria-label="Fork step" type="number" min={0} max={7} value={forkStep} onChange={(e) => setForkStep(Math.max(0, Math.min(7, Number(e.target.value) || 0)))} className="w-14 rounded border border-white/10 bg-black/30 px-2 py-1" />
        <button onClick={run} className="rounded-md border border-white/10 px-3 py-1 hover:bg-white/5">Run, replay &amp; fork</button>
      </div>
      {res && <div className="mt-2 grid gap-2 font-mono text-[11px] md:grid-cols-2">
        <div><div className="text-zinc-500">original · sha256 {res.a.slice(0, 16)}…</div><div className="text-zinc-500">replay&nbsp;&nbsp; · sha256 {res.b.slice(0, 16)}… {res.a === res.b ? <span className="text-emerald-300">identical</span> : <span className="text-red-300">differs</span>}</div>{res.base.map((s) => <div key={s.step}>{s.step}. {s.tool} → {s.outcome}</div>)}</div>
        <div><div className="text-zinc-500">fork (step {forkStep} outcome flipped) · sha256 {res.f.slice(0, 16)}…</div><div>&nbsp;</div>{res.fork.map((s, i) => <div key={s.step} className={s.tool !== res.base[i].tool || s.outcome !== res.base[i].outcome ? "text-amber-300" : ""}>{s.step}. {s.tool} → {s.outcome}</div>)}</div>
      </div>}
    </div>
  );
}

function ForkSim() {
  const [rows, setRows] = React.useState<{ gen: number; best: number; bestId: string; parents: string }[]>([]);
  function run() {
    const seed = 7;
    let pop: Candidate[] = createInitialPopulation(8, "coding", seed);
    const out: { gen: number; best: number; bestId: string; parents: string }[] = [];
    for (let g = 0; g <= 6; g++) {
      if (g > 0) pop = evolvePopulation(pop, g, 8, 0.2, "coding", seed).population;
      const best = rankPopulation(pop)[0];
      out.push({ gen: g, best: best.fitness, bestId: best.id, parents: best.parentIds.join(" + ") || "(initial)" });
    }
    setRows(out);
  }
  React.useEffect(() => { const t = window.setTimeout(run, 0); return () => window.clearTimeout(t); }, []);
  return (
    <div>
      <SimBanner text="uses this repo's src/lib/evolution.ts genetic algorithm on 4 numeric genes; no model is forked" />
      <button onClick={run} className="rounded-md border border-white/10 px-3 py-1 text-xs hover:bg-white/5">Fork 8 variants × 6 generations</button>
      {rows.length > 0 && <table className="mt-2 w-full font-mono text-[11px]"><thead className="text-zinc-500"><tr><td>gen</td><td>best fitness</td><td>best variant</td><td>forked from</td></tr></thead><tbody>{rows.map((r) => <tr key={r.gen}><td>{r.gen}</td><td>{r.best.toFixed(2)}</td><td>{r.bestId}</td><td className="text-zinc-500">{r.parents}</td></tr>)}</tbody></table>}
    </div>
  );
}

const SAMPLE_LOG = [
  "run_tests failed: ECONNREFUSED db:5432", "edit src/api.ts ok", "run_tests failed: ECONNREFUSED db:5432",
  "search 'retry policy' ok", "run_tests failed: timeout in payments.spec", "read_file docs/retry.md ok",
  "run_tests failed: ECONNREFUSED db:5432", "edit src/retry.ts ok", "run_tests failed: timeout in payments.spec",
  "ask_reviewer ok", "run_tests ok", "run_tests failed: ECONNREFUSED db:5432",
];

function SleepSim() {
  const [rules, setRules] = React.useState<{ rule: string; seen: number }[] | null>(null);
  function consolidate() {
    const counts = new Map<string, number>();
    for (const line of SAMPLE_LOG) {
      const m = line.match(/^(\S+) failed: (.+)$/);
      if (m) counts.set(`${m[1]}|${m[2]}`, (counts.get(`${m[1]}|${m[2]}`) ?? 0) + 1);
    }
    setRules([...counts].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([k, c]) => { const [tool, err] = k.split("|"); return { rule: `Before ${tool}, check for "${err}": it recurred`, seen: c }; }));
  }
  React.useEffect(() => { const t = window.setTimeout(consolidate, 0); return () => window.clearTimeout(t); }, []);
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const before = SAMPLE_LOG.reduce((n, l) => n + words(l), 0);
  const after = rules?.reduce((n, r) => n + words(r.rule), 0) ?? 0;
  return (
    <div>
      <SimBanner text="fixed sample log below; consolidation is a simple frequency rule, not a model" />
      <div className="grid gap-3 md:grid-cols-2">
        <ol className="list-decimal pl-5 font-mono text-[11px] text-zinc-400">{SAMPLE_LOG.map((l, i) => <li key={i}>{l}</li>)}</ol>
        <div>
          <button onClick={consolidate} className="rounded-md border border-white/10 px-3 py-1 text-xs hover:bg-white/5">Sleep → consolidate</button>
          {rules && <><ul className="mt-2 space-y-1 text-xs">{rules.map((r) => <li key={r.rule}>• {r.rule} <span className="text-zinc-500">(seen {r.seen}×)</span></li>)}</ul>
            <p className="mt-2 text-[11px] text-zinc-500">Measured on this sample only: {before} words of log → {after} words of rules.</p></>}
        </div>
      </div>
    </div>
  );
}

export function FrontierLab() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header>
        <div className={kicker}>FRONTIER LAB · RESEARCH DIRECTIONS</div>
        <h1 className="mt-2 text-3xl font-bold text-white">Ten ideas that are not possible today</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">These are long-range directions, not features or plans. HELLO OS does not implement any of them. Each card says why it isn't possible yet. Three include a small in-browser simulation of the underlying idea, labelled as such. See also the <a className="text-[#43e6a5] underline" href="/cloud">HELLO Cloud vision</a>.</p>
      </header>
      {IDEAS.map((idea) => (
        <article key={idea.n} className={`${card} p-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-500">{String(idea.n).padStart(2, "0")}</span>
            <h2 className="text-lg font-semibold text-white">{idea.title}</h2>
            <span className="ml-auto rounded border border-zinc-500/40 bg-zinc-500/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-zinc-400">VISION · NOT POSSIBLE TODAY</span>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{idea.what}</p>
          <p className="mt-2 text-sm text-zinc-400"><b className="text-zinc-300">Why not yet: </b>{idea.whyNot}</p>
          {idea.sim && <div className="mt-4 border-t border-white/[.06] pt-3">{idea.sim === "replay" ? <ReplaySim /> : idea.sim === "fork" ? <ForkSim /> : <SleepSim />}</div>}
        </article>
      ))}
    </div>
  );
}
