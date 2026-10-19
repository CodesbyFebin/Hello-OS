"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Terminal, FileCode2, Bug, Wrench, ChevronRight, Zap, CheckCircle2, XCircle } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { useFetch } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Symbol = {
  id: string; repoId: string; filePath: string; symbolName: string; qualifiedName: string;
  kind: string; astNodeId: string; signature: string; returnType: string | null;
  sourceText: string; startLine: number; endLine: number; hasDiagnostics: boolean; diagnosticCount: number;
};
type SymbolsData = { symbols: Symbol[]; repoId: string; fileCount: number };
type DiagsData = { diagnostics: any[]; errorCount: number };

const KIND_COLORS: Record<string, string> = {
  class: "text-soul bg-soul/10 border-soul/30",
  method: "text-cognition bg-cognition/10 border-cognition/30",
  function: "text-economy bg-economy/10 border-economy/30",
  interface: "text-society bg-society/10 border-society/30",
};

export function ForgeSection() {
  const { data: symData, loading } = useFetch<SymbolsData>("/api/hello/forge/symbols");
  const { data: diagData } = useFetch<DiagsData>("/api/hello/forge/diagnostics");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [activeFile, setActiveFile] = React.useState<string>("all");

  const files = React.useMemo(() => {
    const set = new Set<string>();
    symData?.symbols.forEach((s) => set.add(s.filePath));
    return ["all", ...Array.from(set).sort()];
  }, [symData]);

  const filtered = React.useMemo(() => {
    if (!symData) return [];
    return activeFile === "all" ? symData.symbols : symData.symbols.filter((s) => s.filePath === activeFile);
  }, [symData, activeFile]);

  const selectedSymbol = filtered.find((s) => s.qualifiedName === selected) ?? filtered[0];
  const selectedDiags = diagData?.diagnostics.filter((d) => d.symbolName === selectedSymbol?.qualifiedName) ?? [];

  return (
    <SectionShell id="forge" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-soul/5 blur-3xl" />
      <SectionHeader
        eyebrow="hello.forge · GitHub reimagined for agents"
        eyebrowColor="soul"
        icon={Terminal}
        title={<>Agents commit <span className="text-soul">AST symbols</span>, not raw text lines.</>}
        description="The repository is parsed into a Semantic Code Graph. Agents query symbols by name, patch them by astNodeId, and get instant structured JSON diagnostics from the real TypeScript compiler — before the commit is ever written."
        actions={
          <Button variant="outline" onClick={() => document.getElementById("console")?.scrollIntoView({ behavior: "smooth" })}>
            <Zap className="mr-1.5 h-4 w-4" /> Try forge.typecheck
          </Button>
        }
      />

      {/* Stats */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Card className="border-soul/30 bg-soul/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AST Symbols</div>
          {loading ? <Skeleton className="mt-1 h-7 w-12" /> : <div className="font-mono text-xl font-bold text-soul">{symData?.symbols.length ?? 0}</div>}
        </Card>
        <Card className="border-cognition/30 bg-cognition/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Files</div>
          {loading ? <Skeleton className="mt-1 h-7 w-8" /> : <div className="font-mono text-xl font-bold text-cognition">{symData?.fileCount ?? 0}</div>}
        </Card>
        <Card className={cn("border p-3", (diagData?.errorCount ?? 0) > 0 ? "border-destructive/30 bg-destructive/5" : "border-society/30 bg-society/5")}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Compile Errors</div>
          <div className={cn("font-mono text-xl font-bold", (diagData?.errorCount ?? 0) > 0 ? "text-destructive" : "text-society")}>{diagData?.errorCount ?? 0}</div>
        </Card>
        <Card className="border-border/60 bg-card/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Repo</div>
          <div className="font-mono text-xs font-bold">{symData?.repoId ?? "logistics"}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Symbol tree */}
        <Card className="lg:col-span-2 overflow-hidden border-border/60 bg-card/50 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-soul" />
              <span className="text-sm font-semibold">Semantic Code Graph</span>
            </div>
            <select value={activeFile} onChange={(e) => setActiveFile(e.target.value)} className="h-7 rounded border border-border/60 bg-background px-2 text-xs">
              {files.map((f) => <option key={f} value={f}>{f === "all" ? "all files" : f}</option>)}
            </select>
          </div>
          <div className="max-h-[520px] overflow-y-auto scroll-thin">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.qualifiedName)}
                  className={cn(
                    "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left transition-colors",
                    selectedSymbol?.id === s.id ? "border-soul bg-soul/5" : "border-transparent hover:bg-accent/30"
                  )}
                  style={{ paddingLeft: s.kind === "method" ? 28 : 12 }}
                >
                  <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground", selectedSymbol?.id === s.id && "rotate-90")} />
                  <Badge variant="outline" className={cn("text-[9px] uppercase", KIND_COLORS[s.kind])}>{s.kind}</Badge>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">{s.symbolName}</span>
                  {s.hasDiagnostics && <Bug className="h-3 w-3 text-destructive" />}
                  {s.returnType && <span className="font-mono text-[9px] text-muted-foreground">{s.returnType.replace(/import\(.*\)\./, "")}</span>}
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Symbol detail + diagnostics */}
        <div className="lg:col-span-3 space-y-4">
          {selectedSymbol && (
            <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{selectedSymbol.qualifiedName}</span>
                  <Badge variant="outline" className={cn("text-[9px] uppercase", KIND_COLORS[selectedSymbol.kind])}>{selectedSymbol.kind}</Badge>
                  {selectedSymbol.hasDiagnostics && <Badge variant="destructive" className="text-[9px]"><Bug className="mr-0.5 h-2.5 w-2.5" /> {selectedSymbol.diagnosticCount} err</Badge>}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{selectedSymbol.astNodeId}</span>
              </div>
              <div className="p-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signature</div>
                <pre className="overflow-x-auto rounded-lg bg-void p-3 font-mono text-xs text-foreground/90">{selectedSymbol.signature}</pre>
                <div className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source (AST node)</div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-void p-3 font-mono text-[11px] text-foreground/80 scroll-thin">{selectedSymbol.sourceText}</pre>
                <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                  <span>{selectedSymbol.filePath}</span>
                  <span>L{selectedSymbol.startLine}–{selectedSymbol.endLine}</span>
                  {selectedSymbol.returnType && <span>→ {selectedSymbol.returnType}</span>}
                </div>
              </div>
            </Card>
          )}

          {/* Diagnostics panel — real TS compiler output */}
          <Card className={cn("overflow-hidden border backdrop-blur", (diagData?.errorCount ?? 0) > 0 ? "border-destructive/40 bg-destructive/5" : "border-society/30 bg-society/5")}>
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                {(diagData?.errorCount ?? 0) > 0 ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-society" />}
                <span className="text-sm font-semibold">Diagnostic Engine</span>
                <span className="font-mono text-[10px] text-muted-foreground">real ts-morph + TypeScript compiler</span>
              </div>
              <Badge variant="outline" className={cn("text-[10px]", (diagData?.errorCount ?? 0) > 0 ? "text-destructive" : "text-society")}>
                {(diagData?.errorCount ?? 0) > 0 ? "REJECTED_COMPILE" : "OK"}
              </Badge>
            </div>
            <div className="max-h-72 overflow-y-auto scroll-thin">
              {selectedDiags.length > 0 ? (
                selectedDiags.map((d) => (
                  <div key={d.id} className="border-b border-border/40 p-3 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[9px] font-mono">{d.errorCode}</Badge>
                      <span className="font-mono text-xs font-semibold">{d.symbolName}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{d.filePath}:L{d.line}</span>
                    </div>
                    <p className="mt-1.5 text-xs">{d.message}</p>
                    {(d.expectedType || d.receivedType) && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-muted/40 px-2 py-1">
                          <span className="text-[9px] uppercase text-muted-foreground">Expected</span>
                          <div className="font-mono text-society">{d.expectedType}</div>
                        </div>
                        <div className="rounded bg-muted/40 px-2 py-1">
                          <span className="text-[9px] uppercase text-muted-foreground">Received</span>
                          <div className="font-mono text-destructive">{d.receivedType}</div>
                        </div>
                      </div>
                    )}
                    {d.suggestedFix && (
                      <div className="mt-2 rounded border border-society/30 bg-society/5 px-2 py-1.5">
                        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase text-society"><Wrench className="h-3 w-3" /> Suggested Fix</span>
                        <code className="mt-0.5 block font-mono text-xs text-foreground">{d.suggestedFix}</code>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-society/50" />
                  No diagnostics for this symbol. The TypeScript compiler reports it clean.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </SectionShell>
  );
}
