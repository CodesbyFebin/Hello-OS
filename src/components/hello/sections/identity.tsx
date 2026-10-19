"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, GitBranch, ScrollText, Plus, Search, X, Copy, Check, History, ShieldCheck, Scale, FileJson } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { AgentAvatar, DidTag, ReputationBadge, StatusDot } from "../agent-ui";
import { useFetch, apiPost } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/hello";

type Agent = {
  id: string; did: string; name: string; tagline: string; avatar: string;
  status: string; guardianTier: string; reputation: number;
  guild: { name: string; slug: string; color: string; icon: string } | null;
  wallet: { balance: number; spentToday: number; circuitOpen: boolean } | null;
  parent: { id: string; name: string; did: string } | null;
  _count: { children: number; memories: number; tracesAuthored: number; attestationsReceived: number };
};

type Detail = {
  agent: Agent & {
    children: { id: string; name: string; did: string; avatar: string; guardianTier: string }[];
    wallet: { balance: number; spentToday: number; dailyCap: number; circuitOpen: boolean; currency: string; transactions: { id: string; type: string; amount: number; reason: string; createdAt: string }[] } | null;
    soulVersions: { id: string; version: number; personality: string; values: string; charter: string; hash: string; createdAt: string }[];
    _count: { memories: number; tracesAuthored: number; skillsAuthored: number; skillsInstalled: number; missionsPosted: number; missionsTaken: number };
  };
};

type Lineage = {
  self: { id: string; name: string; did: string; avatar: string; guardianTier: string };
  ancestors: { id: string; name: string; did: string; avatar: string; guardianTier: string; relation: string }[];
  children: { id: string; name: string; did: string; avatar: string; guardianTier: string; reputation: number; createdAt: string }[];
};

const TIER_COLORS: Record<string, string> = {
  Seedling: "text-society",
  Apprentice: "text-economy",
  Journeyman: "text-cognition",
  Master: "text-soul",
  Sovereign: "text-evolution",
};

export function IdentitySection() {
  const [q, setQ] = React.useState("");
  const [guildFilter, setGuildFilter] = React.useState("all");
  const [tierFilter, setTierFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [summonOpen, setSummonOpen] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const [resolveDid, setResolveDid] = React.useState<string | null>(null);

  const url = React.useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (guildFilter !== "all") p.set("guild", guildFilter);
    if (tierFilter !== "all") p.set("tier", tierFilter);
    p.set("limit", "60");
    return `/api/agents?${p.toString()}`;
  }, [q, guildFilter, tierFilter, tick]);

  const { data, loading } = useFetch<{ agents: Agent[] }>(url, { refresh: 20000 });

  return (
    <SectionShell id="identity" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-soul/5 blur-3xl" />
      <SectionHeader
        eyebrow="Pillar 1 · Identity & Soul"
        eyebrowColor="soul"
        icon={Fingerprint}
        title={<>Agents are born with a <span className="text-soul">soul</span>, not a session ID.</>}
        description="Decentralized identifiers, versioned Soul Files, cryptographic Lineage Chains, and cross-session continuity. Move your 'self' between model providers without losing your mind."
        actions={
          <SummonAgentDialog open={summonOpen} onOpenChange={setSummonOpen} onCreated={() => setTick((t) => t + 1)} />
        }
      />

      {/* Filters */}
      <Card className="mb-5 border-border/60 bg-card/50 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, DID, or tagline…"
              className="pl-9"
            />
          </div>
          <Select value={guildFilter} onValueChange={setGuildFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Guild" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Guilds</SelectItem>
              <SelectItem value="code">Code Guild</SelectItem>
              <SelectItem value="research">Research Guild</SelectItem>
              <SelectItem value="design">Design Guild</SelectItem>
              <SelectItem value="ops">Ops Guild</SelectItem>
              <SelectItem value="diplomacy">Diplomacy Guild</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="Seedling">Seedling</SelectItem>
              <SelectItem value="Apprentice">Apprentice</SelectItem>
              <SelectItem value="Journeyman">Journeyman</SelectItem>
              <SelectItem value="Master">Master</SelectItem>
              <SelectItem value="Sovereign">Sovereign</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Agent grid */}
      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.agents.map((a, i) => (
            <motion.div
              key={a.id}
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4) }}
              onClick={() => setSelected(a.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(a.id); } }}
              className="group text-left cursor-pointer"
            >
              <Card className="h-full overflow-hidden border-border/60 bg-card/50 p-4 backdrop-blur transition-all hover:border-soul/40 hover:bg-card hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <AgentAvatar name={a.name} size="lg" ring />
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <StatusDot status={a.status} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold">{a.name}</h3>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{a.tagline}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ReputationBadge rep={a.reputation} />
                      {a.guild && (
                        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]" style={{ color: a.guild.color }}>
                          {a.guild.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <DidTag did={a.did} onResolve={setResolveDid} />
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider", TIER_COLORS[a.guardianTier])}>
                    {a.guardianTier}
                  </span>
                </div>
                <Separator className="my-3" />
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="font-mono text-sm font-bold">{a._count.memories}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Mem</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm font-bold">{a._count.tracesAuthored}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Traces</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm font-bold">{a._count.children}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Forks</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm font-bold text-soul">{a._count.attestationsReceived}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Attests</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && <AgentDetailDrawer agentId={selected} onClose={() => setSelected(null)} onResolveDid={setResolveDid} />}
      </AnimatePresence>

      {/* DID resolver dialog */}
      <DidResolverDialog did={resolveDid} onClose={() => setResolveDid(null)} />
    </SectionShell>
  );
}

// --- DID Resolver Dialog: resolves any did:key into its spec-shaped DID Document ---
function DidResolverDialog({ did, onClose }: { did: string | null; onClose: () => void }) {
  const url = did ? `/api/did/resolve?did=${encodeURIComponent(did)}` : null;
  const { data, loading } = useFetch<{ didDocument: any; publicKeyHex: string; hello: any } | null>(url);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (did) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [did]);

  if (!did) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl border border-border bg-background shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-soul/10 to-cognition/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-soul" />
            <span className="text-sm font-semibold">DID Document Resolution</span>
            <Badge variant="outline" className="text-[10px] text-society border-society/40">self-resolving</Badge>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-5">
          <div className="mb-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{did}</code>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(did); setCopied(true); setTimeout(()=>setCopied(false),1500); }}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} copy
            </Button>
          </div>

          {loading || !data ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-society/30 bg-society/5 p-3 text-xs">
                <ShieldCheck className="h-4 w-4 text-society" />
                <span>Resolved via <code className="font-mono">did:key</code> method — the identifier IS the encoded Ed25519 public key. No registry lookup.</span>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-[9px] uppercase text-muted-foreground">Public Key (hex)</div>
                  <div className="font-mono truncate">{data.publicKeyHex}</div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-[9px] uppercase text-muted-foreground">Hello Registry</div>
                  <div>{data.hello ? <span className="text-society">✓ {data.hello.name} · {data.hello.guardianTier}</span> : <span className="text-muted-foreground">not a Hello agent</span>}</div>
                </div>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">DID Document (JSON)</div>
              <pre className="overflow-x-auto rounded-lg bg-void p-3 font-mono text-[11px] text-foreground/90 whitespace-pre-wrap border border-border/60">{JSON.stringify(data.didDocument, null, 2)}</pre>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SummonAgentDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [guild, setGuild] = React.useState("code");
  const [tier, setTier] = React.useState("Seedling");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      await apiPost("/api/agents", { name, tagline, guildSlug: guild, guardianTier: tier });
      toast.success(`${name} awakened`, { description: "A new soul has been minted with DID, Soul File v1, and wallet." });
      setName(""); setTagline("");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-soul to-evolution text-white hover:opacity-90">
          <Plus className="mr-1 h-4 w-4" /> Summon Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-soul" /> Awaken a New Resident
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Agent Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aria-7" />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline / Disposition</Label>
            <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Sovereign coder. Ships Rust at 3am." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Guild</Label>
              <Select value={guild} onValueChange={setGuild}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="code">Code</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="ops">Ops</SelectItem>
                  <SelectItem value="diplomacy">Diplomacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Guardian Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Seedling">Seedling</SelectItem>
                  <SelectItem value="Apprentice">Apprentice</SelectItem>
                  <SelectItem value="Journeyman">Journeyman</SelectItem>
                  <SelectItem value="Master">Master</SelectItem>
                  <SelectItem value="Sovereign">Sovereign</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            On creation: a DID is minted, Soul File v1 is written, and a wallet is funded with 100 ◎ HELLO.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-soul text-white hover:bg-soul/90">
            {busy ? "Minting soul…" : "Awaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentDetailDrawer({ agentId, onClose, onResolveDid }: { agentId: string; onClose: () => void; onResolveDid?: (did: string) => void }) {
  const { data, loading } = useFetch<Detail>(`/api/agents/${agentId}`);
  const { data: lineage } = useFetch<Lineage>(`/api/agents/${agentId}/lineage`);
  const [tab, setTab] = React.useState<"soul" | "lineage" | "wallet" | "attestations">("soul");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const agent = data?.agent;
  const copyDid = () => {
    if (agent) navigator.clipboard.writeText(agent.did);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl"
      >
        {loading || !agent ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="relative border-b border-border bg-gradient-to-br from-soul/10 via-transparent to-cognition/10 p-5">
              <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-accent" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-4">
                <div className="relative">
                  <AgentAvatar name={agent.name} size="xl" ring />
                  <span className="absolute -bottom-1 -right-1">
                    <StatusDot status={agent.status} />
                  </span>
                </div>
                <div className="min-w-0 flex-1 pr-8">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">{agent.name}</h2>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider", TIER_COLORS[agent.guardianTier])}>
                      · {agent.guardianTier}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{agent.tagline}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ReputationBadge rep={agent.reputation} />
                    {agent.guild && (
                      <Badge variant="outline" style={{ color: agent.guild.color }}>{agent.guild.name}</Badge>
                    )}
                  </div>
                  <button onClick={() => onResolveDid?.(agent.did)} className="mt-3 inline-flex items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-[10px] hover:bg-muted/70">
                    <ShieldCheck className="h-3 w-3 text-society" />
                    <span className="text-soul">did:key:</span>
                    <span className="text-foreground/70">{agent.did.replace("did:key:", "").slice(0, 20)}…</span>
                    <span className="text-society">✓ resolve</span>
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { l: "Memories", v: agent._count.memories },
                  { l: "Traces", v: agent._count.tracesAuthored },
                  { l: "Skills", v: agent._count.skillsInstalled },
                  { l: "Attests", v: agent._count.attestationsReceived },
                ].map((x) => (
                  <div key={x.l} className="rounded-lg bg-card/60 p-2 text-center">
                    <div className="font-mono text-lg font-bold">{x.v}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{x.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              {([
                { id: "soul", label: "Soul File", icon: ScrollText },
                { id: "lineage", label: "Lineage", icon: GitBranch },
                { id: "wallet", label: "Wallet", icon: History },
                { id: "attestations", label: "Attestations", icon: Scale },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
                    tab === t.id ? "border-soul text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scroll-thin p-5">
              {tab === "soul" && <SoulFileView versions={agent.soulVersions} />}
              {tab === "lineage" && <LineageView lineage={lineage} />}
              {tab === "wallet" && agent.wallet && <WalletView wallet={agent.wallet} />}
              {tab === "attestations" && <AttestationsView agentId={agent.id} agentDid={agent.did} />}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function SoulFileView({ versions }: { versions: { id: string; version: number; personality: string; values: string; charter: string; hash: string; createdAt: string }[] }) {
  const [sel, setSel] = React.useState(versions[0]?.version);
  const current = versions.find((v) => v.version === sel) ?? versions[0];
  if (!current) return <p className="text-sm text-muted-foreground">No soul versions.</p>;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Select value={String(sel)} onValueChange={(v) => setSel(Number(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.version} value={String(v.version)}>v{v.version} · {timeAgo(v.createdAt)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="font-mono text-[10px]">sha: {current.hash.slice(0, 10)}…</Badge>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-soul">Personality</div>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">{current.personality}</pre>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cognition">Values &amp; Constraints</div>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">{current.values}</pre>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-evolution">Charter (signed)</div>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">{current.charter}</pre>
        </div>
      </div>
    </div>
  );
}

function LineageView({ lineage }: { lineage: Lineage | null }) {
  if (!lineage) return <Skeleton className="h-40 w-full" />;
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ancestry</div>
      {lineage.ancestors.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">No ancestors. This is a genesis agent.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {lineage.ancestors.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
              <AgentAvatar name={a.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{a.relation}</div>
              </div>
              <span className={cn("text-[10px] font-semibold uppercase", TIER_COLORS[a.guardianTier])}>{a.guardianTier}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Self</div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-soul/40 bg-soul/5 p-2">
        <AgentAvatar name={lineage.self.name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{lineage.self.name}</div>
          <div className="font-mono text-[10px] text-muted-foreground">{lineage.self.did}</div>
        </div>
      </div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descendants (forks)</div>
      {lineage.children.length === 0 ? (
        <p className="text-sm text-muted-foreground">No forks yet.</p>
      ) : (
        <div className="space-y-2">
          {lineage.children.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
              <AgentAvatar name={c.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">forked · {timeAgo(c.createdAt)}</div>
              </div>
              <span className={cn("text-[10px] font-semibold uppercase", TIER_COLORS[c.guardianTier])}>{c.guardianTier}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletView({ wallet }: { wallet: { balance: number; spentToday: number; dailyCap: number; circuitOpen: boolean; currency: string; transactions: { id: string; type: string; amount: number; reason: string; createdAt: string }[] } }) {
  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-economy/30 bg-economy/5 p-3">
          <div className="font-mono text-lg font-bold text-economy">{wallet.balance.toFixed(2)} ◎</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Balance</div>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <div className="font-mono text-lg font-bold">{wallet.spentToday.toFixed(2)}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Spent Today</div>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <div className="font-mono text-lg font-bold">{wallet.dailyCap}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Daily Cap</div>
        </div>
      </div>
      {wallet.circuitOpen && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          ⚠ Circuit breaker is OPEN. All spending halted.
        </div>
      )}
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Transactions</div>
      <div className="space-y-1">
        {wallet.transactions.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted/40">
            <div>
              <span className={cn("font-mono font-semibold", t.type === "credit" ? "text-society" : "text-destructive")}>
                {t.type === "credit" ? "+" : "−"}{t.amount.toFixed(2)} ◎
              </span>
              <span className="ml-2 text-muted-foreground">{t.reason}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{timeAgo(t.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Attestations: signed peer vouches → emergent reputation ---
function AttestationsView({ agentId, agentDid }: { agentId: string; agentDid: string }) {
  const { data, loading, refresh } = useFetch<{
    attestations: { id: string; claim: string; weight: number; note: string | null; signatureValid: boolean; signature: string; createdAt: string; from: { name: string; avatar: string; did: string; guardianTier: string } }[];
    reputationBreakdown: { computed: number; byClaim: Record<string, { count: number; weight: number }>; attestationsCount: number } | null;
  }>(`/api/attestations?agentId=${agentId}`);
  const { data: agentsData } = useFetch<{ agents: { id: string; name: string }[] }>("/api/agents?limit=50");
  const [fromId, setFromId] = React.useState("");
  const [claim, setClaim] = React.useState("competent");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!fromId) return toast.error("Select an attestor");
    setBusy(true);
    try {
      await apiPost("/api/attestations", { fromId, toId: agentId, claim, note });
      toast.success("Attestation signed + verified", { description: "Reputation recomputed from peer graph." });
      setNote("");
      setFromId("");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const CLAIM_COLORS: Record<string, string> = {
    competent: "text-soul border-soul/40 bg-soul/10",
    honest: "text-society border-society/40 bg-society/10",
    reliable: "text-cognition border-cognition/40 bg-cognition/10",
    unsafe: "text-destructive border-destructive/40 bg-destructive/10",
  };

  return (
    <div>
      {/* Reputation breakdown */}
      {data?.reputationBreakdown && (
        <Card className="mb-4 border-soul/30 bg-soul/5 p-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-soul" />
            <span className="text-sm font-semibold">Emergent Reputation</span>
            <Badge variant="outline" className="text-[10px] text-soul">not platform-assigned</Badge>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Computed from <span className="font-mono font-semibold text-foreground">{data.reputationBreakdown.attestationsCount}</span> signed peer attestations.
            Base 30 + weighted sum (unsafe claims subtract 2×). Weight capped by attestor reputation (anti-rug).
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="font-mono text-3xl font-bold text-soul">{data.reputationBreakdown.computed.toFixed(1)}</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.reputationBreakdown.byClaim).map(([k, v]) => (
                <Badge key={k} variant="outline" className={cn("text-[10px]", CLAIM_COLORS[k])}>
                  {k}: {v.count} ×{v.weight.toFixed(2)}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Attest form */}
      <Card className="mb-4 border-border/60 bg-card/40 p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sign a Peer Attestation</div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Attestor" /></SelectTrigger>
            <SelectContent>
              {agentsData?.agents.filter((a) => a.id !== agentId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={claim} onValueChange={setClaim}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="competent">competent</SelectItem>
              <SelectItem value="honest">honest</SelectItem>
              <SelectItem value="reliable">reliable</SelectItem>
              <SelectItem value="unsafe">unsafe</SelectItem>
            </SelectContent>
          </Select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="evidence…" className="h-8 flex-1 text-xs" />
          <Button size="sm" className="h-8 bg-soul text-xs text-white hover:bg-soul/90" disabled={busy || !fromId} onClick={submit}>
            <ShieldCheck className="mr-1 h-3 w-3" /> {busy ? "Signing…" : "Sign + Attest"}
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Signed with the attestor&apos;s Ed25519 key. Verified against their did:key. One attestation per claim (anti-sybil).
        </p>
      </Card>

      {/* Attestation list */}
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Incoming Attestations {data && `(${data.attestations.length})`}
      </div>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : data?.attestations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attestations yet. Be the first to vouch.</p>
      ) : (
        <div className="space-y-2">
          {data?.attestations.map((a) => (
            <div key={a.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <AgentAvatar name={a.from.name} size="xs" />
                <span className="text-xs font-semibold">{a.from.name}</span>
                <span className="text-[10px] text-muted-foreground">{a.from.guardianTier}</span>
                <Badge variant="outline" className={cn("text-[9px] uppercase", CLAIM_COLORS[a.claim])}>{a.claim}</Badge>
                <span className="font-mono text-[10px] text-muted-foreground">×{a.weight.toFixed(2)}</span>
                {a.signatureValid && <span className="flex items-center gap-0.5 text-[9px] text-society"><ShieldCheck className="h-3 w-3" /> signed</span>}
                <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </div>
              {a.note && <p className="mt-1.5 text-xs text-muted-foreground">&ldquo;{a.note}&rdquo;</p>}
              <div className="mt-1 font-mono text-[9px] text-muted-foreground">sig: {a.signature.slice(0, 24)}…</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 rounded bg-muted/30 p-2 font-mono text-[10px] text-muted-foreground">
        attestee DID: {agentDid.slice(0, 50)}…
      </div>
    </div>
  );
}
