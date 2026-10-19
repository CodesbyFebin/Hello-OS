"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Braces, Check, CircleAlert, Copy, FileCode2, Play, ShieldAlert } from "lucide-react";
import type { AmlCompilation } from "@/lib/aml";

const example = `mission optimize_query {
  input: $query_id
  budget: 0.42 USDC
  deadline: 5m

  steps {
    fetch: db.query($query_id) → $query
    analyze: query.performance($query) → $metrics
    optimize: $metrics → $new_query

    if $new_query.latency < 50ms {
      persist: $new_query → db
      emit: verification_receipt
    } else {
      rollback: checkpoint("pre_optimize")
      emit: review_required
    }
  }
}`;

type CompileResponse = AmlCompilation | { error: string };

export function AmlStudioClient() {
  const [source, setSource] = React.useState(example);
  const [result, setResult] = React.useState<AmlCompilation | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function compile() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/aml/compile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const payload = (await response.json()) as CompileResponse;
      if ("error" in payload) {
        setError(payload.error);
      } else {
        setResult(payload);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The compiler request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyHash(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  return (
    <main className="min-h-screen bg-[#05060a] text-slate-200">
      <div className="border-b border-white/10 bg-black/40 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-mono text-xs font-bold tracking-[.16em] text-emerald-300">
            <ArrowLeft size={15} aria-hidden="true" /> HELLO OS
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[.16em] text-slate-500">Developer tool · Static analysis</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
        <div className="max-w-3xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-[.22em] text-emerald-300">AML://STUDIO</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Inspect intent before integration.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            Write Agent Machine Language and inspect the parser output, intent graph, declared budgets, diagnostics, and content hashes. The HELLO OS compiler is a static parser and validator: it never executes AML operations.
          </p>
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-200/[.04] p-4 text-sm leading-6 text-amber-100/80">
          <ShieldAlert className="mt-1 shrink-0 text-amber-300" size={18} aria-hidden="true" />
          <p><strong className="text-amber-200">Execution boundary:</strong> compiling AML does not call tools, deploy code, spend funds, mutate memory, or produce a digital signature. A SHA-256 hash identifies content; it is not proof that an operation ran or was authorized.</p>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b14]" aria-labelledby="editor-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h2 id="editor-title" className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-slate-300"><FileCode2 size={15} /> source.aml</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setSource(example); setResult(null); setError(""); }} className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-emerald-300/40 hover:text-white">Load example</button>
                <button type="button" onClick={compile} disabled={busy || !source.trim()} className="flex items-center gap-2 rounded-md bg-emerald-300 px-3 py-2 text-xs font-bold text-[#04110b] disabled:cursor-wait disabled:opacity-60">
                  <Play size={13} fill="currentColor" /> {busy ? "Checking…" : "Validate AML"}
                </button>
              </div>
            </div>
            <label className="sr-only" htmlFor="aml-source">AML source code</label>
            <textarea id="aml-source" value={source} onChange={(event) => setSource(event.target.value)} maxLength={64000} spellCheck={false} className="min-h-[440px] w-full resize-y bg-transparent p-5 font-mono text-xs leading-6 text-emerald-100 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-inset focus:ring-emerald-300/40 md:text-sm" />
            <div className="flex justify-between border-t border-white/10 px-4 py-2 font-mono text-[10px] text-slate-500"><span>POST /api/aml/compile</span><span>{source.length.toLocaleString()} / 64,000 characters</span></div>
          </section>

          <section className="min-h-[440px] rounded-2xl border border-white/10 bg-[#0a0b14] p-5" aria-labelledby="output-title" aria-live="polite">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 id="output-title" className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-slate-300"><Braces size={15} /> Validation output</h2>
              {result && <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] ${result.ok ? "bg-emerald-300/10 text-emerald-300" : "bg-rose-300/10 text-rose-300"}`}>{result.ok ? "VALID" : "REVIEW FINDINGS"}</span>}
            </div>

            {!result && !error && (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <Braces size={28} className="mb-4 text-slate-600" aria-hidden="true" />
                <p className="text-sm text-slate-400">Validation results will appear here.</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-slate-600">The server parses and checks the submitted source. It does not execute declarations or connect to named tools.</p>
              </div>
            )}

            {error && <div role="alert" className="mt-5 flex gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[.05] p-4 text-sm text-rose-200"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}

            {result && (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label="Tokens" value={result.lexicalTokenCount.toLocaleString()} />
                  <Metric label="Declarations" value={result.ast.length.toLocaleString()} />
                  <Metric label="Graph nodes" value={result.graph.length.toLocaleString()} />
                  <Metric label="Diagnostics" value={result.diagnostics.length.toLocaleString()} />
                </div>
                <Hash label="Source SHA-256" value={result.sourceSha256} copied={copied} onCopy={copyHash} />
                <Hash label="Intent graph SHA-256" value={result.graphSha256} copied={copied} onCopy={copyHash} />
                {result.diagnostics.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">Diagnostics</h3>
                    <ul className="space-y-2">
                      {result.diagnostics.map((item, index) => <li key={`${item.code}-${index}`} className="rounded-lg border border-white/10 p-3 text-xs leading-5">
                        <span className={item.severity === "error" ? "text-rose-300" : "text-amber-300"}>{item.severity.toUpperCase()} · {item.code}</span>
                        <p className="mt-1 text-slate-300">{item.message}</p><p className="mt-1 font-mono text-[10px] text-slate-500">Line {item.line}, column {item.column}</p>
                      </li>)}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">Parsed declarations</h3>
                  <pre className="max-h-52 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[10px] leading-5 text-slate-300">{JSON.stringify(result.ast, null, 2)}</pre>
                </div>
                <div>
                  <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">Required capabilities</h3>
                  {result.requiredCapabilities.length ? <div className="flex flex-wrap gap-2">{result.requiredCapabilities.map((capability) => <code key={capability} className="rounded border border-cyan-300/20 bg-cyan-300/[.05] px-2 py-1 font-mono text-[10px] text-cyan-200">{capability}</code>)}</div> : <p className="text-xs text-slate-500">No required capabilities declared.</p>}
                </div>
                <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-slate-500"><Check size={14} className="text-emerald-300" /> Static result · {result.version} · executable: false</div>
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Info title="Parse" body="The server tokenizes AML text and builds an abstract syntax tree from the supported declarations." />
          <Info title="Inspect" body="Review intent graph nodes, required capabilities, budgets, token count, and line-based diagnostics." />
          <Info title="Integrate carefully" body="The endpoint is a static analysis aid. Execution requires a separate allowlisted runtime, authorization, resource limits, and review." />
        </div>

        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm">
          <Link href="https://codesbyfebin.github.io/Hello-OS/agent-guide/" className="text-emerald-200 hover:text-emerald-100">Agent Guide</Link>
          <Link href="https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/aml-examples.md" className="text-emerald-200 hover:text-emerald-100">AML examples</Link>
          <Link href="https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/aml-spec.ebnf" className="text-emerald-200 hover:text-emerald-100">AML grammar</Link>
          <Link href="/" className="text-slate-400 hover:text-white">HELLO OS home</Link>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-mono text-lg text-white">{value}</p></div>;
}

function Hash({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: (value: string) => void }) {
  return <div className="rounded-lg border border-white/10 p-3">
    <div className="mb-2 flex items-center justify-between gap-2"><p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</p><button type="button" onClick={() => onCopy(value)} aria-label={`Copy ${label}`} className="text-slate-500 hover:text-emerald-200">{copied ? <Check size={14} /> : <Copy size={14} />}</button></div>
    <code className="break-all font-mono text-[10px] text-emerald-200">{value}</code>
  </div>;
}

function Info({ title, body }: { title: string; body: string }) {
  return <article className="rounded-xl border border-white/10 bg-white/[.02] p-4"><h3 className="font-mono text-xs uppercase tracking-wider text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>;
}
