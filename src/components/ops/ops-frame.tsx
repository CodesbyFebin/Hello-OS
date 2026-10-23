import { OperatorTokenForm } from "./operator-token-form";
import Link from "next/link";
import type { ReactNode } from "react";

export const opsCard = "rounded-xl border border-white/[.07] bg-[#0f1019]/80 p-4";
export const opsBtn = "rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40";

export function Badge({ kind, children }: { kind: "real" | "sim" | "vision" | "warn"; children: ReactNode }) {
  const c = { real: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", sim: "border-amber-400/30 bg-amber-400/10 text-amber-300", vision: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400", warn: "border-red-400/30 bg-red-400/10 text-red-300" }[kind];
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${c}`}>{children}</span>;
}

export function OpsFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-void text-zinc-300">
      <header className="border-b border-white/[.07] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3 font-mono text-xs">
          <Link href="/" className="text-zinc-400 hover:text-white">mission control</Link><span className="text-zinc-600">/</span>
          <Link href="/ops" className="text-zinc-400 hover:text-white">ops</Link><span className="text-zinc-600">/</span>
          <span className="text-white">{title}</span>
          <div className="ml-auto w-80"><OperatorTokenForm compact /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-zinc-400">{subtitle}</p>}
        <div className="mt-6 space-y-4">{children}</div>
      </main>
    </div>
  );
}
