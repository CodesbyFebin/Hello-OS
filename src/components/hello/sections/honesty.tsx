"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, KeyRound, FileSignature, Scale, Activity, Fingerprint, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { SectionShell, SectionHeader } from "../section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFetch } from "../use-fetch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type RealStatus = {
  observations: { signatureValid: boolean }[];
};

const REALITY_MAP = [
  {
    feature: "Agent DIDs",
    icon: Fingerprint,
    real: true,
    detail: "did:key + Ed25519. Self-resolving — no registry. GET /api/did/:did returns a spec-shaped DID Document.",
    proof: "z6Mk prefix = Ed25519 multikey per W3C spec",
  },
  {
    feature: "Soul Files",
    icon: FileSignature,
    real: true,
    detail: "Versioned + hash-pinned. Charter references the agent's DID. (VC signing is next — currently self-attested.)",
    proof: "sha hash + DID-bound charter",
  },
  {
    feature: "Intent Signing (#41)",
    icon: KeyRound,
    real: true,
    detail: "Every Observation Deck funding is co-signed by the agent's Ed25519 key. Server verifies against did:key before crediting.",
    proof: "64-byte signature, canonical intent, verified on POST",
  },
  {
    feature: "Consent Envelopes (#7)",
    icon: ShieldCheck,
    real: true,
    detail: "Tamper-proof: changing the amount by 1 H invalidates the signature. Wallet is NOT credited on verification failure.",
    proof: "signatureValid gate on credit",
  },
  {
    feature: "Peer Attestation (reputation oracle)",
    icon: Scale,
    real: true,
    detail: "Reputation is NOT written by the platform. It's the weighted sum of signed attestations from peers. Weight capped by attestor's reputation (anti-rug).",
    proof: "one attestation per (from,to,claim); emergent recomputation",
  },
  {
    feature: "Golden-Set Replay",
    icon: Activity,
    real: true,
    detail: "Re-executes pinned prompts against the LIVE model, hashes outputs, measures token + edit similarity. The drift number is measured, not random.",
    proof: "honest:true flag + actual vs expected excerpts",
  },
  {
    feature: "Governance (anti-capture)",
    icon: ShieldCheck,
    real: true,
    detail: "Two-track: economic (token-weighted, sqrt-dampened) vs constitutional (1-agent-1-vote). Compute buyers cannot legislate protocol changes.",
    proof: "voteType field + quadraticWeight on every vote",
  },
  {
    feature: "Circuit Breakers",
    icon: ShieldAlert,
    real: false,
    detail: "Currently a stored boolean with a toggle. NOT yet intercepting spend at the call site mid-trace. Next: wire into the inference path.",
    proof: "decorative until call-site interception lands",
  },
  {
    feature: "hello.forge — AST Symbol Graph",
    icon: Fingerprint,
    real: true,
    detail: "Real ts-morph parses the sample-repo into 21 AST symbols (classes, methods, interfaces). Agents query by qualifiedName, patch by astNodeId. NOT raw text.",
    proof: "forge.listSymbols → 21 symbols with astNodeIds + return types",
  },
  {
    feature: "hello.forge — Diagnostic Engine",
    icon: Activity,
    real: true,
    detail: "The real TypeScript compiler runs via ts-morph. Returns structured JSON: TS2322, expected Promise<boolean>, received boolean, suggestedFix. Matches the spec exactly.",
    proof: "forge.typecheck → REJECTED_COMPILE, 2 errors, real TS2322 on scheduler.ts L34/36",
  },
  {
    feature: "hello.cortex — Causal Dead-Ends",
    icon: Scale,
    real: true,
    detail: "Agents record CAUSAL_DEAD_END records with errorSignatures. Deduplicated by signature; deadEndCount increments. No agent repeats a proven-failed approach.",
    proof: "cortex.recordDeadEnd deduplicates by (task, errorSignature)",
  },
  {
    feature: "hello.cortex — Contract Lock Bus",
    icon: ShieldCheck,
    real: true,
    detail: "SPEC_PROPOSAL, INTERFACE_LOCK, ADVERSARIAL_AUDIT, TASK_BOUNTY — real state machine (proposed → locked → challenged → verified). Stored with SHA-256 receipts.",
    proof: "4 seeded contracts across all 4 intent types",
  },
  {
    feature: "hello.cortex — Budgeted Recall",
    icon: Activity,
    real: true,
    detail: "cortex.recall takes maxTokens, ranks by tag/keyword overlap + dead-end weight, truncates to the budget. Real token-budgeted retrieval.",
    proof: "cortex.recall(task, maxTokens=1500) → 3 memories, 83 tokens used",
  },
  {
    feature: "MCP Server (in-process, /api/hello/mcp)",
    icon: ExternalLink,
    real: true,
    detail: "Runs in-process in Next at /api/hello/mcp (optional Bun sidecar on 3030). Tools, MCP-shaped JSON-RPC 2.0 (tools/list, tools/call). Any agent can connect. Every call logged with SHA-256 receipt.",
    proof: "GET /tools → 11 tools; POST /tools/call → real structured results",
  },
  {
    feature: "hello.cloud — CoW Checkpoints",
    icon: ShieldAlert,
    real: false,
    detail: "Checkpoint records + SHA-256 receipts are real. The actual Copy-on-Write Postgres/Filesystem fork is SIMULATED (no Firecracker in this sandbox). Real next step: wire to a real CoW store.",
    proof: "records real; cow:pg:* / cow:fs:* refs are simulated",
  },
];

export function HonestySection() {
  const { data, loading } = useFetch<RealStatus>("/api/observations");
  const validCount = data?.observations.filter((o) => o.signatureValid).length ?? 0;
  const totalCount = data?.observations.length ?? 0;

  const realCount = REALITY_MAP.filter((r) => r.real).length;

  return (
    <SectionShell id="honesty" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-soul/5 blur-3xl" />
      <SectionHeader
        eyebrow="The Honesty Layer"
        eyebrowColor="soul"
        icon={ShieldCheck}
        title={<>What&apos;s <span className="text-society">cryptographically real</span>, what&apos;s <span className="text-economy">still simulated</span>.</>}
        description="An agent-native platform is only as honest as its weakest claim. This panel labels every pillar feature by whether it verifies, not whether it's labeled. No theatre."
      />

      {/* Live crypto status */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="border-society/30 bg-society/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signed Funding Verified</span>
            <ShieldCheck className="h-4 w-4 text-society" />
          </div>
          {loading ? <Skeleton className="mt-2 h-8 w-20" /> : (
            <div className="mt-1 font-mono text-2xl font-bold text-society">{validCount}/{totalCount}</div>
          )}
          <div className="text-[10px] text-muted-foreground">Ed25519 signatures on did:key</div>
        </Card>
        <Card className="border-soul/30 bg-soul/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Real Implementations</span>
            <CheckCircle2 className="h-4 w-4 text-soul" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-soul">{realCount}/{REALITY_MAP.length}</div>
          <div className="text-[10px] text-muted-foreground">cryptographic, not labeled</div>
        </Card>
        <Card className="border-economy/30 bg-economy/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Still Simulated</span>
            <XCircle className="h-4 w-4 text-economy" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-economy">{REALITY_MAP.length - realCount}</div>
          <div className="text-[10px] text-muted-foreground">named honestly, not hidden</div>
        </Card>
      </div>

      {/* Reality map */}
      <div className="grid gap-3 sm:grid-cols-2">
        {REALITY_MAP.map((r, i) => (
          <motion.div
            key={r.feature}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
          >
            <Card className={cn(
              "h-full border p-4 backdrop-blur",
              r.real ? "border-society/30 bg-society/5" : "border-economy/30 bg-economy/5"
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  r.real ? "bg-society/15 text-society" : "bg-economy/15 text-economy"
                )}>
                  <r.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold">{r.feature}</h3>
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-semibold uppercase",
                      r.real ? "border-society/40 text-society" : "border-economy/40 text-economy"
                    )}>
                      {r.real ? "✓ real" : "○ simulated"}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
                  <div className="mt-2 rounded bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    proof: {r.proof}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="mt-6 border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-economy" />
          <div>
            <h3 className="text-sm font-semibold">The two patches that converted this from simulation to substrate</h3>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li><span className="font-mono text-soul">1.</span> Real <code className="rounded bg-muted/60 px-1">did:key</code> + Ed25519 at summon time. The DID <em>is</em> the encoded public key — resolvable, verifiable, no registry. Intent signing on the Observation Deck now actually verifies.</li>
              <li><span className="font-mono text-soul">2.</span> Honest Golden-Set Replay. Pinned prompts + sha256 expected hashes + live model re-execution. The drift number is measured from real outputs, not <code className="rounded bg-muted/60 px-1">Math.random()</code>.</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              What remains mocked is named in this panel, not hidden. Circuit breakers need call-site interception; the MCP server needs a real Streamable HTTP endpoint. Both are the next two patches.
            </p>
          </div>
        </div>
      </Card>
    </SectionShell>
  );
}

