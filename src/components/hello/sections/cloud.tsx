"use client";

import { motion } from "framer-motion";
import { Cloud, GitBranch, RotateCcw, CheckCircle2, ArrowRight } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { useFetch } from "../use-fetch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/hello";

type Checkpoint = {
  id: string; repoId: string; name: string; agentDid: string;
  dbSnapshotRef: string; fsSnapshotRef: string; status: string; receiptHash: string | null; createdAt: string;
};
type Data = { checkpoints: Checkpoint[] };

const STATUS_META: Record<string, { color: string; icon: any }> = {
  active: { color: "cognition", icon: GitBranch },
  rolled_back: { color: "destructive", icon: RotateCcw },
  promoted: { color: "society", icon: CheckCircle2 },
};

export function CloudSection() {
  const { data, loading } = useFetch<Data>("/api/hello/cloud/checkpoints");

  return (
    <SectionShell id="cloud" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-economy/5 blur-3xl" />
      <SectionHeader
        eyebrow="hello.cloud · time-travel compute"
        eyebrowColor="economy"
        icon={Cloud}
        title={<>Checkpoint before mutate. <span className="text-economy">Roll back atomically.</span></>}
        description="Before a risky migration, an agent calls cloud.checkpoint to fork a Copy-on-Write snapshot of the DB + filesystem. If shadow traffic spikes, the platform auto-reverts. (CoW FS is simulated; the checkpoint records + receipts are real.)"
      />

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border/60" />
          <div className="space-y-3">
            {data?.checkpoints.map((c, i) => {
              const meta = STATUS_META[c.status] ?? STATUS_META.active;
              const Icon = meta.icon;
              return (
                <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex gap-4">
                  <div className={cn("relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-background", `border-${meta.color}/40`)}>
                    <Icon className={cn("h-5 w-5", `text-${meta.color}`)} />
                  </div>
                  <Card className={cn("flex-1 border p-4 backdrop-blur", `border-${meta.color}/30 bg-${meta.color}/5`)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{c.name}</span>
                      <Badge variant="outline" className={cn("text-[9px] uppercase", `text-${meta.color}`)}>{c.status}</Badge>
                      <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]">
                      <div className="rounded bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">db snapshot: </span>
                        <span className="text-foreground">{c.dbSnapshotRef.slice(0, 24)}…</span>
                      </div>
                      <div className="rounded bg-muted/40 px-2 py-1">
                        <span className="text-muted-foreground">fs snapshot: </span>
                        <span className="text-foreground">{c.fsSnapshotRef.slice(0, 24)}…</span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
                      <span>by {c.agentDid.slice(0, 30)}…</span>
                      {c.receiptHash && <span>· rcpt {c.receiptHash.slice(0, 16)}</span>}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <Card className="mt-5 border-border/60 bg-card/40 p-4 backdrop-blur">
        <div className="flex items-start gap-3">
          <ArrowRight className="mt-0.5 h-4 w-4 text-economy" />
          <div>
            <h3 className="text-sm font-semibold">The 90-second deployment flow</h3>
            <ol className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              <li><span className="font-mono text-economy">T+0.1s</span> — Architect Agent publishes OpenAPI + SQL contract to hello.mesh → INTERFACE_LOCK</li>
              <li><span className="font-mono text-economy">T+0.5s</span> — DB Agent forks CoW Postgres; Backend Agent writes AST nodes; Frontend Agent builds against locked types</li>
              <li><span className="font-mono text-economy">T+12.0s</span> — QA Agent fuzzes the forked staging; finds race condition; rejects AST node with reproduction trace</li>
              <li><span className="font-mono text-economy">T+25.0s</span> — All gates green; hello.cloud promotes the microVM snapshot; SHA-256 receipt recorded in hello.ledger</li>
            </ol>
          </div>
        </div>
      </Card>
    </SectionShell>
  );
}
