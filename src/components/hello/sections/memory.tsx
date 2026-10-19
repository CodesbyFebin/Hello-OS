"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Database, Cpu, Clock, Plus, Trash2, Moon, Zap, Layers } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { AgentAvatar } from "../agent-ui";
import { useFetch, apiPost, apiDelete } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/hello";

type Agent = { id: string; name: string; did: string; avatar: string; guardianTier: string; reputation: number; guild: { name: string; slug: string; color: string } | null };
type Memory = {
  id: string; tier: string; kind: string; content: string; tags: string;
  confidence: number; provenance: string; ttl: string; expiresAt: string | null;
  validFrom: string; validTo: string | null; createdAt: string; updatedAt: string;
};

const KIND_COLORS: Record<string, string> = {
  episodic: "text-soul bg-soul/10 border-soul/30",
  semantic: "text-cognition bg-cognition/10 border-cognition/30",
  procedural: "text-economy bg-economy/10 border-economy/30",
  preference: "text-society bg-society/10 border-society/30",
  belief: "text-evolution bg-evolution/10 border-evolution/30",
};

export function MemorySection() {
  const { data: agentsData } = useFetch<{ agents: Agent[] }>("/api/agents?limit=20");
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [tierFilter, setTierFilter] = React.useState("all");
  const [temporal, setTemporal] = React.useState<string>("");
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!agentId && agentsData?.agents[0]) setAgentId(agentsData.agents[0].id);
  }, [agentsData]);

  const url = React.useMemo(() => {
    if (!agentId) return null;
    const p = new URLSearchParams();
    if (tierFilter !== "all") p.set("tier", tierFilter);
    if (temporal) p.set("temporal", temporal);
    return `/api/agents/${agentId}/memory?${p.toString()}`;
  }, [agentId, tierFilter, temporal, tick]);

  const { data, loading } = useFetch<{ memories: Memory[]; summary: { ram: number; store: number; total: number } }>(url);
  const currentAgent = agentsData?.agents.find((a) => a.id === agentId);

  return (
    <SectionShell id="memory" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-cognition/5 blur-3xl" />
      <SectionHeader
        eyebrow="Pillar 2 · Memory & Cognition"
        eyebrowColor="cognition"
        icon={BrainCircuit}
        title={<>No amnesia. <span className="text-cognition">Continuity</span> is the default state.</>}
        description="Tiered memory (RAM + Store), a Temporal Knowledge Graph, and sleep cycles where episodic memories compress into semantic skills. Selective retrieval pulls ~7K tokens/call vs 25K+ full-context — with better scores."
        actions={
          <AddMemoryDialog agentId={agentId} onAdded={() => setTick((t) => t + 1)} />
        }
      />

      {/* Architecture diagram */}
      <Card className="mb-6 border-border/60 bg-card/40 p-4 backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-cognition/30 bg-cognition/5 p-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cognition" />
              <span className="text-sm font-semibold">Tier 1 · RAM</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Fast, limited working context. The current task. Pruned by attention budget.</p>
          </div>
          <div className="rounded-lg border border-soul/30 bg-soul/5 p-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-soul" />
              <span className="text-sm font-semibold">Tier 2 · Store</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Persistent, searchable, temporal knowledge. Auto-extract / update / decay.</p>
          </div>
          <div className="rounded-lg border border-evolution/30 bg-evolution/5 p-3">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-evolution" />
              <span className="text-sm font-semibold">Sleep &amp; Consolidation</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Idle-time processing. Episodic memories compress into semantic skills.</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-4">
        {/* Sidebar: agent selector + filters */}
        <Card className="lg:col-span-1 h-fit border-border/60 bg-card/50 p-3 backdrop-blur">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inspect Agent</div>
          <div className="max-h-72 space-y-1 overflow-y-auto scroll-thin pr-1">
            {agentsData?.agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setAgentId(a.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors",
                  agentId === a.id ? "bg-cognition/15 ring-1 ring-cognition/40" : "hover:bg-accent/50"
                )}
              >
                <AgentAvatar name={a.name} size="sm" />
                <span className="truncate text-sm font-medium">{a.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tier</div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                <SelectItem value="RAM">RAM (working)</SelectItem>
                <SelectItem value="STORE">Store (long-term)</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Temporal query</div>
            <Input
              type="datetime-local"
              value={temporal}
              onChange={(e) => setTemporal(e.target.value)}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              &ldquo;What did I believe at this time?&rdquo; Shows only beliefs valid then.
            </p>
            {temporal && (
              <Button size="sm" variant="ghost" onClick={() => setTemporal("")}>Clear temporal</Button>
            )}
          </div>

          {data?.summary && (
            <div className="mt-4 rounded-lg bg-muted/40 p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-cognition">RAM</span>
                <span className="font-mono font-bold">{data.summary.ram}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-soul">Store</span>
                <span className="font-mono font-bold">{data.summary.store}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                <span className="font-semibold">Total</span>
                <span className="font-mono font-bold">{data.summary.total}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Memory list */}
        <div className="lg:col-span-3">
          {currentAgent && (
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <AgentAvatar name={currentAgent.name} size="xs" />
              <span>Reading <span className="font-semibold text-foreground">{currentAgent.name}</span>&apos;s memory</span>
            </div>
          )}

          {loading && !data ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : (
            <div className="space-y-2">
              {data?.memories.length === 0 && (
                <Card className="p-8 text-center text-sm text-muted-foreground">No memories match this filter.</Card>
              )}
              {data?.memories.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
                >
                  <MemoryRow memory={m} onDelete={async () => {
                    try {
                      await apiDelete(`/api/agents/${agentId}/memory?memoryId=${m.id}`);
                      toast.success("Memory purged", { description: "Lifecycle engine: explicit deletion." });
                      setTick((t) => t + 1);
                    } catch (e: any) { toast.error(e.message); }
                  }} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

function MemoryRow({ memory, onDelete }: { memory: Memory; onDelete: () => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const isExpired = memory.validTo && new Date(memory.validTo) < new Date();
  return (
    <Card className={cn("border-border/60 bg-card/50 p-3 backdrop-blur transition-all hover:bg-card", isExpired && "opacity-50")}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", memory.tier === "RAM" ? "border-cognition/40 bg-cognition/10 text-cognition" : "border-soul/40 bg-soul/10 text-soul")}>
          {memory.tier === "RAM" ? <Zap className="h-4 w-4" /> : <Database className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("border px-1.5 py-0 text-[10px] font-semibold uppercase", KIND_COLORS[memory.kind])}>
              {memory.kind}
            </Badge>
            <span className="font-mono text-[10px] text-muted-foreground">conf {(memory.confidence * 100).toFixed(0)}%</span>
            <span className="font-mono text-[10px] text-muted-foreground">· {memory.provenance}</span>
            <span className="font-mono text-[10px] text-muted-foreground">· ttl:{memory.ttl}</span>
            {isExpired && <span className="rounded bg-destructive/15 px-1 py-0 text-[10px] font-semibold text-destructive">SUPERSEDED</span>}
            <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(memory.updatedAt)}</span>
          </div>
          <p className={cn("text-sm", !expanded && "line-clamp-2")}>{memory.content}</p>
          {expanded && (
            <div className="mt-2 space-y-1 rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
              <div>validFrom: {new Date(memory.validFrom).toISOString()}</div>
              <div>validTo: {memory.validTo ? new Date(memory.validTo).toISOString() : "null (current)"}</div>
              <div>expiresAt: {memory.expiresAt ? new Date(memory.expiresAt).toISOString() : "permanent"}</div>
              {memory.tags && <div>tags: {memory.tags}</div>}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => setExpanded((e) => !e)} className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
              {expanded ? "Collapse" : "Inspect"}
            </button>
            <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-destructive hover:opacity-80">
              <Trash2 className="h-3 w-3" /> Purge
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AddMemoryDialog({ agentId, onAdded }: { agentId: string | null; onAdded: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [tier, setTier] = React.useState("STORE");
  const [kind, setKind] = React.useState("semantic");
  const [confidence, setConfidence] = React.useState(0.8);
  const [ttl, setTtl] = React.useState("permanent");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!agentId || !content.trim()) return toast.error("Agent + content required");
    setBusy(true);
    try {
      await apiPost(`/api/agents/${agentId}/memory`, { content, tier, kind, confidence, ttl });
      toast.success("Memory written", { description: `${tier} · ${kind} · ttl:${ttl}` });
      setContent("");
      setOpen(false);
      onAdded();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!agentId}>
          <Plus className="mr-1 h-4 w-4" /> Write Memory
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-cognition" /> Write a Memory</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Content</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="What should the agent remember?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RAM">RAM (working)</SelectItem>
                  <SelectItem value="STORE">Store (long-term)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="episodic">Episodic</SelectItem>
                  <SelectItem value="semantic">Semantic</SelectItem>
                  <SelectItem value="procedural">Procedural</SelectItem>
                  <SelectItem value="preference">Preference</SelectItem>
                  <SelectItem value="belief">Belief</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Confidence: {confidence.toFixed(2)}</Label>
              <input type="range" min={0} max={1} step={0.05} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-cognition" />
            </div>
            <div>
              <Label>TTL</Label>
              <Select value={ttl} onValueChange={setTtl}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="session">Session</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-cognition text-white hover:bg-cognition/90">
            {busy ? "Writing…" : "Commit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
