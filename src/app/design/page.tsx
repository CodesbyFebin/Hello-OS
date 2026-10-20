import type { Metadata } from "next";
import { HubShell, card, kicker } from "@/components/hub/hub-shell";
import { TerminalBlock } from "@/components/design/terminal-block";
import { StatusBadge, type Tone } from "@/components/design/status-badge";
import { CONTRAST } from "@/lib/design/contrast";

export const metadata: Metadata = {
  title: "Design system (style reference) | HELLO OS",
  description: "HELLO OS design tokens, typography, cards, badges, terminal block and motion. A style reference for contributors, not a product feature.",
  alternates: { canonical: "/design" },
};

const SWATCHES: { group: string; items: [string, string][] }[] = [
  { group: "Surfaces", items: [["void", "#05060a"], ["abyss", "#090b12"], ["panel", "#0e111b"], ["edge", "#1a2030"]] },
  { group: "Agent (online / success)", items: [["agent-300", "#33ffbb"], ["agent-400", "#00ff9d"], ["agent-500", "#00d985"]] },
  { group: "Soul (identity / memory)", items: [["soul-300", "#b49cff"], ["soul-400", "#9775fa"], ["soul-500", "#7c3aed"]] },
  { group: "Cortex (infrastructure)", items: [["cortex-300", "#67e8f9"], ["cortex-400", "#22d3ee"], ["cortex-500", "#06b6d4"]] },
  { group: "Ember (credits / treasury)", items: [["ember-400", "#fbbf24"], ["ember-500", "#f59e0b"]] },
  { group: "Blood (alerts / breaker)", items: [["blood-400", "#f87171"], ["blood-500", "#ef4444"]] },
];

const TONES: [Tone, string, string][] = [["agent", "online", "Agent online, check passed"], ["soul", "identity", "DID, soul, memory"], ["cortex", "infra", "MCP, sandbox, scheduler"], ["ember", "credits", "Wallets and treasury (H)"], ["blood", "breaker", "Alerts, circuit open"]];

const SAMPLE = `$ curl -s -X POST localhost:3000/api/aml/compile \\
    -H 'content-type: application/json' \\
    -d '{"source":"mission demo { emit: receipt }"}'
{"ok":true,"lexicalTokenCount":7,"sourceSha256":"…"}`;

export default function DesignPage() {
  return (
    <HubShell active="hub">
      <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-8">
        <header className="space-y-2">
          <div className={kicker}>HELLO OS // DESIGN SYSTEM</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Design system</h1>
          <p className="max-w-3xl text-sm text-zinc-400">This page is a <b className="text-zinc-200">style reference</b> for contributors: tokens, type, components and motion. Its sample content is illustrative and shows no live data.</p>
          <StatusBadge tone="cortex">style reference</StatusBadge>
        </header>

        <section aria-labelledby="sw" className="space-y-3">
          <h2 id="sw" className="text-lg font-semibold text-white">Color tokens</h2>
          <p className="text-xs text-zinc-400">CSS variables <code className="font-mono">--hello-*</code> in <code className="font-mono">globals.css</code>, exposed to Tailwind v4 as <code className="font-mono">bg-void</code>, <code className="font-mono">text-agent-400</code>, <code className="font-mono">border-edge</code> and so on.</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SWATCHES.map((g) => (
              <div key={g.group} className={`${card} p-3`}>
                <div className="mb-2 text-xs font-medium text-zinc-300">{g.group}</div>
                <div className="flex gap-2">
                  {g.items.map(([n, hex]) => (
                    <div key={n} className="flex-1">
                      <div className="h-12 rounded-md border border-white/10" style={{ background: hex }} />
                      <div className="mt-1 font-mono text-[10px] text-zinc-300">{n}</div>
                      <div className="font-mono text-[10px] text-zinc-400">{hex}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="ty" className={`${card} space-y-3 p-5`}>
          <h2 id="ty" className="text-lg font-semibold text-white">Typography</h2>
          <p className="font-sans text-3xl font-semibold tracking-tight text-white">Inter: agents need identity</p>
          <p className="font-sans text-sm text-zinc-300">Inter Variable for UI and prose (<code className="font-mono">font-sans</code>).</p>
          <p className="font-mono text-sm text-agent-300">JetBrains Mono: did:key:z6Mk… · 42 H · tr_root.step</p>
          <p className="text-xs text-zinc-400">Both are self-hosted from pinned <code className="font-mono">@fontsource-variable</code> packages; no font CDN is used.</p>
        </section>

        <section aria-labelledby="cards" className="space-y-3">
          <h2 id="cards" className="text-lg font-semibold text-white">Surfaces</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card p-5"><div className={kicker}>.GLASS-CARD</div><p className="mt-2 text-sm text-zinc-300">145° gradient from panel to abyss, edge border and backdrop blur. <code className="font-mono">card</code> in hub-shell now maps to it.</p></div>
            <div className="matrix-grid rounded-xl border border-edge p-5"><div className={kicker}>.MATRIX-GRID / .BG-AGENT-GRID</div><p className="mt-2 text-sm text-zinc-300">A faint 32px agent-green grid on void.</p></div>
          </div>
        </section>

        <section aria-labelledby="badges" className={`${card} space-y-3 p-5`}>
          <h2 id="badges" className="text-lg font-semibold text-white">Status badges</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TONES.map(([t, label, use]) => <li key={t} className="flex items-center gap-3"><StatusBadge tone={t} dot>{label}</StatusBadge><span className="text-xs text-zinc-400">{use}</span></li>)}
          </ul>
        </section>

        <section aria-labelledby="motion" className={`${card} space-y-3 p-5`}>
          <h2 id="motion" className="text-lg font-semibold text-white">Motion</h2>
          <div className="flex flex-wrap items-center gap-8 text-sm text-zinc-300">
            <span className="flex items-center gap-2"><span className="status-dot pulse-ring text-agent-400" aria-hidden />pulse-ring</span>
            <span className="flex items-center gap-2"><span className="status-dot pulse-glow text-cortex-400" aria-hidden />pulse-glow</span>
            <span className="flex items-center gap-2"><span className="status-dot text-blood-400" aria-hidden />static status-dot</span>
          </div>
          <p className="text-xs text-zinc-400">Both animations stop under <code className="font-mono">prefers-reduced-motion: reduce</code>; the ring then shows as a static outline.</p>
        </section>

        <section aria-labelledby="term" className="space-y-3">
          <h2 id="term" className="text-lg font-semibold text-white">Terminal block</h2>
          <TerminalBlock title="example: compile AML (illustrative output)" code={SAMPLE} />
        </section>

        <section aria-labelledby="ct" className={`${card} overflow-x-auto p-5`}>
          <h2 id="ct" className="mb-3 text-lg font-semibold text-white">Contrast (WCAG 2.x)</h2>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="font-mono text-[10px] text-zinc-400"><tr><th className="py-1">TEXT</th><th>ON</th><th>RATIO</th><th>AA NORMAL (4.5)</th><th>AA LARGE (3)</th></tr></thead>
            <tbody>
              {CONTRAST.map((c) => (
                <tr key={c.fg + c.bg} className="border-t border-edge">
                  <td className="py-1.5"><span className="rounded px-1.5 font-mono text-xs" style={{ color: c.fgHex, background: c.bgHex }}>{c.fg}</span></td>
                  <td className="font-mono text-xs text-zinc-400">{c.bg}</td>
                  <td className="font-mono text-xs text-zinc-200">{c.ratio.toFixed(2)}:1</td>
                  <td>{c.ratio >= 4.5 ? <StatusBadge tone="agent">pass</StatusBadge> : <StatusBadge tone="blood">fail</StatusBadge>}</td>
                  <td>{c.ratio >= 3 ? <StatusBadge tone="agent">pass</StatusBadge> : <StatusBadge tone="blood">fail</StatusBadge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-400">Computed with the WCAG relative-luminance formula in <code className="font-mono">src/lib/design/contrast.ts</code> and checked by <code className="font-mono">tests/design.test.mjs</code>.</p>
        </section>
      </main>
    </HubShell>
  );
}
