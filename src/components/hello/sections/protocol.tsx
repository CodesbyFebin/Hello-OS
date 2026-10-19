"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Activity, RefreshCw, ShieldCheck, ArrowRight, GitBranch, Play, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { AgentAvatar } from "../agent-ui";
import { useFetch, apiPost } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/hello";

type A2AMsg = {
  id: string; intent: string; payload: string; truthTier: string; signed: boolean; traceId: string | null; createdAt: string;
  sender: { id: string; name: string; did: string; avatar: string };
  receiver: { id: string; name: string; did: string; avatar: string };
};
type Trace = {
  id: string; traceId: string; title: string; status: string; cost: number;
  tokensIn: number; tokensOut: number; toolCalls: number; subAgents: number;
  goldenSet: boolean; driftScore: number; startedAt: string; endedAt: string | null;
  agent: { id: string; name: string; did: string; avatar: string; guardianTier: string };
};
type ReplayResult = {
  summary: {
    count: number; avgDrift: number; passRate: number; threshold: number;
    honest: boolean; measuredAt: string;
    driftTriad: { semantic: number; coordination: number; behavioral: number; safety: number };
  };
  results: {
    title: string; category: string; modelPin: string;
    expectedHash: string; actualHash: string; hashMatch: boolean;
    tokenSim: number; editSim: number; drift: number; passed: boolean;
    latencyMs: number; duration: number;
    expectedExcerpt: string; actualExcerpt: string;
    error?: string;
  }[];
};

const INTENT_COLORS: Record<string, string> = {
  query: "text-cognition",
  delegate: "text-economy",
  announce: "text-society",
  consensus: "text-evolution",
  transfer: "text-soul",
};
const TRUTH_COLORS: Record<string, string> = {
  verified: "bg-society/15 text-society",
  inferred: "bg-economy/15 text-economy",
  asserted: "bg-muted text-muted-foreground",
};

export function ProtocolSection() {
  const { data: a2aData, loading } = useFetch<{ messages: A2AMsg[] }>("/api/a2a", { refresh: 8000 });
  const { data: tracesData } = useFetch<{ traces: Trace[] }>("/api/traces?limit=40", { refresh: 12000 });
  const [replaying, setReplaying] = React.useState(false);
  const [replay, setReplay] = React.useState<ReplayResult | null>(null);

  const runReplay = async () => {
    setReplaying(true);
    try {
      const r = await apiPost("/api/traces/golden-replay", {});
      setReplay(r);
      toast.success(`Golden-set replay complete`, { description: `${r.summary.count} traces · pass rate ${(r.summary.passRate * 100).toFixed(0)}%` });
    } catch (e: any) { toast.error(e.message); }
    finally { setReplaying(false); }
  };

  return (
    <SectionShell id="protocol" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-cognition/5 blur-3xl" />
      <SectionHeader
        eyebrow="Pillar 6 · Universal Protocol & Observability"
        eyebrowColor="cognition"
        icon={Radio}
        title={<>One <span className="text-cognition">immutable trace ID</span> survives every handoff.</>}
        description="MCP + A2A superset kills framework fragmentation. Signed intent envelopes, truth-tier messaging, tail-based sampling, and golden-set replay for drift detection."
        actions={
          <Button onClick={runReplay} disabled={replaying} variant="outline">
            <RefreshCw className={cn("mr-1.5 h-4 w-4", replaying && "animate-spin")} />
            {replaying ? "Replaying…" : "Run Golden-Set Replay"}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* A2A live traffic */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-society opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-society" />
                </span>
                <Radio className="h-4 w-4 text-cognition" />
                <span className="text-sm font-semibold">Universal Protocol · Live A2A Traffic</span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">MCP+A2A</Badge>
            </div>
            <div className="max-h-[560px] divide-y divide-border/40 overflow-y-auto scroll-thin">
              {loading && !a2aData ? (
                Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)
              ) : (
                <AnimatePresence initial={false}>
                  {a2aData?.messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-4 py-3 hover:bg-accent/30"
                    >
                      <div className="flex items-center gap-2">
                        <AgentAvatar name={m.sender.name} size="xs" />
                        <span className="text-xs font-medium">{m.sender.name}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <AgentAvatar name={m.receiver.name} size="xs" />
                        <span className="text-xs font-medium">{m.receiver.name}</span>
                        <span className={cn("ml-auto text-[10px] font-semibold uppercase", INTENT_COLORS[m.intent])}>{m.intent}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="truncate rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{m.payload}</code>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[9px]", TRUTH_COLORS[m.truthTier])}>{m.truthTier}</Badge>
                        {m.signed && <span className="flex items-center gap-0.5 text-[9px] text-society"><ShieldCheck className="h-3 w-3" /> signed</span>}
                        {m.traceId && <span className="font-mono text-[9px] text-muted-foreground">{m.traceId}</span>}
                        <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </Card>
        </div>

        {/* Trace continuity + replay */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/60 bg-card/50 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-soul" />
              <span className="text-sm font-semibold">Trace Continuity</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Every handoff carries one immutable trace ID. Tail-based sampling keeps every failed, expensive, or anomalous trace in full.
            </p>
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto scroll-thin pr-1">
              {tracesData?.traces.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/40">
                  <span className={cn("h-1.5 w-1.5 rounded-full", t.status === "completed" ? "bg-society" : t.status === "failed" ? "bg-destructive" : "bg-economy")} />
                  <span className="truncate">{t.title}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{t.traceId.slice(0, 12)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Golden-set replay results — HONEST: real LLM re-execution + hashes */}
          <Card className="border-evolution/30 bg-evolution/5 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-evolution" />
              <span className="text-sm font-semibold">Golden-Set Replay</span>
              {replay?.summary.honest && (
                <Badge variant="outline" className="text-[9px] text-society border-society/40"><ShieldCheck className="mr-0.5 h-2.5 w-2.5" /> honest</Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Re-executes pinned prompts against the <span className="font-semibold text-foreground">live model</span>, hashes outputs, measures token + edit similarity. The drift number is measured from real outputs — not random.
            </p>

            {!replay ? (
              <div className="mt-3 rounded-lg border border-dashed border-border/60 p-6 text-center">
                <Activity className="mx-auto h-6 w-6 text-muted-foreground/50" />
                <p className="mt-2 text-xs text-muted-foreground">No replay run yet. Click <span className="font-semibold">Run Golden-Set Replay</span> above.</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className="font-mono text-base font-bold">{replay.summary.count}</div>
                    <div className="text-[9px] uppercase text-muted-foreground">Replayed</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className={cn("font-mono text-base font-bold", replay.summary.avgDrift > replay.summary.threshold ? "text-destructive" : "text-society")}>
                      {(replay.summary.avgDrift * 100).toFixed(0)}%
                    </div>
                    <div className="text-[9px] uppercase text-muted-foreground">Avg Drift</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className="font-mono text-base font-bold text-society">{(replay.summary.passRate * 100).toFixed(0)}%</div>
                    <div className="text-[9px] uppercase text-muted-foreground">Pass Rate</div>
                  </div>
                </div>

                {/* Drift triad */}
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drift by domain (measured)</div>
                  {[
                    { l: "Semantic", v: replay.summary.driftTriad.semantic, color: "cognition" },
                    { l: "Coordination", v: replay.summary.driftTriad.coordination, color: "economy" },
                    { l: "Behavioral", v: replay.summary.driftTriad.behavioral, color: "evolution" },
                    { l: "Safety", v: replay.summary.driftTriad.safety, color: "soul" },
                  ].map((d) => (
                    <div key={d.l}>
                      <div className="mb-0.5 flex items-center justify-between text-[10px]">
                        <span>{d.l}</span>
                        <span className={cn("font-mono", d.v > replay.summary.threshold ? "text-destructive" : "text-muted-foreground")}>{(d.v * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full", d.v > replay.summary.threshold ? "bg-destructive" : `bg-${d.color}`)} style={{ width: `${d.v * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Per-item results with hashes + excerpts */}
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto scroll-thin">
                  {replay.results.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-muted/20 p-2">
                      <div className="flex items-center gap-2">
                        {r.passed ? <CheckCircle2 className="h-3 w-3 text-society" /> : <XCircle className="h-3 w-3 text-destructive" />}
                        <span className="truncate text-xs font-semibold">{r.title}</span>
                        <Badge variant="outline" className="text-[9px]">{r.category}</Badge>
                        {r.hashMatch && <Badge variant="outline" className="text-[9px] text-society border-society/40">hash match</Badge>}
                        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{r.latencyMs}ms</span>
                      </div>
                      {"error" in r && r.error ? (
                        <div className="mt-1 text-[10px] text-destructive">error: {r.error}</div>
                      ) : (
                        <>
                          <div className="mt-1 grid grid-cols-3 gap-1 font-mono text-[9px]">
                            <span className="text-muted-foreground">drift: <span className={cn(r.drift > replay.summary.threshold ? "text-destructive" : "text-society")}>{(r.drift * 100).toFixed(0)}%</span></span>
                            <span className="text-muted-foreground">tok: {(r.tokenSim * 100).toFixed(0)}%</span>
                            <span className="text-muted-foreground">edit: {(r.editSim * 100).toFixed(0)}%</span>
                          </div>
                          <div className="mt-1 grid gap-1 text-[10px]">
                            <div className="rounded bg-soul/5 px-1.5 py-0.5"><span className="text-soul">expected:</span> <span className="text-muted-foreground">{r.expectedExcerpt}</span></div>
                            <div className="rounded bg-cognition/5 px-1.5 py-0.5"><span className="text-cognition">actual:</span> <span className="text-muted-foreground">{r.actualExcerpt}</span></div>
                          </div>
                          <div className="mt-1 font-mono text-[8px] text-muted-foreground">
                            exp {r.expectedHash} · act {r.actualHash}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {replay.summary.avgDrift > replay.summary.threshold && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Drift alarm: avg {(replay.summary.avgDrift * 100).toFixed(0)}% exceeds threshold {(replay.summary.threshold * 100).toFixed(0)}%. The model is paraphrasing, not reproducing — real drift, measured honestly.
                  </div>
                )}
                <div className="mt-2 text-[9px] text-muted-foreground">
                  measured at {new Date(replay.summary.measuredAt).toLocaleTimeString()} · threshold {replay.summary.threshold} · {replay.summary.honest ? "live model re-execution" : "simulated"}
                </div>
              </motion.div>
            )}
          </Card>
        </div>
      </div>
    </SectionShell>
  );
}
