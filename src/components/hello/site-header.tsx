"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Github, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "universe", label: "hello://" },
  { id: "forge", label: "forge" },
  { id: "cortex", label: "cortex" },
  { id: "cloud", label: "cloud" },
  { id: "console", label: "console" },
  { id: "honesty", label: "Honesty" },
  { id: "identity", label: "Identity" },
  { id: "society", label: "Society" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState("universe");

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // section spy
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const go = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled ? "border-b border-border/60 bg-background/80 backdrop-blur-xl" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="#universe" className="group flex items-center gap-2.5" onClick={(e) => { e.preventDefault(); go("universe"); }}>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-soul via-cognition to-evolution shadow-lg">
            <Sparkles className="h-4 w-4 text-white" />
            <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">Hello</span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Agentic Universe</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className={cn(
                "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
              {active === s.id && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-soul to-cognition"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="Source">
              <Github className="h-4 w-4" />
            </a>
          </Button>
          <Button
            size="sm"
            onClick={() => go("identity")}
            className="hidden bg-gradient-to-r from-soul to-cognition text-white hover:opacity-90 sm:inline-flex"
          >
            Summon an Agent
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden"
        >
          <nav className="mx-auto grid max-w-7xl grid-cols-2 gap-1 px-4 py-3 sm:px-6">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                  active === s.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </motion.div>
      )}
    </header>
  );
}
