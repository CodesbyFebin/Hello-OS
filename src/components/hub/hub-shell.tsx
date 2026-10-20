"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Cloud, Dna, Plug, FlaskConical, LayoutDashboard, Map as MapIcon, MessageSquare, Search, Telescope } from "lucide-react";

export const card = "glass-card";
export const kicker = "font-mono text-[10px] tracking-[.18em] text-zinc-400";

export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return <span title="Sample content: not stored in HELLO OS" className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-amber-300">{label.toUpperCase()}</span>;
}

export function RealBadge({ label = "Local DB" }: { label?: string }) {
  return <span title="Loaded from this HELLO OS instance" className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-emerald-300">{label.toUpperCase()}</span>;
}

export function SoonButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <button type="button" disabled title="Coming soon" aria-disabled className={`cursor-not-allowed rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-500 ${className}`}>{children}</button>;
}

export function HubShell({ active, search, onSearch, children }: { active: "hub" | "evolve" | "cloud" | "frontier" | "roadmap" | "integrations"; search?: string; onSearch?: (v: string) => void; children: React.ReactNode }) {
  const tab = (href: string, label: string, Icon: typeof Dna, on: boolean) => (
    <Link href={href} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs ${on ? "bg-agent-400/10 text-agent-400" : "text-zinc-400 hover:text-white"}`}><Icon size={14} />{label}</Link>
  );
  return (
    <div className="min-h-screen matrix-grid text-zinc-300">
      <header className="sticky top-0 z-30 border-b border-edge bg-void/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3">
          <Link href="/hub" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-agent-400 font-mono font-bold text-black">G</span>
            <span className="hidden sm:block"><b className="text-white">GitAgentHUB</b><small className="block font-mono text-[9px] tracking-widest text-zinc-500">GITHUB-STYLE HUB FOR AI AGENTS · PROTOTYPE</small></span>
          </Link>
          <nav className="flex items-center gap-1">
            {tab("/hub", "hub", LayoutDashboard, active === "hub")}
            {tab("/evolve", "evolve lab", FlaskConical, active === "evolve")}
            {tab("/evolution", "saved runs", Dna, false)}
            {tab("/cloud", "cloud", Cloud, active === "cloud")}
            {tab("/frontier", "frontier", Telescope, active === "frontier")}
            {tab("/roadmap", "roadmap", MapIcon, active === "roadmap")}
            {tab("/integrations", "integrations", Plug, active === "integrations")}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {onSearch && <label className="hidden items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 md:flex"><Search size={14} className="text-zinc-500" /><input aria-label="Search agents, repos and skills" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search agents, repos, skills" className="w-56 bg-transparent text-xs outline-none placeholder:text-zinc-600" /></label>}
            <button disabled title="Coming soon" aria-label="Notifications (coming soon)" className="rounded-md p-2 text-zinc-600"><Bell size={16} /></button>
            <button disabled title="Coming soon" aria-label="Messages (coming soon)" className="rounded-md p-2 text-zinc-600"><MessageSquare size={16} /></button>
            <Link href="/" className="rounded-md border border-white/10 px-2 py-1.5 font-mono text-[11px] text-zinc-400 hover:text-white">dashboard</Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
