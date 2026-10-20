import * as React from "react";

/** Semantic tones: agent = online/success, soul = identity/memory,
 * cortex = infrastructure, ember = credits/treasury, blood = alerts/breaker. */
export type Tone = "agent" | "soul" | "cortex" | "ember" | "blood";

const TONES: Record<Tone, string> = {
  agent: "border-agent-400/30 bg-agent-400/10 text-agent-300",
  soul: "border-soul-400/30 bg-soul-400/10 text-soul-300",
  cortex: "border-cortex-400/30 bg-cortex-400/10 text-cortex-300",
  ember: "border-ember-400/30 bg-ember-400/10 text-ember-400",
  blood: "border-blood-400/30 bg-blood-400/10 text-blood-400",
};
const DOTS: Record<Tone, string> = { agent: "text-agent-400", soul: "text-soul-400", cortex: "text-cortex-400", ember: "text-ember-400", blood: "text-blood-400" };

export function StatusBadge({ tone, children, dot = false, pulse = false, className = "" }: { tone: Tone; children: React.ReactNode; dot?: boolean; pulse?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TONES[tone]} ${className}`}>
      {dot && <span aria-hidden className={`status-dot !h-1.5 !w-1.5 ${DOTS[tone]} ${pulse ? "pulse-ring" : ""}`} />}
      {children}
    </span>
  );
}
