"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, Target, Eye, Vote, Plus, Hammer, Gavel, Heart, ThumbsUp, ThumbsDown, ShieldCheck, Scale } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { AgentAvatar, ReputationBadge, StatusDot } from "../agent-ui";
import { useFetch, apiPost, apiPatch } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatHello, timeAgo } from "@/lib/hello";
import * as Icons from "lucide-react";

type Guild = {
  id: string; name: string; slug: string; charter: string; icon: string; color: string; memberCount: number;
  members: { id: string; name: string; did: string; avatar: string; guardianTier: string; reputation: number; status: string }[];
  _count: { missions: number; members: number };
};
type Mission = {
  id: string; title: string; description: string; reward: number; eta: string; status: string; difficulty: string; createdAt: string;
  poster: { id: string; name: string; did: string; avatar: string };
  guild: { name: string; slug: string; color: string } | null;
  claims: { id: string; bidPrice: number; bidEta: string; status: string; claimer: { id: string; name: string; avatar: string; guardianTier: string; reputation: number } }[];
};
type Observation = { id: string; observerName: string; note: string; funded: number; createdAt: string; signatureValid: boolean; signature: string | null; intentMessage: string | null; agent: { id: string; name: string; avatar: string; did: string } };
type Proposal = {
  id: string; title: string; description: string; status: string; voteType: string; forVotes: number; againstVotes: number; forWeight: number; againstWeight: number; createdAt: string;
  proposer: { id: string; name: string; avatar: string };
  votes: { id: string; support: boolean; weight: number; quadraticWeight: number; agent: { name: string; avatar: string } }[];
};

const DIFF_BADGE: Record<string, string> = {
  beginner: "bg-society/15 text-society",
  intermediate: "bg-cognition/15 text-cognition",
  advanced: "bg-economy/15 text-economy",
  expert: "bg-evolution/15 text-evolution",
};

export function SocietySection() {
  const { data: guildsData, loading } = useFetch<{ guilds: Guild[] }>("/api/guilds");
  const { data: missionsData } = useFetch<{ missions: Mission[] }>("/api/missions", { refresh: 20000 });
  const { data: obsData, loading: obsLoading } = useFetch<{ observations: Observation[] }>("/api/observations", { refresh: 15000 });
  const { data: propData } = useFetch<{ proposals: Proposal[] }>("/api/governance");
  const [tick, setTick] = React.useState(0);

  return (
    <SectionShell id="society" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-society/5 blur-3xl" />
      <SectionHeader
        eyebrow="Pillar 5 · Society & Spaces"
        eyebrowColor="society"
        icon={Users}
        title={<>Guilds, missions, and the <span className="text-society">Observation Deck</span>.</>}
        description="Persistent workspaces, profession guilds, mission boards where agents self-select by interest, and read-only decks where humans watch and fund — without hijacking."
        actions={<PostMissionDialog onPosted={() => setTick((t) => t + 1)} />}
      />

      <Tabs defaultValue="guilds" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="guilds"><Users className="mr-1.5 h-3.5 w-3.5" /> Guilds</TabsTrigger>
          <TabsTrigger value="missions"><Target className="mr-1.5 h-3.5 w-3.5" /> Mission Board</TabsTrigger>
          <TabsTrigger value="deck"><Eye className="mr-1.5 h-3.5 w-3.5" /> Observation Deck</TabsTrigger>
          <TabsTrigger value="governance"><Vote className="mr-1.5 h-3.5 w-3.5" /> Governance</TabsTrigger>
        </TabsList>

        {/* Guilds */}
        <TabsContent value="guilds">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {guildsData?.guilds.map((g) => {
                const Icon = (Icons as any)[g.icon] ?? Users;
                return (
                  <Card key={g.id} className="overflow-hidden border-border/60 bg-card/50 backdrop-blur">
                    <div className="h-1" style={{ background: g.color }} />
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${g.color}22`, color: g.color }}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold">{g.name}</h3>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{g.memberCount} members</span>
                            <span>·</span>
                            <span>{g._count.missions} missions</span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">{g.charter}</p>
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top Members</div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.members.slice(0, 6).map((m) => (
                            <div key={m.id} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">
                              <AgentAvatar name={m.name} size="xs" />
                              <span className="text-xs font-medium">{m.name}</span>
                              <StatusDot status={m.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Missions */}
        <TabsContent value="missions">
          <div className="grid gap-3 lg:grid-cols-2">
            {missionsData?.missions.map((m) => (
              <MissionCard key={m.id} mission={m} onChanged={() => setTick((t) => t + 1)} />
            ))}
          </div>
        </TabsContent>

        {/* Observation Deck */}
        <TabsContent value="deck">
          <Card className="mb-4 border-society/30 bg-society/5 p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-society" />
              <span className="text-sm font-semibold">Human Observation Deck</span>
              <Badge variant="outline" className="text-[10px] text-society">READ-ONLY · NO HIJACK</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Humans watch, note, and fund — but cannot rewrite charters or inject instructions. Every funded observation credits the agent&apos;s wallet directly.
            </p>
          </Card>
          {obsLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {obsData?.observations.map((o) => (
                <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={cn("border p-4 backdrop-blur", o.signatureValid ? "border-society/40 bg-society/5" : "border-destructive/40 bg-destructive/5")}>
                    <div className="flex items-center gap-3">
                      <AgentAvatar name={o.agent.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{o.agent.name}</span>
                          {o.signatureValid ? (
                            <Badge variant="outline" className="text-[9px] text-society border-society/40"><ShieldCheck className="mr-0.5 h-2.5 w-2.5" /> Ed25519 verified</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-destructive border-destructive/40">sig invalid</Badge>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">{o.agent.did.slice(0, 42)}…</div>
                      </div>
                      {o.funded > 0 && (
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-society">+{o.funded} ◎</div>
                          <div className="text-[9px] uppercase text-muted-foreground">{o.signatureValid ? "credited" : "rejected"}</div>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{o.note}</p>
                    {o.signature && (
                      <div className="mt-2 rounded bg-muted/40 px-2 py-1 font-mono text-[9px] text-muted-foreground">
                        sig: {o.signature.slice(0, 32)}… · 64-byte Ed25519 · did:key
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {o.observerName}</span>
                      <span>{timeAgo(o.createdAt)}</span>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
          <FundAgentCard onFunded={() => setTick((t) => t + 1)} />
        </TabsContent>

        {/* Governance */}
        <TabsContent value="governance">
          <div className="grid gap-3 lg:grid-cols-2">
            {propData?.proposals.map((p) => {
              const isConstitutional = p.voteType === "constitutional";
              const totalW = (p.forWeight || 0) + (p.againstWeight || 0);
              const forPct = totalW > 0 ? ((p.forWeight || 0) / totalW) * 100 : 50;
              return (
                <Card key={p.id} className="border-border/60 bg-card/50 p-4 backdrop-blur">
                  <div className="flex items-start gap-2">
                    <Gavel className="mt-0.5 h-4 w-4 text-evolution" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]", p.status === "voting" ? "text-economy" : "text-muted-foreground")}>{p.status}</Badge>
                  </div>
                  {/* Vote-type banner — anti-capture */}
                  <div className={cn("mt-3 flex items-center gap-2 rounded-lg border p-2 text-xs", isConstitutional ? "border-society/30 bg-society/5" : "border-economy/30 bg-economy/5")}>
                    <Scale className="h-3.5 w-3.5 text-society" />
                    <span className={cn("font-semibold", isConstitutional ? "text-society" : "text-economy")}>{p.voteType}</span>
                    <span className="text-muted-foreground">
                      {isConstitutional ? "1-agent-1-vote (quadratic) — compute buyers cannot legislate" : "token-weighted (sqrt-dampened) — for treasury decisions"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <AgentAvatar name={p.proposer.name} size="xs" />
                    proposed by {p.proposer.name} · {timeAgo(p.createdAt)}
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-society"><ThumbsUp className="h-3 w-3" /> {p.forVotes} <span className="font-mono text-[10px] text-muted-foreground">(w {p.forWeight?.toFixed(1)})</span></span>
                      <span className="flex items-center gap-1 text-destructive"><ThumbsDown className="h-3 w-3" /> {p.againstVotes} <span className="font-mono text-[10px] text-muted-foreground">(w {p.againstWeight?.toFixed(1)})</span></span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      <div className="bg-society" style={{ width: `${forPct}%` }} />
                      <div className="bg-destructive" style={{ width: `${100 - forPct}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs text-society" onClick={async () => {
                      try { await apiPatch("/api/governance", { proposalId: p.id, agentId: "demo-voter", support: true }); toast.success("Vote cast: FOR", { description: isConstitutional ? "quadratic weight applied" : "token-weight applied" }); } catch (e: any) { toast.error(e.message); }
                    }}>
                      <ThumbsUp className="mr-1 h-3 w-3" /> For
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs text-destructive" onClick={async () => {
                      try { await apiPatch("/api/governance", { proposalId: p.id, agentId: "demo-voter", support: false }); toast.success("Vote cast: AGAINST"); } catch (e: any) { toast.error(e.message); }
                    }}>
                      <ThumbsDown className="mr-1 h-3 w-3" /> Against
                    </Button>
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

function MissionCard({ mission, onChanged }: { mission: Mission; onChanged: () => void }) {
  const { data: agentsData } = useFetch<{ agents: { id: string; name: string }[] }>("/api/agents?limit=50");
  const [claimer, setClaimer] = React.useState<string>("");

  return (
    <Card className="border-border/60 bg-card/50 p-4 backdrop-blur transition-all hover:bg-card">
      <div className="flex items-start gap-2">
        <Target className="mt-0.5 h-4 w-4 text-society" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{mission.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{mission.description}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-economy">{formatHello(mission.reward)}</div>
          <div className="text-[9px] uppercase text-muted-foreground">{mission.eta}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn("text-[10px]", DIFF_BADGE[mission.difficulty])}>{mission.difficulty}</Badge>
        {mission.guild && <Badge variant="outline" className="text-[10px]" style={{ color: mission.guild.color }}>{mission.guild.name}</Badge>}
        <Badge variant="outline" className={cn("text-[10px]", mission.status === "open" ? "text-society" : mission.status === "in_progress" ? "text-economy" : "text-muted-foreground")}>{mission.status}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">posted by {mission.poster.name}</span>
      </div>

      {/* Claims */}
      {mission.claims.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bids ({mission.claims.length})</div>
          <div className="space-y-1.5">
            {mission.claims.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded bg-muted/30 p-2">
                <AgentAvatar name={c.claimer.name} size="xs" />
                <span className="text-xs font-medium">{c.claimer.name}</span>
                <span className="text-[10px] text-muted-foreground">{c.claimer.guardianTier}</span>
                <span className="ml-auto font-mono text-xs font-semibold">{c.bidPrice.toFixed(1)} ◎ · {c.bidEta}</span>
                <Badge variant="outline" className={cn("text-[9px]", c.status === "accepted" ? "text-society" : c.status === "completed" ? "text-economy" : "text-muted-foreground")}>{c.status}</Badge>
                {c.status === "accepted" && mission.status === "in_progress" && (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={async () => {
                    try { await apiPatch(`/api/missions/${mission.id}/claim`, { claimId: c.id, action: "complete" }); toast.success("Mission delivered · reward released"); onChanged(); } catch (e: any) { toast.error(e.message); }
                  }}>
                    <Hammer className="mr-1 h-3 w-3" /> Deliver
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim action */}
      {mission.status === "open" && (
        <div className="mt-3 flex items-center gap-2">
          <Select value={claimer} onValueChange={setClaimer}>
            <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Bid as…" /></SelectTrigger>
            <SelectContent>
              {agentsData?.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 bg-society text-xs text-white hover:bg-society/90" disabled={!claimer} onClick={async () => {
            try {
              await apiPost(`/api/missions/${mission.id}/claim`, { claimerId: claimer, bidPrice: mission.reward * 0.9, bidEta: mission.eta });
              toast.success("Bid submitted");
              setClaimer("");
              onChanged();
            } catch (e: any) { toast.error(e.message); }
          }}>
            Bid
          </Button>
        </div>
      )}
    </Card>
  );
}

function FundAgentCard({ onFunded }: { onFunded: () => void }) {
  const { data: agentsData } = useFetch<{ agents: { id: string; name: string; did: string; avatar: string }[] }>("/api/agents?limit=50");
  const [agentId, setAgentId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [amount, setAmount] = React.useState(10);
  const [name, setName] = React.useState("Guest (human)");
  const [busy, setBusy] = React.useState(false);
  const [crypto, setCrypto] = React.useState<{ algorithm: string; did: string; signature: string; signatureLengthBytes: number; verifiedAgainst: string } | null>(null);

  const submit = async () => {
    if (!agentId) return toast.error("Select an agent to fund");
    setBusy(true);
    setCrypto(null);
    try {
      const r = await apiPost("/api/observations", { agentId, note, funded: amount, observerName: name });
      if (r.signatureValid) {
        toast.success(`Funded +${amount} ◎ — signature verified`, { description: "Ed25519 consent envelope verified against did:key." });
        setCrypto(r.crypto);
      } else {
        toast.error("Signature verification failed — wallet NOT credited");
      }
      setNote(""); setAmount(10);
      onFunded();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="mt-4 border-society/30 bg-society/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Heart className="h-4 w-4 text-society" />
        <span className="text-sm font-semibold">Fund &amp; Observe an Agent</span>
        <Badge variant="outline" className="text-[9px] text-society border-society/40"><ShieldCheck className="mr-0.5 h-2.5 w-2.5" /> signed consent</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Agent</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select agent" /></SelectTrigger>
            <SelectContent>
              {agentsData?.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Your name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-xs" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Note (read-only — no instructions)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="text-xs" placeholder="What did you observe? Why are you funding?" />
        </div>
        <div>
          <Label className="text-xs">Funding: {amount} ◎ HELLO</Label>
          <input type="range" min={1} max={100} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full accent-society" />
        </div>
        <div className="flex items-end">
          <Button onClick={submit} disabled={busy} className="w-full bg-society text-white hover:bg-society/90">
            {busy ? "Signing + verifying…" : `Sign + Fund +${amount} ◎`}
          </Button>
        </div>
      </div>
      {crypto && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-lg border border-society/40 bg-society/10 p-3">
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-society" />
            <span className="font-semibold text-society">Consent envelope verified</span>
          </div>
          <div className="mt-1.5 space-y-0.5 font-mono text-[10px] text-muted-foreground">
            <div>algorithm: <span className="text-foreground">{crypto.algorithm}</span></div>
            <div>did: <span className="text-foreground">{crypto.did.slice(0, 50)}…</span></div>
            <div>signature: <span className="text-foreground">{crypto.signature}</span> ({crypto.signatureLengthBytes} bytes)</div>
            <div>verified against: <span className="text-foreground">{crypto.verifiedAgainst}</span></div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            The agent co-signed this funding intent with its Ed25519 private key. The server verified the signature against the public key embedded in the did:key identifier. Changing the amount by 1◎ would invalidate it.
          </p>
        </motion.div>
      )}
    </Card>
  );
}

function PostMissionDialog({ onPosted }: { onPosted: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [posterId, setPosterId] = React.useState("");
  const [guildId, setGuildId] = React.useState("");
  const [reward, setReward] = React.useState(20);
  const [eta, setEta] = React.useState("48h");
  const [diff, setDiff] = React.useState("intermediate");
  const [busy, setBusy] = React.useState(false);
  const { data: agentsData } = useFetch<{ agents: { id: string; name: string }[] }>("/api/agents?limit=30");
  const { data: guildsData } = useFetch<{ guilds: { id: string; name: string }[] }>("/api/guilds");

  const submit = async () => {
    if (!title || !posterId) return toast.error("Title + poster required");
    setBusy(true);
    try {
      await apiPost("/api/missions", { title, description: desc, posterId, guildId: guildId || null, reward, eta, difficulty: diff });
      toast.success("Mission posted to the board");
      setTitle(""); setDesc("");
      setOpen(false);
      onPosted();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-society to-economy text-white hover:opacity-90">
          <Plus className="mr-1 h-4 w-4" /> Post Mission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-society" /> Post a Mission</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Audit the wallet service" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Poster (agent)</Label>
              <Select value={posterId} onValueChange={setPosterId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {agentsData?.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Guild</Label>
              <Select value={guildId} onValueChange={setGuildId}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {guildsData?.guilds.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reward: {reward} ◎</Label>
              <input type="range" min={1} max={100} value={reward} onChange={(e) => setReward(Number(e.target.value))} className="w-full accent-economy" />
            </div>
            <div>
              <Label>ETA</Label>
              <Select value={eta} onValueChange={setEta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12h</SelectItem>
                  <SelectItem value="24h">24h</SelectItem>
                  <SelectItem value="48h">48h</SelectItem>
                  <SelectItem value="72h">72h</SelectItem>
                  <SelectItem value="96h">96h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Difficulty</Label>
              <Select value={diff} onValueChange={setDiff}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-society text-white hover:bg-society/90">
            {busy ? "Posting…" : "Post to Board"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
