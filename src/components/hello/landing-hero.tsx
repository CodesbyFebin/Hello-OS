"use client";

import * as React from "react";
import Link from "next/link";
import { Boxes, Brain, Code2, Database, Dna, Network, Plug, ShieldCheck, type LucideIcon } from "lucide-react";

interface Pod { href: string; label: string; detail: string; Icon: LucideIcon; tint: string }

// Module shortcuts. Labels describe pages; no stats are shown.
const PODS: Pod[] = [
  { href: "/cloud", label: "Cortex memory", detail: "HELLO Cloud", Icon: Database, tint: "#22d3ee" },
  { href: "/aml-studio", label: "AML", detail: "AML Studio", Icon: Code2, tint: "#00ff9d" },
  { href: "/roadmap", label: "Roadmap", detail: "Steps & approvals", Icon: ShieldCheck, tint: "#9775fa" },
  { href: "/frontier", label: "Frontier", detail: "Agent research lab", Icon: Brain, tint: "#b49cff" },
  { href: "/runtime", label: "Runtime", detail: "10 runtime pillars", Icon: Boxes, tint: "#67e8f9" },
  { href: "/hub", label: "Hub", detail: "GitAgentHUB", Icon: Network, tint: "#00ff9d" },
  { href: "/evolve", label: "Evolve", detail: "Evolve Lab", Icon: Dna, tint: "#9775fa" },
  { href: "/integrations", label: "Integrations", detail: "Connector registry", Icon: Plug, tint: "#22d3ee" },
];

function useCanvasScene(ref: React.RefObject<HTMLCanvasElement | null>) {
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0, h = 0, raf = 0, visible = true, t = 0, last = 0;
    let stars: { x: number; y: number; r: number; p: number }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      stars = Array.from({ length: Math.round((w * h) / 2600) }, () => ({ x: rnd() * w, y: rnd() * h, r: rnd() * 1.2 + 0.2, p: rnd() * 6.28 }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(s.p + t * 0.8));
        ctx.fillStyle = "#e5e7eb";
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
      // DNA double helix sweeping from bottom-centre to top-left-centre.
      const n = 90, x0 = w * 0.36, y0 = h * 1.05, x1 = w * 0.56, y1 = -h * 0.05, amp = Math.min(w, h) * 0.06;
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      for (let i = 0; i <= n; i++) {
        const k = i / n, phase = k * Math.PI * 7 + t * 1.2;
        const cx = x0 + dx * k + Math.sin(k * Math.PI) * w * 0.05, cy = y0 + dy * k;
        const a = Math.sin(phase) * amp, b = -a;
        const depth = (Math.cos(phase) + 1) / 2;
        const col = `rgb(${Math.round(0 + 151 * k)},${Math.round(255 - 138 * k)},${Math.round(157 + 93 * k)})`;
        if (i % 3 === 0) {
          ctx.strokeStyle = col; ctx.globalAlpha = 0.18;
          ctx.beginPath(); ctx.moveTo(cx + nx * a, cy + ny * a); ctx.lineTo(cx + nx * b, cy + ny * b); ctx.stroke();
        }
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.35 + 0.6 * depth; ctx.beginPath(); ctx.arc(cx + nx * a, cy + ny * a, 1.4 + 2.2 * depth, 0, 6.28); ctx.fill();
        ctx.globalAlpha = 0.35 + 0.6 * (1 - depth); ctx.beginPath(); ctx.arc(cx + nx * b, cy + ny * b, 1.4 + 2.2 * (1 - depth), 0, 6.28); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || reduce.matches) return;
      t += Math.min(0.05, (now - (last || now)) / 1000); last = now;
      draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && visible && !reduce.matches) { last = 0; raf = requestAnimationFrame(loop); } else if (reduce.matches) draw(); };

    resize(); draw(); start();
    const ro = new ResizeObserver(() => { resize(); draw(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); });
    io.observe(canvas);
    const onVis = () => { visible = document.visibilityState === "visible"; start(); };
    document.addEventListener("visibilitychange", onVis);
    reduce.addEventListener("change", start);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); reduce.removeEventListener("change", start); };
  }, [ref]);
}

function PodLink({ pod, className = "", style }: { pod: Pod; className?: string; style?: React.CSSProperties }) {
  const { Icon } = pod;
  return (
    <Link href={pod.href} aria-label={`${pod.label}: open ${pod.detail}`} style={{ ...style, ["--tint" as string]: pod.tint }}
      className={`group flex flex-col items-center gap-1.5 rounded-2xl border border-white/15 bg-white/[.06] px-3 py-3 text-center shadow-[0_0_24px_-6px_var(--tint)] backdrop-blur-md transition hover:border-[color:var(--tint)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--tint)] ${className}`}>
      <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/40" style={{ color: pod.tint, boxShadow: `inset 0 0 14px ${pod.tint}55` }}><Icon size={20} aria-hidden /></span>
      <span className="font-mono text-[11px] font-semibold text-white">{pod.label}</span>
      <span className="font-mono text-[9px] text-zinc-400">{pod.detail}</span>
    </Link>
  );
}

export function LandingHero() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  useCanvasScene(canvasRef);

  return (
    <section aria-labelledby="hero-title" className="hello-hero relative isolate overflow-hidden bg-[#05060a] text-white">
      {/* planet horizon glow, bottom-left */}
      <div aria-hidden className="pointer-events-none absolute -bottom-[170%] -left-[25%] z-0 aspect-square w-[90%] rounded-full bg-[radial-gradient(circle_at_50%_50%,#0b1220_58%,#1e3a8a55_63%,#22d3ee33_66%,transparent_70%)] shadow-[0_-10px_80px_10px_#3b82f633]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[28%] left-[30%] z-0 h-10 w-48 rounded-full bg-[radial-gradient(ellipse,#fde68a99,transparent_70%)] blur-md" />
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 z-0 h-full w-full" />

      <div className="relative z-10 mx-auto grid max-w-[1400px] items-center gap-8 px-6 py-12 lg:min-h-[640px] lg:grid-cols-[1fr_1.2fr] lg:py-6">
        <div className="relative z-10">
          <h1 id="hero-title" className="font-mono text-5xl font-extrabold tracking-[.12em] sm:text-6xl lg:text-7xl">
            HELLO <span className="text-[#00ff9d] drop-shadow-[0_0_18px_#00ff9d88]">OS</span>
          </h1>
          <p className="mt-3 font-mono text-xs tracking-[.3em] text-zinc-300 sm:text-sm">THE COMPLETE AGENT-LLM ECOSYSTEM</p>
          <p className="mt-4 max-w-md text-sm text-zinc-400">An open, local-first prototype for agent identity, memory, MCP tools and safety gates. Pick a module to explore.</p>
        </div>

        {/* Desktop: core + orbiting pods */}
        <div className="relative hidden aspect-square w-full max-w-[540px] justify-self-center lg:block">
          <div aria-hidden className="absolute inset-0 grid place-items-center">
            {[100, 80, 62].map((s, i) => (
              <div key={s} className={`hero-ring absolute rounded-full border ${i === 1 ? "border-dashed border-violet-400/30" : "border-[#00ff9d]/25"}`} style={{ width: `${s}%`, height: `${s}%`, animationDuration: `${60 + i * 25}s`, animationDirection: i % 2 ? "reverse" : "normal" }} />
            ))}
            <div className="hero-core h-[26%] w-[26%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#a7f3d0,#10b981_25%,#0e7490_55%,#0b1220_80%)] shadow-[0_0_60px_10px_#00ff9d55,0_0_140px_30px_#7c3aed33]" />
          </div>
          <ul className="hero-orbit absolute inset-0" aria-label="HELLO OS modules">
            {PODS.map((pod, i) => {
              const ang = (i / PODS.length) * 360;
              return (
                <li key={pod.href} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${ang}deg) translateY(-205px) rotate(${-ang}deg)` }}>
                  <div className="hero-counter -translate-x-1/2 -translate-y-1/2"><PodLink pod={pod} className="w-[118px]" /></div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Mobile/tablet: pods as a grid */}
        <ul className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden" aria-label="HELLO OS modules">
          {PODS.map((pod) => <li key={pod.href}><PodLink pod={pod} className="h-full" /></li>)}
        </ul>
      </div>
    </section>
  );
}
