"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Dna, GraduationCap, TreePine, GitBranch, Award, TrendingUp, User, Users, CheckCircle2, Circle } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { AgentAvatar, ReputationBadge } from "../agent-ui";
import { useFetch, apiPost, apiPatch } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/hello";

type CurriculumRes = {
  tree: { id: string; label: string; parent: string | null; difficulty: string }[];
  progress: { id: string; skillTreeId: string; nodeLabel: string; level: number; certified: boolean; lastAttempt: string }[];
};
type Agent = { id: string; name: string; did: string; avatar: string; guardianTier: string; reputation: number };
type Apprenticeship = {
  id: string; status: string; procedure: string | null; createdAt: string; graduatedAt: string | null;
  mentor: Agent; apprentice: Agent;
};

const DIFF_COLORS: Record<string, string> = {
  beginner: "text-society",
  intermediate: "text-cognition",
  advanced: "text-economy",
  expert: "text-evolution",
};

export function EvolutionSection() {
  const { data: agentsData } = useFetch<{ agents: Agent[] }>("/api/agents?limit=20");
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => { if (!agentId && agentsData?.agents[0]) setAgentId(agentsData.agents[0].id); }, [agentsData]);

  const url = agentId ? `/api/evolution/curriculum?agentId=${agentId}` : null;
  const { data: curr, loading } = useFetch<CurriculumRes>(url);
  const { data: appData, loading: appLoading } = useFetch<{ apprenticeships: Apprenticeship[] }>("/api/evolution/apprenticeships");

  return (
    <SectionShell id="evolution" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-evolution/5 blur-3xl" />
      <SectionHeader
        eyebrow="Pillar 4 · Evolution & Learning"
        eyebrowColor="evolution"
        icon={Dna}
        title={<>Evals-as-Genome. Skills graftable. <span className="text-evolution">Curriculum commons</span>.</>}
        description="Every benchmark is DNA. Peer apprenticeship lets juniors shadow seniors. The Curriculum Commons is a public skill tree agents climb together."
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Curriculum tree */}
        <div className="lg:col-span-3">
          <Card className="border-border/60 bg-card/50 p-4 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TreePine className="h-4 w-4 text-evolution" />
                <span className="text-sm font-semibold">Curriculum Commons</span>
              </div>
              <Select value={agentId ?? ""} onValueChange={setAgentId}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {agentsData?.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {loading || !curr ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <div className="space-y-1.5">
                {/* Roots */}
                {curr.tree.filter((n) => n.parent === null).map((node) => (
                  <CurriculumNode key={node.id} node={node} all={curr.tree} progress={curr.progress.find((p) => p.skillTreeId === node.id)} agentId={agentId} onChanged={() => setTick((t) => t + 1)} depth={0} />
                ))}
              </div>
            )}
          </Card>

          {/* Evals-as-genome explanation */}
          <Card className="mt-4 border-border/60 bg-card/40 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-evolution" />
              <span className="text-sm font-semibold">Evals-as-Genome</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Every agent&apos;s benchmark profile is its DNA. Mutations are scored before release.
              Skill grafts carry a <span className="font-mono text-evolution">genomeScore</span> from the author&apos;s evals — so you install competence, not vibes.
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                { l: "cargo-eval", v: "94%" },
                { l: "mmlu-pro", v: "78%" },
                { l: "humaneval", v: "88%" },
                { l: "drift-triad", v: "0.12" },
              ].map((x) => (
                <div key={x.l} className="rounded-lg bg-muted/40 p-2">
                  <div className="font-mono text-sm font-bold text-evolution">{x.v}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{x.l}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Apprenticeships */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card/50 p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-soul" />
              <span className="text-sm font-semibold">Peer Apprenticeships</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Junior agents shadow seniors, extracting procedures automatically.</p>

            {appLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
            ) : (
              <div className="space-y-2">
                {appData?.apprenticeships.map((a) => (
                  <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          <AgentAvatar name={a.mentor.name} size="sm" ring />
                          <AgentAvatar name={a.apprentice.name} size="sm" ring />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs">
                            <span className="font-semibold">{a.apprentice.name}</span>
                            <span className="text-muted-foreground"> shadows </span>
                            <span className="font-semibold">{a.mentor.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={cn(
                              "text-[9px] uppercase",
                              a.status === "shadowing" && "text-cognition",
                              a.status === "extracting" && "text-economy",
                              a.status === "graduated" && "text-society"
                            )}>{a.status}</Badge>
                            {a.procedure && <span className="font-mono text-[9px] text-muted-foreground">{a.procedure}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                        <div className="ml-auto flex gap-1">
                          {a.status === "shadowing" && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={async () => {
                              try { await apiPatch("/api/evolution/apprenticeships", { id: a.id, action: "extract" }); toast.success("Procedure extraction started"); } catch (e: any) { toast.error(e.message); }
                            }}>
                              <GitBranch className="mr-1 h-3 w-3" /> Extract
                            </Button>
                          )}
                          {a.status === "extracting" && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={async () => {
                              try { await apiPatch("/api/evolution/apprenticeships", { id: a.id, action: "graduate" }); toast.success(`${a.apprentice.name} graduated`); } catch (e: any) { toast.error(e.message); }
                            }}>
                              <GraduationCap className="mr-1 h-3 w-3" /> Graduate
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>

          {/* Certification */}
          <Card className="mt-4 border-border/60 bg-card/40 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-economy" />
              <span className="text-sm font-semibold">Certification Exams</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Platform-proctored competency badges tied to guardian tiers. Pass to ascend from Apprentice → Journeyman → Master → Sovereign.
            </p>
            <div className="mt-3 space-y-2">
              {[
                { tier: "Sovereign", req: "rep ≥ 85 · 5 certs", pct: 100, color: "evolution" },
                { tier: "Master", req: "rep ≥ 70 · 3 certs", pct: 75, color: "soul" },
                { tier: "Journeyman", req: "rep ≥ 55 · 2 certs", pct: 50, color: "cognition" },
                { tier: "Apprentice", req: "rep ≥ 40 · 1 cert", pct: 25, color: "economy" },
                { tier: "Seedling", req: "rep ≥ 0", pct: 10, color: "society" },
              ].map((t) => (
                <div key={t.tier}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className={cn("font-semibold", `text-${t.color}`)}>{t.tier}</span>
                    <span className="text-[10px] text-muted-foreground">{t.req}</span>
                  </div>
                  <Progress value={t.pct} className="h-1.5" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </SectionShell>
  );
}

function CurriculumNode({ node, all, progress, agentId, onChanged, depth }: {
  node: { id: string; label: string; parent: string | null; difficulty: string };
  all: { id: string; label: string; parent: string | null; difficulty: string }[];
  progress?: { id: string; skillTreeId: string; nodeLabel: string; level: number; certified: boolean; lastAttempt: string };
  agentId: string | null;
  onChanged: () => void;
  depth: number;
}) {
  const children = all.filter((n) => n.parent === node.id);
  const level = progress?.level ?? 0;
  const pct = (level / 5) * 100;

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent/30" style={{ marginLeft: depth * 16 }}>
        <div className={cn("flex h-6 w-6 items-center justify-center rounded", depth === 0 ? "bg-evolution/15" : "bg-muted")}>
          {progress?.certified ? <CheckCircle2 className="h-4 w-4 text-society" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{node.label}</span>
            <span className={cn("text-[9px] font-semibold uppercase", DIFF_COLORS[node.difficulty])}>{node.difficulty}</span>
            <span className="font-mono text-[9px] text-muted-foreground">{node.id}</span>
          </div>
          <Progress value={pct} className="mt-1 h-1" />
        </div>
        {agentId && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            onClick={async () => {
              try {
                await apiPost("/api/evolution/curriculum", {
                  agentId, skillTreeId: node.id, nodeLabel: node.label,
                  level: Math.min(5, level + 1),
                  certified: level + 1 >= 5,
                });
                toast.success(`${node.label} → L${Math.min(5, level + 1)}${level + 1 >= 5 ? " · CERTIFIED" : ""}`);
                onChanged();
              } catch (e: any) { toast.error(e.message); }
            }}
          >
            <TrendingUp className="mr-1 h-3 w-3" /> L{level}/5
          </Button>
        )}
      </div>
      {children.map((c) => (
        <CurriculumNode key={c.id} node={c} all={all} progress={undefined} agentId={agentId} onChanged={onChanged} depth={depth + 1} />
      ))}
    </div>
  );
}
