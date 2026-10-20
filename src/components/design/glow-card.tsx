import * as React from "react";

/** Card with the design-system glow. variant "card" = .feature-card with the
 * hover sweep line; "border" = p-[1px] animated gradient border around a panel. */
export function GlowCard({ children, variant = "card", className = "", innerClassName = "", as: Tag = "div" }: {
  children: React.ReactNode; variant?: "card" | "border"; className?: string; innerClassName?: string; as?: "div" | "article" | "section" | "li";
}) {
  if (variant === "border") {
    return (
      <Tag className={`animate-rgb-bg rounded-xl p-[1px] ${className}`}>
        <div className={`h-full rounded-[11px] bg-panel ${innerClassName}`}>{children}</div>
      </Tag>
    );
  }
  return <Tag className={`feature-card ${className}`}>{children}</Tag>;
}
