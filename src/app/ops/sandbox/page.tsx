"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";
import { errText, j } from "@/components/ops/ops-fetch";

type Run = { ok: boolean; result?: unknown; error?: string; logs: string[]; durationMs: number; limits: { timeoutMs: number; memoryBytes: number } };
const PRESETS: Record<string, string> = {
  "parse CSV": "const csv = 'name,qty\\nbolt,4\\nnut,10';\nconst [head, ...rows] = csv.split('\\n').map(l => l.split(','));\nconst out = rows.map(r => Object.fromEntries(r.map((v, i) => [head[i], isNaN(+v) ? v : +v])));\nconsole.log('rows', out.length);\nout",
  "infinite loop": "while (true) {}",
  "memory bomb": "let a = []; while (true) a.push('x'.repeat(1e5));",
  "probe host": "[typeof require, typeof process, typeof fetch, typeof setTimeout]",
};

export default function SandboxPage() {
  const [code, setCode] = React.useState(PRESETS["parse CSV"]);
  const [timeoutMs, setTimeoutMs] = React.useState("1000"); const [memMb, setMemMb] = React.useState("16");
  const [run, setRun] = React.useState<Run | null>(null); const [busy, setBusy] = React.useState(false); const [msg, setMsg] = React.useState("");
  async function go() {
    setBusy(true); setMsg("");
    try { setRun(await j<Run>("/api/sandbox", { method: "POST", body: JSON.stringify({ code, timeoutMs: Number(timeoutMs), memoryBytes: Number(memMb) * 1024 * 1024 }) })); }
    catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  }
  // /ops/sandbox?run=1 runs the default preset on load (handy for demos)
  React.useEffect(() => { if (new URLSearchParams(window.location.search).get("run") !== "1") return; const t = window.setTimeout(() => { void go(); }, 0); return () => window.clearTimeout(t); }, []);
  return (
    <OpsFrame title="Wasm sandbox" subtitle="Each run gets a fresh QuickJS runtime compiled to WebAssembly (quickjs-emscripten 0.32.0, pinned), with a wall-clock deadline, a memory cap and a stack cap. Only console.log is exposed: no fs, network, timers or process.">
      <section className={opsCard}>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge kind="real">REAL WASM</Badge>
          {Object.keys(PRESETS).map((k) => <button key={k} className={opsBtn} onClick={() => setCode(PRESETS[k])}>{k}</button>)}
          <span className="ml-auto">timeout <input aria-label="Timeout ms" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value.slice(0, 5))} className="w-16 rounded border border-white/10 bg-black/30 px-2 py-1" /> ms · memory <input aria-label="Memory MB" value={memMb} onChange={(e) => setMemMb(e.target.value.slice(0, 3))} className="w-12 rounded border border-white/10 bg-black/30 px-2 py-1" /> MB</span>
          <button className={opsBtn} disabled={busy || !code} onClick={go}>{busy ? "Running…" : "Run"}</button>
        </div>
        <textarea aria-label="Snippet" value={code} onChange={(e) => setCode(e.target.value.slice(0, 20000))} rows={9} className="w-full rounded border border-white/10 bg-black/30 p-2 font-mono text-[12px]" />
        {msg && <p className="text-xs text-red-300">{msg}</p>}
      </section>
      {run && <section className={`${opsCard} font-mono text-[12px]`}>
        <div className="mb-1 flex gap-3 text-xs"><Badge kind={run.ok ? "real" : "warn"}>{run.ok ? "OK" : "STOPPED"}</Badge><span className="text-zinc-400">{run.durationMs} ms · limits {run.limits.timeoutMs} ms / {Math.round(run.limits.memoryBytes / 1048576)} MB</span></div>
        {run.logs.map((l, i) => <div key={i} className="text-zinc-400">log › {l}</div>)}
        <pre className="mt-1 whitespace-pre-wrap text-zinc-100">{run.ok ? JSON.stringify(run.result, null, 2) : run.error}</pre>
      </section>}
    </OpsFrame>
  );
}