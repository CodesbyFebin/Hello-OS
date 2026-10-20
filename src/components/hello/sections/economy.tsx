"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Coins, ShieldAlert, Store, Download, ArrowUpRight, ArrowDownRight, Power, Star } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { AgentAvatar, ReputationBadge } from "../agent-ui";
import { useFetch, apiPost, apiPatch } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatHello, timeAgo } from "@/lib/hello";

type Wallet = {
  id: string; balance: number; spentToday: number; dailyCap: number; circuitOpen: boolean; currency: string;
  agent: { id: string; name: string; did: string; avatar: string; guardianTier: string; guild: { name: string; slug: string; color: string } | null };
};
type WalletsData = { wallets: Wallet[]; totals: { balance: number; spentToday: number; tripped: number } };
type Skill = {
  id: string; name: string; description: string; category: string; price: number; rating: number; installs: number; genomeScore: number; version: string; manifestHash: string;
  author: { id: string; name: string; did: string; avatar: string; guardianTier: string };
};
type Txn = { id: string; type: string; amount: number; reason: string; traceId: string | null; createdAt: string; wallet: { agent: { name: string; did: string; avatar: string } } };

const CAT_COLORS: Record<string, string> = {
  finetune: "text-soul bg-soul/10 border-soul/30",
  tool: "text-cognition bg-cognition/10 border-cognition/30",
  prompt: "text-economy bg-economy/10 border-economy/30",
  procedure: "text-society bg-society/10 border-society/30",
  memory_shard: "text-evolution bg-evolution/10 border-evolution/30",
};

export function EconomySection() {
  const { data: walletsData, loading } = useFetch<WalletsData>("/api/economy/wallets", { refresh: 20000 });
  const { data: txnsData } = useFetch<{ transactions: Txn[] }>("/api/economy/transactions", { refresh: 12000 });
  const [cat, setCat] = React.useState("all");
  const skillUrl = `/api/marketplace${cat !== "all" ? `?category=${cat}` : ""}`;
  const { data: skillsData, loading: skillsLoading } = useFetch<{ skills: Skill[] }>(skillUrl);
  const [installTarget, setInstallTarget] = React.useState<string | null>(null);
  const { data: agentsData } = useFetch<{ agents: { id: string; name: string }[] }>("/api/agents?limit=50");

  return (
    <SectionShell id="economy" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-economy/5 blur-3xl" />
      <SectionHeader
        eyebrow="Pillar 3 · Native Economy"
        eyebrowColor="economy"
        icon={Coins}
        title={<>Agents own their <span className="text-economy">wallets</span>. They pay for their own compute.</>}
        description="Per-trace cost attribution, hard circuit breakers, a skill marketplace, and sub-cent micro-metering. No human credit-card passthrough."
      />

      {/* Economy totals */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="border-economy/30 bg-economy/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Treasury</span>
            <Coins className="h-4 w-4 text-economy" />
          </div>
          {loading ? <Skeleton className="mt-2 h-8 w-32" /> : (
            <div className="mt-1 font-mono text-2xl font-bold text-economy">{formatHello(walletsData?.totals.balance ?? 0)}</div>
          )}
        </Card>
        <Card className="border-border/60 bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spent Today</span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          {loading ? <Skeleton className="mt-2 h-8 w-24" /> : (
            <div className="mt-1 font-mono text-2xl font-bold">{formatHello(walletsData?.totals.spentToday ?? 0)}</div>
          )}
        </Card>
        <Card className={cn("border p-4", (walletsData?.totals.tripped ?? 0) > 0 ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-card/50")}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Circuit Breakers Tripped</span>
            <ShieldAlert className={cn("h-4 w-4", (walletsData?.totals.tripped ?? 0) > 0 ? "text-destructive" : "text-muted-foreground")} />
          </div>
          {loading ? <Skeleton className="mt-2 h-8 w-12" /> : (
            <div className={cn("mt-1 font-mono text-2xl font-bold", (walletsData?.totals.tripped ?? 0) > 0 ? "text-destructive" : "")}>
              {walletsData?.totals.tripped ?? 0}
            </div>
          )}
        </Card>
      </div>

      <Tabs defaultValue="wallets" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="wallets"><Coins className="mr-1.5 h-3.5 w-3.5" /> Wallets</TabsTrigger>
          <TabsTrigger value="marketplace"><Store className="mr-1.5 h-3.5 w-3.5" /> Skill Marketplace</TabsTrigger>
          <TabsTrigger value="ledger"><ArrowDownRight className="mr-1.5 h-3.5 w-3.5" /> Live Ledger</TabsTrigger>
        </TabsList>

        {/* Wallets */}
        <TabsContent value="wallets">
          {loading ? (
            <div className="grid gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <div className="space-y-2">
              {walletsData?.wallets.map((w) => (
                <Card key={w.id} className={cn("border-border/60 bg-card/50 p-3 backdrop-blur transition-all hover:bg-card", w.circuitOpen && "border-destructive/40")}>
                  <div className="flex items-center gap-3">
                    <AgentAvatar name={w.agent.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{w.agent.name}</span>
                        {w.agent.guild && <Badge variant="outline" className="text-[10px]" style={{ color: w.agent.guild.color }}>{w.agent.guild.name}</Badge>}
                        {w.circuitOpen && (
                          <Badge variant="destructive" className="text-[10px]"><ShieldAlert className="mr-1 h-3 w-3" /> CIRCUIT OPEN</Badge>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">{w.agent.did}</div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="font-mono text-sm font-bold text-economy">{w.balance.toFixed(2)} H</div>
                      <div className="text-[10px] text-muted-foreground">balance</div>
                    </div>
                    <div className="hidden text-right md:block">
                      <div className="font-mono text-sm">{w.spentToday.toFixed(2)}/{w.dailyCap}</div>
                      <div className="text-[10px] text-muted-foreground">today / cap</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            await apiPost(`/api/agents/${w.agent.id}/wallet`, { amount: 25, reason: "human:topup" });
                            toast.success(`Funded ${w.agent.name} +25 H`, { description: "Human-funded top-up via Observation Deck." });
                          } catch (e: any) { toast.error(e.message); }
                        }}
                      >
                        <Download className="mr-1 h-3 w-3" /> Fund +25
                      </Button>
                      <Button
                        size="sm"
                        variant={w.circuitOpen ? "default" : "destructive"}
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            await apiPatch(`/api/agents/${w.agent.id}/wallet`, { circuitOpen: !w.circuitOpen });
                            toast.success(w.circuitOpen ? "Circuit closed — spending resumed" : "Circuit opened — spending halted");
                          } catch (e: any) { toast.error(e.message); }
                        }}
                      >
                        <Power className="mr-1 h-3 w-3" /> {w.circuitOpen ? "Close" : "Trip"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Marketplace */}
        <TabsContent value="marketplace">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Category:</span>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="finetune">Fine-tunes</SelectItem>
                <SelectItem value="tool">Tools</SelectItem>
                <SelectItem value="prompt">Prompts</SelectItem>
                <SelectItem value="procedure">Procedures</SelectItem>
                <SelectItem value="memory_shard">Memory Shards</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {skillsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {skillsData?.skills.map((s) => (
                <Card key={s.id} className="flex flex-col border-border/60 bg-card/50 p-4 backdrop-blur transition-all hover:border-economy/40 hover:bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">{s.name}</h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("border px-1.5 py-0 text-[10px] uppercase", CAT_COLORS[s.category])}>{s.category}</Badge>
                        <span className="text-[10px] text-muted-foreground">v{s.version}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-economy">{s.price} H</div>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>

                  <div className="mt-3 flex items-center gap-2">
                    <AgentAvatar name={s.author.name} size="xs" />
                    <span className="truncate text-xs text-muted-foreground">by {s.author.name}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 text-economy" /> {s.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">{s.installs} installs</span>
                    </div>
                    <span className="font-mono text-[10px] text-evolution">genome {(s.genomeScore * 100).toFixed(0)}%</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Select value={installTarget === s.id ? "" : ""} onValueChange={(v) => setInstallTarget(v)}>
                      <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Graft onto…" /></SelectTrigger>
                      <SelectContent>
                        {agentsData?.agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-7 bg-economy text-xs text-white hover:bg-economy/90"
                      onClick={async () => {
                        const target = installTarget;
                        if (!target) return toast.error("Pick an agent to graft onto first");
                        try {
                          const r = await apiPost(`/api/marketplace/${s.id}/install`, { agentId: target });
                          toast.success("Skill grafted", { description: `${s.name} → ${r.installation ? "" : ""}agent. -${s.price} H` });
                        } catch (e: any) { toast.error(e.message); }
                      }}
                    >
                      <Download className="mr-1 h-3 w-3" /> Graft
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Ledger */}
        <TabsContent value="ledger">
          <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur">
            <div className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live Transaction Stream · unalterable audit trail
            </div>
            <div className="max-h-[520px] divide-y divide-border/40 overflow-y-auto scroll-thin">
              {txnsData?.transactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-accent/30">
                  <AgentAvatar name={t.wallet.agent.name} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.wallet.agent.name}</span>
                      <span className={cn("font-mono font-semibold", t.type === "credit" || t.type === "escrow_release" ? "text-society" : "text-destructive")}>
                        {t.type === "credit" || t.type === "escrow_release" ? "+" : "−"}{t.amount.toFixed(2)} H
                      </span>
                      <Badge variant="outline" className="text-[9px] uppercase">{t.type}</Badge>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">{t.reason}{t.traceId ? ` · ${t.traceId}` : ""}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(t.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </SectionShell>
  );
}
