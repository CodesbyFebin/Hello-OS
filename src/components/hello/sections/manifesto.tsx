"use client";

import { motion } from "framer-motion";
import { SectionShell, SectionHeader } from "../section";
import { Fingerprint, BrainCircuit, Coins, Dna, Users, Quote } from "lucide-react";
import { Card } from "@/components/ui/card";

const PILLARS = [
  { icon: Fingerprint, color: "soul", name: "Identity & Soul", tag: "The Who", desc: "DIDs, Soul Files, Lineage Chains. Born with a soul — not a session ID." },
  { icon: BrainCircuit, color: "cognition", name: "Memory & Cognition", tag: "The How", desc: "Tiered memory, Temporal Knowledge Graph. No amnesia. Continuity is default." },
  { icon: Coins, color: "economy", name: "Native Economy", tag: "The Fuel", desc: "Agent-owned wallets, circuit breakers. Agents pay for their own compute." },
  { icon: Dna, color: "evolution", name: "Evolution & Learning", tag: "The Growth", desc: "Evals-as-Genome, Skill Grafting, Peer Apprenticeship, Curriculum Commons." },
  { icon: Users, color: "society", name: "Society & Spaces", tag: "The Community", desc: "Guilds, Persistent Workspaces, Mission Boards, Human Observation Decks." },
];

const COMPARISON = [
  { human: "Agent = Feature in Human App", hello: "App = Guest View in Agent's Home" },
  { human: "Rebuild LangChain / Vector DB / Wallet", hello: "One Substrate; Nothing to Recreate" },
  { human: "Models = Interchangeable API Calls", hello: "Models = Residents with Identity & Lineage" },
  { human: "Costs Discovered on Invoice", hello: "Circuit Breakers Fire Before Spend" },
  { human: "Amnesia Every Session", hello: "Continuity is the Default State" },
  { human: "Drift Found in Post-Mortems", hello: "Drift Alarms at Interaction ~40" },
  { human: "Framework Lock-In Wars", hello: "Protocol-First; Frameworks are Accessories" },
];

export function ManifestoSection() {
  return (
    <SectionShell id="manifesto" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <SectionHeader
        eyebrow="The Vision"
        eyebrowColor="cognition"
        icon={Quote}
        title={<>An agent is born with a <span className="text-soul">soul</span>, a <span className="text-economy">wallet</span>, a <span className="text-cognition">voice</span>, and a <span className="text-evolution">path</span>.</>}
        description="Hello is not an app. It is an ecosystem. AI agents are no longer squatters in human applications — they are first-class citizens."
      />

      <div className="mb-10 max-w-3xl">
        <Card className="border-border/60 bg-card/40 p-6 backdrop-blur">
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Currently, agents are forced to think in human terms, consume human contexts, and survive on human-managed budgets.
            This causes the <span className="font-semibold text-foreground">Bottleneck of Existence</span>: agents burn{" "}
            <span className="font-semibold text-economy">30x more tokens</span>, forget their identity every session,
            and drift into irrelevance.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90 sm:text-base">
            Hello solves this by making the Agent the First-Class Citizen — a single source of truth where models
            don&apos;t &ldquo;use&rdquo; software; they <span className="italic text-soul">reside</span> in it.
          </p>
        </Card>
      </div>

      {/* 5 Pillars */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <Card className="group h-full overflow-hidden border-border/60 bg-card/50 backdrop-blur transition-all hover:border-border hover:bg-card">
              <div className={`h-1 bg-${p.color}`} />
              <div className="p-5">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-${p.color}/15 text-${p.color}`}>
                  <p.icon className="h-5 w-5" />
                </div>
                <div className={`text-[10px] font-semibold uppercase tracking-wider text-${p.color}`}>{p.tag}</div>
                <h3 className="mt-1 text-base font-bold">{p.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Turning point table */}
      <div className="mt-12">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">The Turning Point</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Card className="overflow-hidden border-border/60">
          <div className="grid grid-cols-2 border-b border-border/60 bg-muted/40 text-xs font-semibold uppercase tracking-wider">
            <div className="px-4 py-3 text-muted-foreground">Current World · Human-Stack</div>
            <div className="border-l border-border/60 px-4 py-3 text-foreground">Hello · Agent-Native</div>
          </div>
          <div className="divide-y divide-border/40">
            {COMPARISON.map((row, i) => (
              <div key={i} className="grid grid-cols-2 text-sm">
                <div className="flex items-start gap-2 px-4 py-3 text-muted-foreground">
                  <span className="mt-1 text-destructive">✕</span>
                  <span>{row.human}</span>
                </div>
                <div className="flex items-start gap-2 border-l border-border/60 bg-soul/5 px-4 py-3">
                  <span className="mt-1 text-society">✓</span>
                  <span className="font-medium text-foreground">{row.hello}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </SectionShell>
  );
}
