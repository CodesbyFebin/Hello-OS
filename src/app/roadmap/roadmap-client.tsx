"use client";

import { useMemo, useState } from "react";
import { HubShell, card, kicker } from "@/components/hub/hub-shell";
import { LAYERS, PHASES, PIPELINE, REPO, type Step, type StepStatus } from "@/lib/roadmap/steps";
import type { EvidenceEvent } from "@/lib/roadmap/github";

type RStep = Step & { prUrl?: string; prMerged: boolean };
type View = "roadmap" | "pipeline" | "evidence" | "architecture";

const STYLE: Record<StepStatus, string> = {
  shipped: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "in-pr": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  planned: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  vision: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};
const TITLE: Record<StepStatus, string> = { shipped: "Code on main", "in-pr": "In an open pull request", planned: "Not built yet", vision: "Not built; long-term or research" };
const BAR: Record<StepStatus, string> = { shipped: "bg-emerald-400", "in-pr": "bg-amber-400", planned: "bg-sky-500/60", vision: "bg-zinc-600" };
const ORDER: StepStatus[] = ["shipped", "in-pr", "planned", "vision"];

function Badge({ s }: { s: StepStatus }) {
  return <span title={TITLE[s]} className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${STYLE[s]}`}>{s.toUpperCase()}</span>;
}

function Bar({ steps }: { steps: RStep[] }) {
  return (
    <div className="flex h-1.5 overflow-hidden rounded bg-white/5">
      {ORDER.map((s) => { const n = steps.filter((x) => x.status === s).length; return n ? <div key={s} title={`${n} ${s}`} style={{ width: `${(n / steps.length) * 100}%` }} className={BAR[s]} /> : null; })}
    </div>
  );
}

export default function RoadmapClient({ steps, evidence }: { steps: RStep[]; evidence: { source: string; fetchedAt: string; events: EvidenceEvent[]; error?: string } }) {
  const [view, setView] = useState<View>("roadmap");
  const [phase, setPhase] = useState<number | "all">("all");
  const [status, setStatus] = useState<StepStatus | "all">("all");
  const [q, setQ] = useState("");
  const counts = useMemo(() => Object.fromEntries(ORDER.map((s) => [s, steps.filter((x) => x.status === s).length])) as Record<StepStatus, number>, [steps]);
  const rows = steps.filter((s) => (phase === "all" || s.phase === phase) && (status === "all" || s.status === status) && (!q || `${s.n} ${s.title} ${s.note ?? ""} ${(s.paths ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const pill = (on: boolean) => `rounded-md border px-2.5 py-1 font-mono text-[11px] ${on ? "border-[#43e6a5] bg-[#43e6a5]/10 text-[#43e6a5]" : "border-white/10 text-zinc-400 hover:text-white"}`;

  return (
    <HubShell active="roadmap">
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <p className={kicker}>HELLO OS · ROADMAP</p>
        <h1 className="mt-1 font-mono text-2xl font-bold text-white md:text-3xl">HELLO OS 100-step roadmap</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">10 phases × 10 steps, mapped to the 7 layers. Every status is backed by evidence: <b className="text-emerald-300">shipped</b> cites files on main, <b className="text-amber-300">in-pr</b> links an open pull request, and the rest are <b className="text-sky-300">planned</b> or <b className="text-zinc-300">vision</b>. Nothing here is executed automatically.</p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {ORDER.map((s) => <div key={s} className={`${card} p-4`}><div className={kicker}>{s.toUpperCase()}</div><div className="mt-1 font-mono text-2xl font-bold text-white">{counts[s]}</div><div className="font-mono text-[10px] text-zinc-500">{TITLE[s]}</div></div>)}
        </div>
        <div className="mt-3"><Bar steps={steps} /></div>

        <div className="mt-5 flex flex-wrap gap-2">
          {([["roadmap", "roadmap"], ["pipeline", "pipeline"], ["evidence", "evidence log"], ["architecture", "architecture"]] as [View, string][]).map(([v, l]) => <button key={v} className={pill(view === v)} onClick={() => setView(v)}>{l}</button>)}
        </div>

        {view === "roadmap" && (
          <section className="mt-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {PHASES.map((p) => { const ps = steps.filter((s) => s.phase === p.num); return (
                <button key={p.num} onClick={() => setPhase(phase === p.num ? "all" : p.num)} className={`${card} p-3 text-left ${phase === p.num ? "border-[#43e6a5]/60" : ""}`}>
                  <div className="font-mono text-[10px] tracking-widest text-zinc-500">PHASE {String(p.num).padStart(2, "0")} · {p.module}</div>
                  <div className="mt-1 text-xs font-medium text-white">{p.title}</div>
                  <div className="mt-2"><Bar steps={ps} /></div>
                  <div className="mt-1 font-mono text-[10px] text-zinc-500">{ps.filter((s) => s.status === "shipped").length}/10 shipped · {ps.filter((s) => s.status === "in-pr").length} in PR</div>
                </button>); })}
            </div>
            <div className={`${card} mt-3 flex flex-wrap items-center gap-2 p-3`}>
              <input aria-label="Search steps" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search steps, files" className="w-56 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none placeholder:text-zinc-600" />
              <button className={pill(status === "all")} onClick={() => setStatus("all")}>any status</button>
              {ORDER.map((s) => <button key={s} className={pill(status === s)} onClick={() => setStatus(s)}>{s} ({counts[s]})</button>)}
              {phase !== "all" && <button className={pill(true)} onClick={() => setPhase("all")}>phase {phase} ×</button>}
            </div>
            <ol className="mt-3 grid gap-2 md:grid-cols-2">
              {rows.map((s) => (
                <li key={s.n} className={`${card} p-3`}>
                  <div className="flex items-start gap-2"><span className="font-mono text-xs text-zinc-500">{String(s.n).padStart(3, "0")}</span><span className="flex-1 text-sm text-white">{s.title}</span><Badge s={s.status} /></div>
                  {s.note && <p className="mt-1 text-[11px] text-zinc-500">{s.note}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
                    {s.paths?.map((p) => <a key={p} href={`https://github.com/${REPO}/tree/main/${p}`} className="text-emerald-300/80 hover:underline">{p}</a>)}
                    {s.pr && s.prUrl && <a href={s.prUrl} className="text-amber-300/90 hover:underline">PR #{s.pr}{s.prMerged ? " (merged)" : ""}</a>}
                  </div>
                </li>
              ))}
              {rows.length === 0 && <p className="text-sm text-zinc-500">No steps match.</p>}
            </ol>
          </section>
        )}

        {view === "pipeline" && (
          <section className="mt-4">
            <p className="text-xs text-zinc-500">Definitions of how a step moves from idea to shipped. These are the review stages we follow; the page does not simulate or automate them.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              {PIPELINE.map((p, i) => (
                <div key={p.id} className={`${card} p-4`}>
                  <div className="font-mono text-xs font-bold tracking-widest text-[#43e6a5]">{String(i + 1).padStart(2, "0")} · {p.label.toUpperCase()}</div>
                  <div className="mt-1 text-xs text-zinc-300">{p.definition}</div>
                  <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-zinc-500">{p.checks.map((c) => <li key={c}>→ {c}</li>)}</ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "evidence" && (
          <section className="mt-4">
            <p className="text-xs text-zinc-500">
              {evidence.source === "github" ? `Recent pull requests and commits on main from the public GitHub API (cached up to 10 min, fetched ${new Date(evidence.fetchedAt).toUTCString()}).` : `GitHub API unavailable (${evidence.error ?? "unknown error"}); statuses fall back to the committed data.`}
            </p>
            <ul className={`${card} mt-3 divide-y divide-white/[.05]`}>
              {evidence.events.map((e) => (
                <li key={`${e.kind}-${e.ref}-${e.at}`} className="flex items-start gap-3 px-3 py-2 font-mono text-[11px]">
                  <span className="w-40 shrink-0 text-zinc-600">{e.at ? new Date(e.at).toISOString().slice(0, 16).replace("T", " ") + "Z" : ""}</span>
                  <span className={`w-14 shrink-0 ${e.kind === "pr" ? "text-amber-300" : "text-cyan-300"}`}>{e.ref}</span>
                  <a href={e.url} className="text-zinc-300 hover:underline">{e.label}</a>
                </li>
              ))}
              {evidence.events.length === 0 && <li className="px-3 py-2 text-xs text-zinc-500">No events available.</li>}
            </ul>
          </section>
        )}

        {view === "architecture" && (
          <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {LAYERS.map((l) => { const ls = steps.filter((s) => s.layer === l.id); return (
              <div key={l.id} className={`${card} p-4`}>
                <div className="flex items-center justify-between"><span className="font-mono text-xs font-bold text-white">{l.name.toUpperCase()}</span><span className="font-mono text-[10px] text-zinc-500">Phase {l.phases.join(" + ")}</span></div>
                <p className="mt-1 text-xs text-zinc-400">{l.summary}</p>
                <div className="mt-3"><Bar steps={ls} /></div>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">{ls.length} steps · {ORDER.map((s) => `${ls.filter((x) => x.status === s).length} ${s}`).join(" · ")}</p>
              </div>); })}
          </section>
        )}
      </main>
    </HubShell>
  );
}
