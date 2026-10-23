// HELLO OS session portability terminal theme. Colors are foreground-on-dark
// and the real TUI renders on the user's terminal background with no border.

import { RGBA } from "@opentui/core"
import type { HarnessId } from "../../ir"

export const palette = {
  lavender: RGBA.fromHex("#a587f5"),
  lavenderMuted: RGBA.fromHex("#7f6bc7"),
  // Brand mint: our one accent green. It drives the logo mark, the header
  // `open` marker, the footer keyboard-shortcut glyphs, and every harness
  // bullet. We deliberately render NO third-party brand colors (no Claude
  // orange, Hermes blue, or OpenClaw red) — everything brand-adjacent is mint.
  coral: RGBA.fromHex("#5ce1b1"),
  text: RGBA.fromHex("#e3def2"),
  white: RGBA.fromHex("#ffffff"),
  dim: RGBA.fromHex("#7d7696"),
  dimmest: RGBA.fromHex("#4d4566"),
  connector: RGBA.fromHex("#443a66"),
  cursorBg: RGBA.fromHex("#2e2452"),
  cursorCount: RGBA.fromHex("#b4abd4"),
  pillBg: RGBA.fromHex("#2a2148"),
  gold: RGBA.fromHex("#ffd76b"),
} as const

export const TRANSPARENT = RGBA.fromInts(0, 0, 0, 0)

export interface HarnessMeta {
  label: string
  brandHex: string
  installPath: string
}

/** The harnesses this build can actually port between. */
export const HARNESS_ORDER: HarnessId[] = ["claude-code", "codex", "opencode"]

export const HARNESS_META: Record<HarnessId, HarnessMeta> = {
  "claude-code": { label: "Claude Code", brandHex: "#D97757", installPath: "~/.claude" },
  codex: { label: "Codex", brandHex: "#080808", installPath: "~/.codex" },
  opencode: { label: "OpenCode", brandHex: "#000000", installPath: "~/.config/opencode" },
}

/** We render no third-party brand colors, so `hex` is accepted for call-site
 *  compatibility but ignored — every brand foreground is our mint green. */
export function brandFg(_hex: string): RGBA {
  return palette.coral
}

/** Every harness bullet is a solid mint dot — no per-brand color or hollow
 *  fallback (`hex` is ignored, kept only for call-site compatibility). */
export function brandDot(_hex: string): { char: string; color: RGBA } {
  return { char: "●", color: palette.coral }
}
