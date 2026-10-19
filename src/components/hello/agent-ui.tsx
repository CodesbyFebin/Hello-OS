"use client";

import { avatarGradient, reputationTier } from "@/lib/hello";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-society",
  Sleeping: "bg-cognition",
  Exploring: "bg-economy",
  Degraded: "bg-destructive",
  Retired: "bg-muted-foreground",
};

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const color = STATUS_COLORS[status] || "bg-muted-foreground";
  const pulse = status === "Active" || status === "Exploring";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("relative inline-block h-2 w-2 rounded-full", color, pulse && "pulse-dot")} />
    </span>
  );
}

export function AgentAvatar({
  name,
  size = "md",
  className,
  ring,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-xl",
  };
  const initials = name
    .split(/[\s-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold text-white shadow-inner select-none",
        sizes[size],
        ring && "ring-2 ring-background",
        className
      )}
      style={{ background: avatarGradient(name) }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

export function ReputationBadge({ rep, className }: { rep: number; className?: string }) {
  const tier = reputationTier(rep);
  const colorMap: Record<string, string> = {
    soul: "text-soul border-soul/40 bg-soul/10",
    cognition: "text-cognition border-cognition/40 bg-cognition/10",
    economy: "text-economy border-economy/40 bg-economy/10",
    society: "text-society border-society/40 bg-society/10",
    evolution: "text-evolution border-evolution/40 bg-evolution/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        colorMap[tier.color],
        className
      )}
    >
      <span className="font-mono tabular-nums">{rep.toFixed(0)}</span>
      {tier.label}
    </span>
  );
}

export function DidTag({ did, className, onResolve }: { did: string; className?: string; onResolve?: (did: string) => void }) {
  const isDidKey = did.startsWith("did:key:");
  const prefix = isDidKey ? "did:key:" : "did:hello:";
  const rest = did.replace(prefix, "");
  // Render as a span (not button) so it can nest inside button elements safely.
  return (
    <span
      role={onResolve ? "button" : undefined}
      tabIndex={onResolve ? 0 : undefined}
      onClick={onResolve ? (e: React.MouseEvent) => { e.stopPropagation(); onResolve(did); } : undefined}
      onKeyDown={onResolve ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onResolve(did); } } : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
        onResolve && "hover:bg-muted/70 cursor-pointer",
        className
      )}
      title={did}
    >
      {isDidKey && <ShieldCheck className="h-2.5 w-2.5 text-society" />}
      <span className="text-soul">{prefix}</span>
      <span className="text-foreground/70">{rest.slice(0, 12)}…</span>
      {isDidKey && <span className="text-society">✓</span>}
    </span>
  );
}
