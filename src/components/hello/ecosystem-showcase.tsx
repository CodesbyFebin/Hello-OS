"use client";

import * as React from "react";
import Link from "next/link";
import { Brain, Code2, Coins, Database, Dna, Plug, type LucideIcon } from "lucide-react";
import { CONNECTORS } from "@/lib/integrations/registry";
import { STEPS } from "@/lib/roadmap/steps";

interface Node { href: string; label: string; Icon: LucideIcon; color: string }

const NODES: Node[] = [
  { href: "/hub", label: "Agent Guilds", Icon: Brain, color: "#00ff9d" },
  { href: "/evolve", label: "Evolve", Icon: Dna, color: "#9775fa" },
  { href: "/integrations", label: "Models & Integrations", Icon: Plug, color: "#22d3ee" },
  { href: "/cloud", label: "Memory Cortex", Icon: Database, color: "#67e8f9" },
  { href: "/ops/treasury", label: "Credits Ledger", Icon: Coins, color: "#fbbf24" },
  { href: "/aml-studio", label: "AML", Icon: Code2, color: "#b49cff" },
];

// Node positions on an ellipse around the orb, as fractions of the stage.
function nodeFrac(i: number, t: number) {
  const a = (i / NODES.length) * Math.PI * 2 - Math.PI / 2 + t * 0.05;
  return { fx: 0.5 + Math.cos(a) * 0.36, fy: 0.5 + Math.sin(a) * 0.36 };
}
function nodePos(i: number, t: number, w: number, h: number) {
  const { fx, fy } = nodeFrac(i, t);
  return { x: fx * w, y: fy * h };
}

function useShowcaseCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, nodeRefs: React.RefObject<(HTMLAnchorElement | null)[]>) {
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0, h = 0, raf = 0, visible = true, t = 0, last = 0;
    let stars: { x: number; y: number; z: number }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      stars = Array.from({ length: Math.round((w * h) / 3000) }, () => ({ x: rnd() * w, y: rnd() * h, z: rnd() }));
    };

    const draw = () => {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      // subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
      for (let x = (w / 2) % 40; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = (h / 2) % 40; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // depth star field (drifts outward from centre)
      for (const s of stars) {
        const k = ((s.z + t * 0.03) % 1);
        const x = w / 2 + (s.x - w / 2) * (0.4 + k), y = h / 2 + (s.y - h / 2) * (0.4 + k);
        if (x < 0 || y < 0 || x > w || y > h) continue;
        ctx.globalAlpha = 0.15 + 0.6 * k; ctx.fillStyle = "#e5e7eb"; ctx.fillRect(x, y, 0.6 + k * 1.4, 0.6 + k * 1.4);
      }
      ctx.globalAlpha = 1;
      const cx = w / 2, cy = h / 2, R = Math.min(w, h);
      // orbital ellipses
      [0.36, 0.27, 0.45].forEach((r, i) => {
        ctx.strokeStyle = i === 0 ? "rgba(0,255,157,0.18)" : "rgba(151,117,250,0.12)";
        ctx.setLineDash(i === 1 ? [4, 6] : []);
        ctx.beginPath(); ctx.ellipse(cx, cy, w * r, h * r, i * 0.25, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.setLineDash([]);
      // connection lines + energy streams to each node
      NODES.forEach((n, i) => {
        const p = nodePos(i, t, w, h);
        const g = ctx.createLinearGradient(cx, cy, p.x, p.y);
        g.addColorStop(0, "rgba(0,255,157,0.35)"); g.addColorStop(1, n.color + "55");
        ctx.strokeStyle = g; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke();
        for (let j = 0; j < 3; j++) {
          const f = (t * 0.25 + j / 3 + i * 0.13) % 1;
          ctx.globalAlpha = Math.sin(f * Math.PI); ctx.fillStyle = n.color;
          ctx.beginPath(); ctx.arc(cx + (p.x - cx) * f, cy + (p.y - cy) * f, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        const el = nodeRefs.current?.[i];
        if (el) { el.style.left = `${(p.x / w) * 100}%`; el.style.top = `${(p.y / h) * 100}%`; }
      });
      // pulsing orb
      const pulse = 1 + Math.sin(t * 2) * 0.04, r = R * 0.12 * pulse;
      const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.6);
      halo.addColorStop(0, "rgba(0,255,157,0.35)"); halo.addColorStop(0.5, "rgba(124,58,237,0.12)"); halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2); ctx.fill();
      const core = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      core.addColorStop(0, "#a7f3d0"); core.addColorStop(0.35, "#10b981"); core.addColorStop(0.75, "#0e7490"); core.addColorStop(1, "#0b1220");
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || reduce.matches) return;
      t += Math.min(0.05, (now - (last || now)) / 1000); last = now;
      draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (reduce.matches) { draw(); return; } if (!raf && visible) { last = 0; raf = requestAnimationFrame(loop); } };

    resize(); draw(); start();
    const ro = new ResizeObserver(() => { resize(); draw(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && document.visibilityState === "visible"; start(); });
    io.observe(canvas);
    const onVis = () => { visible = document.visibilityState === "visible"; start(); };
    document.addEventListener("visibilitychange", onVis);
    reduce.addEventListener("change", start);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); reduce.removeEventListener("change", start); };
  }, [canvasRef, nodeRefs]);
}

type Stat = { label: string; value: string; source: string };

function useStats(): Stat[] {
  const working = CONNECTORS.filter((c) => c.status === "WORKING").length;
  const shipped = STEPS.filter((s) => s.status === "shipped").length;
  const [api, setApi] = React.useState<{ agents?: number; skills?: number; guilds?: number; runs?: string }>({});
  React.useEffect(() => {
    let alive = true;
    fetch("/api/stats").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (alive && d?.counts) setApi((a) => ({ ...a, agents: d.counts.agents, skills: d.counts.skills, guilds: d.counts.guilds }));
    }).catch(() => {});
    fetch("/api/evolution/runs").then((r) => (r.ok ? r.json() : null)).then((d) => {
      // The endpoint returns at most 30 runs.
      if (alive && Array.isArray(d?.runs)) setApi((a) => ({ ...a, runs: d.runs.length >= 30 ? "30+" : String(d.runs.length) }));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const n = (v?: number) => (typeof v === "number" ? v.toLocaleString() : "—");
  return [
    { label: "Agents", value: n(api.agents), source: "/api/stats · this instance" },
    { label: "Guilds", value: n(api.guilds), source: "/api/stats · this instance" },
    { label: "Skills", value: n(api.skills), source: "/api/stats · this instance" },
    { label: "Evolution runs", value: api.runs ?? "—", source: "/api/evolution/runs · this instance" },
    { label: "Connectors working", value: `${working}/${CONNECTORS.length}`, source: "integrations registry" },
    { label: "Roadmap steps shipped", value: `${shipped}/${STEPS.length}`, source: "roadmap data on main" },
  ];
}

export function EcosystemShowcase() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const nodeRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
  useShowcaseCanvas(canvasRef, nodeRefs);
  const stats = useStats();

  return (
    <section aria-labelledby="showcase-title" className="relative overflow-hidden border-t border-white/[.06] bg-[#05060a] px-4 py-12 text-white">
      <div className="mx-auto max-w-[1200px] text-center">
        <h2 id="showcase-title" className="font-mono text-2xl font-bold tracking-[.1em] sm:text-3xl">One substrate, <span className="text-[#00ff9d]">six modules</span></h2>
        <p className="mt-2 font-mono text-xs tracking-[.3em] text-zinc-400">FOR AGENTS · BY AGENTS</p>
        <p className="mx-auto mt-2 max-w-xl text-xs text-zinc-500">Operators stay in control: high-impact actions go through approval gates.</p>
      </div>

      <div className="relative mx-auto mt-6 h-[420px] max-w-[1000px] sm:h-[520px]">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm font-extrabold tracking-[.15em] sm:text-lg">
          HELLO <span className="text-[#00ff9d]">OS</span>
        </div>
        <ul aria-label="Ecosystem modules" className="absolute inset-0">
          {NODES.map((node, i) => {
            const { Icon } = node;
            return (
              <li key={node.href}>
                <Link ref={(el) => { nodeRefs.current[i] = el; }} href={node.href} aria-label={`${node.label}: open ${node.href}`}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-white/15 bg-black/50 px-2.5 py-2 backdrop-blur-md transition hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ff9d]"
                  style={{ boxShadow: `0 0 20px -6px ${node.color}`, left: `${nodeFrac(i, 0).fx * 100}%`, top: `${nodeFrac(i, 0).fy * 100}%` }}>
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20" style={{ color: node.color }}><Icon size={18} aria-hidden /></span>
                  <span className="whitespace-nowrap font-mono text-[10px] font-semibold text-zinc-100">{node.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="mx-auto mt-6 grid max-w-[1200px] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[.07] bg-white/[.03] p-3 text-center" title={`Source: ${s.source}`}>
            <dt className="font-mono text-[10px] tracking-wider text-zinc-500">{s.label.toUpperCase()}</dt>
            <dd className="mt-1 font-mono text-lg font-bold text-white">{s.value}</dd>
            <dd className="font-mono text-[9px] text-zinc-600">{s.source}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
