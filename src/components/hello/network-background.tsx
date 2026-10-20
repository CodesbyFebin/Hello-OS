"use client";

import * as React from "react";

// Decorative network backdrop for the dashboard. Carries no data.
// rAF loop pauses when the tab is hidden; a single static frame under prefers-reduced-motion.
export function NetworkBackground() {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0, h = 0, raf = 0, t = 0, last = 0;
    let nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      nodes = Array.from({ length: Math.min(70, Math.round((w * h) / 26000)) }, () => ({ x: rnd() * w, y: rnd() * h, vx: (rnd() - 0.5) * 6, vy: (rnd() - 0.5) * 6 }));
    };
    const draw = () => {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const pts = nodes.map((n) => ({ x: (((n.x + n.vx * t) % w) + w) % w, y: (((n.y + n.vy * t) % h) + h) % h }));
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 150) { ctx.strokeStyle = `rgba(200,242,122,${0.08 * (1 - d / 150)})`; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
      }
      ctx.fillStyle = "rgba(200,242,122,0.35)";
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    };
    const loop = (now: number) => {
      raf = 0;
      if (document.visibilityState !== "visible" || reduce.matches) return;
      t += Math.min(0.05, (now - (last || now)) / 1000); last = now;
      draw(); raf = requestAnimationFrame(loop);
    };
    const start = () => { if (reduce.matches) { draw(); return; } if (!raf && document.visibilityState === "visible") { last = 0; raf = requestAnimationFrame(loop); } };
    resize(); draw(); start();
    const ro = new ResizeObserver(() => { resize(); draw(); }); ro.observe(canvas);
    document.addEventListener("visibilitychange", start); reduce.addEventListener("change", start);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", start); reduce.removeEventListener("change", start); };
  }, []);
  return <canvas ref={ref} aria-hidden className="network-bg" />;
}
