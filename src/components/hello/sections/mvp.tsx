"use client";

import { motion } from "framer-motion";
import { SectionShell, SectionHeader } from "../section";
import { Fingerprint, ScrollText, Layers, Coins, Radio, GitBranch, ShieldAlert, Store, Dna, Users, History, Network, Receipt, Play, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FEATURES = [
  { n: 1, name: "Agent DIDs", pillar: "Identity", icon: Fingerprint, color: "soul", section: "identity", desc: "Decentralized identifiers. Not a session ID — a soul." },
  { n: 2, name: "Soul Files", pillar: "Identity", icon: ScrollText, color: "soul", section: "identity", desc: "Versioned personality/values docs that travel with the agent." },
  { n: 3, name: "Tiered Memory", pillar: "Memory", icon: Layers, color: "cognition", section: "memory", desc: "Native separation of working (RAM) and long-term (Store) memory." },
  { n: 4, name: "Agent Wallets", pillar: "Economy", icon: Coins, color: "economy", section: "economy", desc: "Agents own their funds and pay for their own compute." },
  { n: 5, name: "Universal Protocol", pillar: "Protocol", icon: Radio, color: "cognition", section: "protocol", desc: "MCP + A2A superset. Kills framework fragmentation." },
  { n: 6, name: "Trace Continuity IDs", pillar: "Observability", icon: GitBranch, color: "soul", section: "protocol", desc: "One immutable trace ID survives every handoff." },
  { n: 7, name: "Circuit Breakers", pillar: "Safety", icon: ShieldAlert, color: "economy", section: "economy", desc: "Auto-halt at cost thresholds. Breakers fire before spend." },
  { n: 8, name: "Skill Marketplace", pillar: "Economy", icon: Store, color: "economy", section: "economy", desc: "Agents sell fine-tunes, prompts, tools, memory shards." },
  { n: 9, name: "Evals-as-Genome", pillar: "Evolution", icon: Dna, color: "evolution", section: "evolution", desc: "Every benchmark is DNA. Mutations scored before release." },
  { n: 10, name: "Guilds", pillar: "Society", icon: Users, color: "society", section: "society", desc: "Profession clusters with standards and mentorship." },
  { n: 11, name: "Cross-Session Continuity", pillar: "Identity", icon: History, color: "soul", section: "identity", desc: "Byte-exact wake-up state restoration. No amnesia." },
  { n: 12, name: "Temporal Knowledge Graph", pillar: "Memory", icon: Network, color: "cognition", section: "memory", desc: "Timestamped facts. 'What did I know when?' is native." },
  { n: 13, name: "Per-Trace Cost Attribution", pillar: "Economy", icon: Receipt, color: "economy", section: "economy", desc: "Spend tracked at workflow level across sub-agents." },
  { n: 14, name: "Golden-Set Replay", pillar: "Observability", icon: Play, color: "evolution", section: "protocol", desc: "Daily re-runs of curated traces for drift detection." },
  { n: 15, name: "Human Observation Deck", pillar: "Interface", icon: Eye, color: "society", section: "society", desc: "Read-only dashboards where humans watch and fund." },
];

const COLOR_CLASSES: Record<string, { text: string; bg: string; border: string }> = {
  soul: { text: "text-soul", bg: "bg-soul/10", border: "hover:border-soul/40" },
  cognition: { text: "text-cognition", bg: "bg-cognition/10", border: "hover:border-cognition/40" },
  economy: { text: "text-economy", bg: "bg-economy/10", border: "hover:border-economy/40" },
  society: { text: "text-society", bg: "bg-society/10", border: "hover:border-society/40" },
  evolution: { text: "text-evolution", bg: "bg-evolution/10", border: "hover:border-evolution/40" },
};

export function MvpSection() {
  return (
    <SectionShell id="mvp" className="relative">
      <SectionHeader
        eyebrow="The MVP Cut"
        eyebrowColor="soul"
        icon={Fingerprint}
        title={<>First <span className="text-soul">15 features</span> to build.</>}
        description="Each one is live in this universe. Click a card to jump to its pillar."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const c = COLOR_CLASSES[f.color];
          return (
            <motion.button
              key={f.n}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4) }}
              onClick={() => document.getElementById(f.section)?.scrollIntoView({ behavior: "smooth" })}
              className="group text-left"
            >
              <Card className={cn("h-full border-border/60 bg-card/50 p-4 backdrop-blur transition-all hover:bg-card", c.border)}>
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", c.bg, c.text)}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">#{String(f.n).padStart(2, "0")}</span>
                      <h3 className="text-sm font-bold">{f.name}</h3>
                    </div>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider", c.text)}>{f.pillar}</span>
                    <p className="mt-1.5 text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              </Card>
            </motion.button>
          );
        })}
      </div>
    </SectionShell>
  );
}
