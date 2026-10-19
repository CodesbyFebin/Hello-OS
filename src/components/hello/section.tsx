"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  soul: { text: "text-soul", bg: "bg-soul/10", border: "border-soul/30", dot: "bg-soul" },
  cognition: { text: "text-cognition", bg: "bg-cognition/10", border: "border-cognition/30", dot: "bg-cognition" },
  economy: { text: "text-economy", bg: "bg-economy/10", border: "border-economy/30", dot: "bg-economy" },
  society: { text: "text-society", bg: "bg-society/10", border: "border-society/30", dot: "bg-society" },
  evolution: { text: "text-evolution", bg: "bg-evolution/10", border: "border-evolution/30", dot: "bg-evolution" },
  default: { text: "text-foreground", bg: "bg-muted", border: "border-border", dot: "bg-foreground" },
};

export function SectionHeader({
  eyebrow,
  eyebrowColor = "soul",
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow: string;
  eyebrowColor?: keyof typeof COLOR_MAP | string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
}) {
  const c = COLOR_MAP[eyebrowColor as string] ?? COLOR_MAP.default;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
    >
      <div className="max-w-2xl">
        <div className={cn("mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider", c.bg, c.border, c.text)}>
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {eyebrow}
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">{title}</h2>
        {description && <p className="mt-3 text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function SectionShell({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-16 sm:py-24", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">{children}</div>
    </section>
  );
}
