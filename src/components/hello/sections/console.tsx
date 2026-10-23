"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Play, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { apiPost } from "../use-fetch";
import { useFetch } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tool = { name: string; description: string; inputSchema: any };
type ToolsData = { tools: Tool[] };

const PRESETS: Record<string, any> = {
  "forge.listSymbols": { repoId: "logistics" },
  "forge.readSymbol": { repoId: "logistics", qualifiedName: "DurableJobScheduler.processNextDueJob" },
  "forge.typecheck": { repoId: "logistics" },
  "cortex.recall": { task: "logistics/scheduler", maxTokens: 1500 },
  "cortex.listContracts": {},
  "cloud.checkpoint": { name: "pre_console_demo", repoId: "logistics" },
};

export function ConsoleSection() {
  const { data: toolsData } = useFetch<ToolsData>("/api/hello/mcp/tools");
  const [toolName, setToolName] = React.useState("forge.typecheck");
  const [argsJson, setArgsJson] = React.useState(JSON.stringify(PRESETS["forge.typecheck"], null, 2));
  const [result, setResult] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [latency, setLatency] = React.useState<number | null>(null);

  const onToolChange = (name: string) => {
    setToolName(name);
    setArgsJson(JSON.stringify(PRESETS[name] ?? {}, null, 2));
    setResult(null);
  };

  const run = async () => {
    setBusy(true);
    setResult(null);
    setLatency(null);
    const t0 = Date.now();
    try {
      const args = JSON.parse(argsJson);
      const r = await apiPost("/api/hello/mcp/call", { name: toolName, arguments: args });
      setLatency(Date.now() - t0);
      setResult(r);
      if (r.isError) toast.error("Tool returned an error");
      else toast.success(`${toolName} executed`, { description: `${Date.now() - t0}ms · receipt ${r.receipt?.slice(0, 12) ?? "n/a"}` });
    } catch (e: any) {
      setResult({ isError: true, error: e.message });
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tool = toolsData?.tools.find((t) => t.name === toolName);

  return (
    <SectionShell id="console" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-society/5 blur-3xl" />
      <SectionHeader
        eyebrow="Agent Console · invoke real MCP tools"
        eyebrowColor="society"
        icon={Terminal}
        title={<>Call the <span className="text-society">MCP server</span>. Get real JSON back.</>}
        description="This is the same surface any agent (Claude Code, Gemini, Cursor) calls. Every invocation runs on the in-process MCP server (/api/hello/mcp) and is logged with a SHA-256 receipt."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Input */}
        <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <Terminal className="h-4 w-4 text-society" />
            <span className="text-sm font-semibold">Tool Invocation</span>
            <Badge variant="outline" className="ml-auto font-mono text-[10px]">POST /api/hello/mcp/call</Badge>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tool</label>
              <Select value={toolName} onValueChange={onToolChange}>
                <SelectTrigger className="mt-1 font-mono text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {toolsData?.tools.map((t) => (
                    <SelectItem key={t.name} value={t.name} className="font-mono text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tool && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                <p className="text-xs text-muted-foreground">{tool.description}</p>
              </div>
            )}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Arguments (JSON)</label>
              <Textarea value={argsJson} onChange={(e) => setArgsJson(e.target.value)} rows={8} className="mt-1 font-mono text-xs" />
            </div>
            <Button onClick={run} disabled={busy} className="w-full bg-gradient-to-r from-soul to-cognition text-white hover:opacity-90">
              {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Executing…</> : <><Play className="mr-1.5 h-4 w-4" /> Execute Tool</>}
            </Button>
          </div>
        </Card>

        {/* Output */}
        <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            {result?.isError ? <XCircle className="h-4 w-4 text-destructive" /> : result ? <CheckCircle2 className="h-4 w-4 text-society" /> : <Terminal className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-semibold">Response</span>
            {latency !== null && <Badge variant="outline" className="ml-auto font-mono text-[10px]">{latency}ms</Badge>}
          </div>
          <div className="p-4">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {result.structuredContent && (
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[9px]", result.isError ? "text-destructive" : "text-society")}>
                        {result.isError ? "ERROR" : "OK"}
                      </Badge>
                      {result.receipt && <span className="font-mono text-[10px] text-muted-foreground">receipt: {result.receipt.slice(0, 24)}…</span>}
                    </div>
                  )}
                  <pre className="max-h-[480px] overflow-auto rounded-lg bg-void p-3 font-mono text-[11px] text-foreground/90 scroll-thin">
                    {JSON.stringify(result.structuredContent ?? result.content ?? result, null, 2)}
                  </pre>
                </motion.div>
              ) : (
                <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
                  <div>
                    <Terminal className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    Select a tool and click Execute.<br />The result appears here as real JSON.
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </div>

      {/* Quick presets */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          { label: "Typecheck the repo", tool: "forge.typecheck", desc: "Real TS2322 diagnostics" },
          { label: "Recall scheduler memory", tool: "cortex.recall", desc: "Budgeted retrieval, 1500 tokens" },
          { label: "Record checkpoint request", tool: "cloud.checkpoint", desc: "Audit record + receipt; no state capture" },
        ].map((p) => (
          <Button key={p.label} variant="outline" className="h-auto flex-col items-start py-2.5 text-left" onClick={() => { onToolChange(p.tool); }}>
            <span className="text-xs font-semibold">{p.label}</span>
            <span className="text-[10px] text-muted-foreground">{p.desc}</span>
          </Button>
        ))}
      </div>
    </SectionShell>
  );
}
