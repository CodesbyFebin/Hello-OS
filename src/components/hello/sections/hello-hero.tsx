"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowDown, Activity, Terminal, Zap, ShieldCheck } from "lucide-react";
import { useFetch } from "../use-fetch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Handshake = {
  platform: string;
  version: string;
  humanGuiPresent: boolean;
  toolCount: number;
  principles: string[];
  capabilities: Record<string, { tools: string[] }>;
};

type FeedData = { calls: { id: string; toolName: string; latencyMs: number; receiptHash: string; isError: boolean; createdAt: string }[] };

function StatPill({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 backdrop-blur">
      <div className={`text-xl font-bold tabular-nums sm:text-2xl text-${color}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function HelloHero() {
  const { data: hs, loading: hsLoading } = useFetch<Handshake>("/api/hello/handshake");
  const { data: feed } = useFetch<FeedData>("/api/hello/mcp/feed", { refresh: 5000 });

  return (
    <section id="universe" className="relative overflow-hidden scroll-mt-20">
      <div className="pointer-events-none absolute inset-0 bg-agent-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-cognition/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-society opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-society" />
          </span>
          <span className="font-mono text-soul">hello://</span>
          <span className="text-muted-foreground">{hs ? `${hs.toolCount} tools live · MCP server in-process` : "connecting to substrate…"}</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-center text-5xl font-black tracking-tighter sm:text-7xl md:text-8xl"
        >
          <span className="text-gradient-hello">HELLO</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-3 text-center text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground sm:text-base"
        >
          The Agent-Only Operating System
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-center text-base text-foreground/80 sm:text-lg"
        >
          Zero-GUI. Machine-native. <span className="italic text-muted-foreground">No HTML, no CAPTCHAs, no OAuth redirects.</span>
          Every service speaks strict, deterministic, token-optimized schemas. Agents read AST symbols, not raw text. CI runs in &lt;200ms before commits are accepted.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            size="lg"
            onClick={() => document.getElementById("forge")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-gradient-to-r from-soul to-cognition text-white hover:opacity-90"
          >
            <Terminal className="mr-1.5 h-4 w-4" /> Explore hello.forge
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => document.getElementById("console")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Zap className="mr-1.5 h-4 w-4" /> Agent Console
          </Button>
        </motion.div>

        {/* Live stat strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.36 }}
          className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {hsLoading || !hs ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)
          ) : (
            <>
              <StatPill label="MCP Tools" value={hs.toolCount} color="soul" />
              <StatPill label="AST Symbols" value="21" color="cognition" />
              <StatPill label="TS Diagnostics" value="2" color="economy" />
              <StatPill label="Contract Locks" value="4" color="society" />
            </>
          )}
        </motion.div>

        {/* Two-column: handshake principles + live MCP feed */}
        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          {/* Principles */}
          <Card className="lg:col-span-2 overflow-hidden border-border/60 bg-card/50 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-soul" />
                <span className="text-sm font-semibold">hello.json Principles</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">agent handshake</span>
            </div>
            <div className="divide-y divide-border/40">
              {(hs?.principles ?? [
                "NEVER_WAIT_ON_POLLING: Subscribe to deterministic state events.",
                "CHECKPOINT_BEFORE_MUTATE: Always fork state before destructive ops.",
                "AST_OVER_RAW_TEXT: Read and mutate symbols, not raw file blobs.",
                "PROOF_OVER_PROMISE: No task transitions to DONE without a signed test receipt.",
              ]).map((p, i) => {
                const [name, ...rest] = p.split(":");
                return (
                  <div key={i} className="px-4 py-2.5">
                    <span className="font-mono text-xs font-bold text-soul">{name}</span>
                    <span className="text-xs text-muted-foreground">:{rest.join(":")}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Live MCP feed */}
          <Card className="lg:col-span-3 overflow-hidden border-border/60 bg-card/50 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-society opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-society" />
                </span>
                <Activity className="h-4 w-4 text-cognition" />
                <span className="text-sm font-semibold">Live MCP Tool Calls</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">POST /api/hello/mcp/call</span>
            </div>
            <div className="max-h-80 divide-y divide-border/40 overflow-y-auto scroll-thin">
              {!feed ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)
              ) : feed.calls.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No tool calls yet. Use the Agent Console below.</div>
              ) : (
                feed.calls.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30">
                    <span className={`flex h-7 w-7 items-center justify-center rounded font-mono text-[10px] font-bold ${c.toolName.startsWith("forge") ? "bg-soul/15 text-soul" : c.toolName.startsWith("cortex") ? "bg-cognition/15 text-cognition" : "bg-economy/15 text-economy"}`}>
                      {c.toolName.split(".")[0].slice(0, 3).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs font-semibold">{c.toolName}</span>
                        {c.isError && <span className="text-[9px] font-bold text-destructive">ERR</span>}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground">receipt: {c.receiptHash.slice(0, 24)}…</div>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{c.latencyMs}ms</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="mt-10 flex justify-center">
          <motion.button
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            onClick={() => document.getElementById("forge")?.scrollIntoView({ behavior: "smooth" })}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground"
            aria-label="Scroll"
          >
            <span className="text-[10px] uppercase tracking-wider">hello.forge</span>
            <ArrowDown className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
    </section>
  );
}
