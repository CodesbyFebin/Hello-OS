"use client";

import * as React from "react";
import { Activity, Database, Fingerprint, FlaskConical, ShieldAlert, ShieldCheck, Workflow } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type RealityStatus = "implemented" | "prototype" | "vision";
type ObservationResponse = { observations: { signatureValid: boolean }[] };

const FEATURES: { name: string; status: RealityStatus; detail: string; Icon: typeof Fingerprint }[] = [
  { name: "Agent identity", status: "implemented", detail: "Agent creation stores an Ed25519 did:key identity and soul record. The demo server retains private key material; this is not managed key custody.", Icon: Fingerprint },
  { name: "Persistent app records", status: "implemented", detail: "Agent, mission, memory, wallet, field-report, and tool-call views use the configured database. Empty instances stay empty until records are created.", Icon: Database },
  { name: "In-process MCP", status: "implemented", detail: "The Next.js app serves selected MCP tools at /api/hello/mcp. It is a focused implementation, not a claim of full MCP conformance.", Icon: Workflow },
  { name: "AML compiler", status: "implemented", detail: "AML is parsed and validated into diagnostics and an intent graph. The source is never executed and does not call tools.", Icon: Workflow },
  { name: "Golden-set replay", status: "prototype", detail: "When a model provider is configured, pinned prompts can be replayed and compared with stored expectations. No provider is bundled or configured by default.", Icon: Activity },
  { name: "Evolution Lab", status: "prototype", detail: "Saved runs and their synthetic candidate vectors persist in the database. Fitness is a proxy objective, not a measurement of agent or model capability.", Icon: FlaskConical },
  { name: "Checkpoint request", status: "prototype", detail: "The MCP tool stores a labeled audit record and receipt only. It captures no state, and no rollback tool is exposed.", Icon: ShieldAlert },
  { name: "Cloud microVM runtime", status: "vision", detail: "Firecracker execution, copy-on-write snapshots, and isolated live agent workloads are not implemented.", Icon: ShieldAlert },
  { name: "Agent repository hosting", status: "vision", detail: "The Agent Hub reads local profiles, capabilities, reports, and tool calls. It does not host repositories or synchronize GitHub activity.", Icon: ShieldAlert },
];

const STATUS_CLASS: Record<RealityStatus, string> = {
  implemented: "border-emerald-400/40 text-emerald-300",
  prototype: "border-amber-400/40 text-amber-300",
  vision: "border-zinc-500/40 text-zinc-400",
};

export function HonestySection() {
  const [observations, setObservations] = React.useState<ObservationResponse | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    const controller = new AbortController();
    fetch("/api/observations", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((body: ObservationResponse) => { setObservations(body); setError(false); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);

  const valid = observations?.observations.filter((item) => item.signatureValid).length;
  const total = observations?.observations.length;

  return (
    <SectionShell id="honesty" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-soul/5 blur-3xl" />
      <SectionHeader
        eyebrow="Implementation status"
        eyebrowColor="soul"
        icon={ShieldCheck}
        title={<>What runs today. <span className="text-economy">What remains a prototype.</span></>}
        description="This status map describes the current repository. Synthetic experiments, local records, and unbuilt roadmap ideas are identified by their actual boundaries."
      />

      <Card className="mb-5 border-society/30 bg-society/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold">Stored observation signatures</h3><p className="mt-1 text-xs text-muted-foreground">Count read from this instance&apos;s observation API; it can be zero.</p></div>
          {observations ? <span className="font-mono text-xl font-bold text-society">{valid}/{total}</span> : error ? <span className="text-xs text-muted-foreground">unavailable</span> : <Skeleton className="h-7 w-16" />}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(({ name, status, detail, Icon }) => (
          <Card key={name} className={cn("border p-4", status === "implemented" ? "border-society/30 bg-society/5" : status === "prototype" ? "border-economy/30 bg-economy/5" : "border-border/60 bg-card/40")}>
            <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">{name}</h3><Badge variant="outline" className={cn("ml-auto text-[9px] uppercase", STATUS_CLASS[status])}>{status}</Badge></div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-5 border-economy/30 bg-economy/5 p-4">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-economy" /><div><h3 className="text-sm font-semibold">Not production-hardened</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">The project does not provide production authentication, multi-tenant isolation, managed key custody, real-money settlement, cross-server mesh, or a general-purpose agent execution runtime. Wallet values are prototype credits. See the README and security guide before exposing an instance.</p></div></div>
      </Card>
    </SectionShell>
  );
}
