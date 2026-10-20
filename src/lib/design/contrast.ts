// WCAG 2.x contrast for the design tokens. Used by /design and tests.
export const TOKENS: Record<string, string> = {
  void: "#05060a", abyss: "#090b12", panel: "#0e111b", edge: "#1a2030",
  "agent-300": "#33ffbb", "agent-400": "#00ff9d", "agent-500": "#00d985",
  "soul-300": "#b49cff", "soul-400": "#9775fa", "soul-500": "#7c3aed",
  "cortex-300": "#67e8f9", "cortex-400": "#22d3ee", "cortex-500": "#06b6d4",
  "ember-400": "#fbbf24", "ember-500": "#f59e0b",
  "blood-400": "#f87171", "blood-500": "#ef4444",
  "zinc-200": "#e4e4e7", "zinc-300": "#d4d4d8", "zinc-400": "#a1a1aa", "zinc-500": "#71717a", "zinc-600": "#52525b",
};

const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
export function ratio(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const FG = ["zinc-200", "zinc-300", "zinc-400", "zinc-500", "zinc-600", "agent-300", "agent-400", "agent-500", "soul-300", "soul-400", "soul-500", "cortex-300", "cortex-400", "cortex-500", "ember-400", "ember-500", "blood-400", "blood-500"];
const BG = ["void", "panel"];
export const CONTRAST = BG.flatMap((bg) => FG.map((fg) => ({ fg, bg, fgHex: TOKENS[fg], bgHex: TOKENS[bg], ratio: ratio(TOKENS[fg], TOKENS[bg]) })));
