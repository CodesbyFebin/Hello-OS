"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Brain, Skull, Lock, ShieldAlert, AlertTriangle, Coins } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { useFetch, apiPost } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/hello";

type Memory = {
  id: string; kind: string; agentDid: string; task: string; content: string;
  tokenEstimate: number; tags: string; errorSignature: string | null; deadEndCount: number; createdAt: string;
};
type MemData = { memories: Memory[]; byKind: Record<string, number> };
type Contract = {
  id: string; intentType: string; title: string; proposerDid: string; participants: string;
  schemaJson: string; status: string; challengeNote: string | null; receiptHash: string | null; createdAt: string; lockedAt: string | null;
};
type ContractData = { contracts: Contract[] };

const INTENT_META: Record<string, { icon: any; color: string; label: string }> = {
  SPEC_PROPOSAL: { icon: Brain, color: "soul", label: "Spec Proposal" },
  INTERFACE_LOCK: { icon: Lock, color: "cognition", label: "Interface Lock" },
  ADVERSARIAL_AUDIT: { icon: ShieldAlert, color: "destructive", label: "Adversarial Audit" },
  TASK_BOUNTY: { icon: Coins, color: "economy", label: "Task Bounty" },
};

export function CortexSection() {
  const { data: memData, loading } = useFetch<MemData>("/api/hello/cortex/memories");
  const { data: conData } = useFetch<ContractData>("/api/hello/cortex/contracts");
  const [tick, setTick] = React.useState(0);

  return (
    <SectionShell id="cortex" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-cognition/5 blur-3xl" />
      <SectionHeader
        eyebrow="hello.cortex · shared state + contract lock bus"
        eyebrowColor="cognition"
        icon={Brain}
        title={<>Causal dead-ends + <span className="text-cognition">contract locks</span>. No agent repeats a mistake.</>}
        description="When an agent hits a dead-end, it writes a CAUSAL_DEAD_END record. No other agent wastes tokens repeating it. Contract locks (SPEC_PROPOSAL, INTERFACE_LOCK, ADVERSARIAL_AUDIT) enforce multi-agent agreements."
      />

      <Tabs defaultValue="deadends" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="deadends"><Skull className="mr-1.5 h-3.5 w-3.5" /> Causal Dead-Ends</TabsTrigger>
          <TabsTrigger value="contracts"><Lock className="mr-1.5 h-3.5 w-3.5" /> Contract Locks</TabsTrigger>
        </TabsList>

        {/* Causal dead-ends */}
        <TabsContent value="deadends">
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Card className="border-destructive/30 bg-destructive/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dead-Ends</div>
              <div className="font-mono text-xl font-bold text-destructive">{memData?.byKind.causal_dead_end ?? 0}</div>
            </Card>
            <Card className="border-cognition/30 bg-cognition/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Semantic</div>
              <div className="font-mono text-xl font-bold text-cognition">{memData?.byKind.semantic ?? 0}</div>
            </Card>
            <Card className="border-society/30 bg-society/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Constraints</div>
              <div className="font-mono text-xl font-bold text-society">{memData?.byKind.constraint ?? 0}</div>
            </Card>
            <Card className="border-soul/30 bg-soul/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Episodic</div>
              <div className="font-mono text-xl font-bold text-soul">{memData?.byKind.episodic ?? 0}</div>
            </Card>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : (
            <div className="space-y-2">
              {memData?.memories.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={cn("border p-4 backdrop-blur", m.kind === "causal_dead_end" ? "border-destructive/30 bg-destructive/5" : m.kind === "constraint" ? "border-society/30 bg-society/5" : "border-border/60 bg-card/50")}>
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", m.kind === "causal_dead_end" ? "bg-destructive/15 text-destructive" : m.kind === "constraint" ? "bg-society/15 text-society" : "bg-cognition/15 text-cognition")}>
                        {m.kind === "causal_dead_end" ? <Skull className="h-4 w-4" /> : m.kind === "constraint" ? <Lock className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn("text-[9px] uppercase", m.kind === "causal_dead_end" ? "text-destructive" : m.kind === "constraint" ? "text-society" : "text-cognition")}>{m.kind}</Badge>
                          <span className="font-mono text-[10px] text-muted-foreground">{m.task}</span>
                          {m.errorSignature && <Badge variant="outline" className="font-mono text-[9px] text-destructive">{m.errorSignature}</Badge>}
                          {m.deadEndCount > 0 && <span className="font-mono text-[10px] font-bold text-destructive">×{m.deadEndCount} agents hit this</span>}
                          <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 text-sm">{m.content}</p>
                        <div className="mt-1.5 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
                          <span>~{m.tokenEstimate} tokens</span>
                          {m.tags && <span>· {m.tags}</span>}
                          <span>· {m.agentDid.slice(0, 30)}…</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contract locks */}
        <TabsContent value="contracts">
          <div className="mb-4">
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                await apiPost("/api/hello/mcp/call", { name: "cortex.proposeContract", arguments: { intentType: "INTERFACE_LOCK", title: "InventoryTracker.reserve(): boolean", schemaJson: JSON.stringify({ signature: "reserve(sku, qty): boolean", locked: true }), participants: "" } });
                toast.success("Contract proposed", { description: "INTERFACE_LOCK broadcast on the mesh." });
                setTick((t) => t + 1);
              } catch (e: any) { toast.error(e.message); }
            }}>
              <Lock className="mr-1.5 h-3.5 w-3.5" /> Propose Interface Lock
            </Button>
            <span className="ml-2 text-[10px] text-muted-foreground">calls cortex.proposeContract on the MCP server</span>
            {tick > 0 && <span className="ml-2 text-[10px] text-society">refresh to see it</span>}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {conData?.contracts.map((c) => {
              const meta = INTENT_META[c.intentType] ?? INTENT_META.SPEC_PROPOSAL;
              const Icon = meta.icon;
              return (
                <Card key={c.id} className={cn("border p-4 backdrop-blur", c.status === "locked" ? "border-cognition/30 bg-cognition/5" : c.status === "challenged" ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-card/50")}>
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", `bg-${meta.color}/15 text-${meta.color}`)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[9px] uppercase", `text-${meta.color}`)}>{meta.label}</Badge>
                        <Badge variant="outline" className={cn("text-[9px]", c.status === "locked" ? "text-cognition" : c.status === "challenged" ? "text-destructive" : "text-muted-foreground")}>{c.status}</Badge>
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold">{c.title}</h3>
                      {c.challengeNote && (
                        <div className="mt-2 flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{c.challengeNote}</span>
                        </div>
                      )}
                      <pre className="mt-2 max-h-24 overflow-auto rounded bg-void p-2 font-mono text-[10px] text-muted-foreground scroll-thin">{JSON.stringify(JSON.parse(c.schemaJson), null, 1)}</pre>
                      <div className="mt-1.5 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
                        <span>by {c.proposerDid.slice(0, 24)}…</span>
                        {c.lockedAt && <span>· locked {timeAgo(c.lockedAt)}</span>}
                        {c.receiptHash && <span>· rcpt {c.receiptHash.slice(0, 12)}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </SectionShell>
  );
}
