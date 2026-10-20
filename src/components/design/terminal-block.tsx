import * as React from "react";

type Props = {
  /** Plain text. Rendered as text nodes only; never parsed as HTML. */
  code: string;
  title?: string;
  lineNumbers?: boolean;
  className?: string;
  /** Optional max height for the code area (scrolls beyond it). */
  maxHeight?: number;
  "aria-label"?: string;
};

/** Terminal-style code block: void background, traffic lights, optional title and line numbers. */
export function TerminalBlock({ code, title, lineNumbers = true, className = "", maxHeight, ...rest }: Props) {
  const lines = code.replace(/\n$/, "").split("\n");
  const width = String(lines.length).length;
  return (
    <figure className={`min-w-0 max-w-full overflow-hidden rounded-xl border border-edge bg-void ${className}`} aria-label={rest["aria-label"] ?? title ?? "Code"}>
      <figcaption className="flex items-center gap-2 border-b border-edge bg-abyss px-3 py-2">
        <span aria-hidden className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blood-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-ember-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-agent-500" />
        </span>
        {title && <span className="ml-1 truncate font-mono text-[11px] text-zinc-400">{title}</span>}
      </figcaption>
      <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed text-zinc-200" style={maxHeight ? { maxHeight } : undefined}><code>
        {lines.map((l, i) => (
          <span key={i} className="block">
            {lineNumbers && <span aria-hidden className="mr-4 inline-block select-none text-right text-zinc-400" style={{ width: `${width}ch` }}>{i + 1}</span>}
            {l || " "}
          </span>
        ))}
      </code></pre>
    </figure>
  );
}
