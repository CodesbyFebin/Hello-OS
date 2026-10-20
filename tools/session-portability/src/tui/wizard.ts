// Pure, render-free helpers for the 5-step hello-sessions wizard
// (Source → Destination → Select → Import → Done). Everything here is
// unit-testable without the @opentui renderer; the screens in ./screens/*
// are thin views over these.

import { homedir } from "node:os"
import type { PorterEventEmitter } from "../core/events"
import { summarizeOutcomes, type RunLogger } from "../core/log"
import type { ExportOutcome } from "../core/orchestrator"
import type { HarnessId, PortableSession } from "../ir"
import { VERSION } from "../meta"

// --- run logging -----------------------------------------------------------------

/** The orchestrator surface withRunLogging needs — structural so tests pass a fake. */
interface RunLoggableOrchestrator {
  events: PorterEventEmitter
  exportSessions(dest: HarnessId, sessions: PortableSession[], opts?: { force?: boolean }): Promise<ExportOutcome[]>
}

/**
 * The TUI's counterpart to the headless CLI's run logging (src/cli.ts): attaches
 * the logger to the event stream (persisting `error` events) and wraps
 * `exportSessions` so every Import dispatch also writes one run-summary line.
 * A Proxy rather than spread — spreading a class instance would drop its
 * prototype methods.
 */
export function withRunLogging<T extends RunLoggableOrchestrator>(
  orchestrator: T,
  logger: RunLogger,
  nowMs: () => number = Date.now,
): T {
  logger.attach(orchestrator.events)

  const exportSessions = async (
    dest: HarnessId,
    sessions: PortableSession[],
    opts?: { force?: boolean },
  ): Promise<ExportOutcome[]> => {
    const startedAt = nowMs()
    const outcomes = await orchestrator.exportSessions(dest, sessions, opts)
    const from = outcomes[0]?.sourceHarness ?? sessions[0]?.sourceHarness
    if (from) {
      logger.finishRun({
        from,
        to: dest,
        options: { all: false, ids: sessions.length, force: !!opts?.force },
        ...summarizeOutcomes(outcomes),
        durationMs: nowMs() - startedAt,
        cliVersion: VERSION,
      })
    }
    return outcomes
  }

  return new Proxy(orchestrator, {
    get(target, key, receiver) {
      if (key === "exportSessions") return exportSessions
      const value = Reflect.get(target, key, receiver)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

// --- step tracker -------------------------------------------------------------

export const STEP_TITLES = ["Source", "Destination", "Select", "Import", "Done"] as const
export type StepIndex = 1 | 2 | 3 | 4 | 5
export type StepState = "completed" | "current" | "upcoming"

export const STEP_SYMBOLS: Record<StepState, string> = { completed: "✔", current: "◼", upcoming: "◻" }

export function stepStates(current: StepIndex): StepState[] {
  return STEP_TITLES.map((_, i) => (i + 1 < current ? "completed" : i + 1 === current ? "current" : "upcoming"))
}

// --- paths & projects -----------------------------------------------------------

export function shortenHome(path: string, home: string = homedir()): string {
  return path === home || path.startsWith(home + "/") ? "~" + path.slice(home.length) : path
}

/** `/Users/dev/Desktop/Projects/raincheck` → name `raincheck`, parent `~/Desktop/Projects`. */
export function projectDisplay(cwd: string, home: string = homedir()): { name: string; parent: string } {
  const short = shortenHome(cwd, home)
  const slash = short.lastIndexOf("/")
  if (slash <= 0) return { name: short, parent: "" }
  return { name: short.slice(slash + 1), parent: short.slice(0, slash) }
}

/** Newest known activity for a session (epoch ms): `updatedAt`, else the last
 *  turn's timestamp, else `createdAt`, else 0 — used to order projects and the
 *  sessions within them most-recent-first. */
export function sessionActivity(session: PortableSession): number {
  if (session.updatedAt !== undefined) return session.updatedAt
  for (let i = session.turns.length - 1; i >= 0; i--) {
    const ts = session.turns[i]?.timestamp
    if (ts !== undefined) return ts
  }
  return session.createdAt ?? 0
}

/** Group sessions by project dir (`cwd`), ordered by most-recent conversation
 *  history: the project whose newest session is most recent comes first, and
 *  sessions within each project are newest-first. Ties keep insertion order
 *  (Array.sort is stable). */
export function groupSessionsByProject(sessions: PortableSession[]): Array<[string, PortableSession[]]> {
  const groups = new Map<string, PortableSession[]>()
  for (const session of sessions) {
    if (!groups.has(session.cwd)) groups.set(session.cwd, [])
    groups.get(session.cwd)!.push(session)
  }
  const entries = Array.from(groups.entries())
  for (const [, group] of entries) group.sort((a, b) => sessionActivity(b) - sessionActivity(a))
  entries.sort((a, b) => groupActivity(b[1]) - groupActivity(a[1]))
  return entries
}

function groupActivity(group: PortableSession[]): number {
  return group.reduce((max, session) => Math.max(max, sessionActivity(session)), 0)
}

export interface SourceCounts {
  projects: number
  messages: number
}

export function countSessions(sessions: PortableSession[]): SourceCounts {
  const projects = new Set(sessions.map((s) => s.cwd)).size
  const messages = sessions.reduce((sum, s) => sum + s.turns.length, 0)
  return { projects, messages }
}

// --- selection ------------------------------------------------------------------

export function toggleSessionSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** Every selectable session id, skipping any already imported (`exclude`). */
export function selectAllSessions(sessions: PortableSession[], exclude?: ReadonlySet<string>): Set<string> {
  return new Set(sessions.filter((s) => !exclude?.has(s.sourceSessionId)).map((s) => s.sourceSessionId))
}

/** fzf-style confirm resolution: with an explicit multi-selection, import that
 *  set (in list order); with nothing toggled, fall back to the single focused
 *  row so "arrow to a chat, press ↵" imports exactly that chat. Non-selectable
 *  (already-imported) focused rows resolve to nothing. */
export function resolveImportIds(
  ordered: PortableSession[],
  selected: ReadonlySet<string>,
  cursor: number,
  isSelectable: (session: PortableSession) => boolean,
): string[] {
  if (selected.size > 0) {
    return ordered.filter((s) => selected.has(s.sourceSessionId)).map((s) => s.sourceSessionId)
  }
  const focused = ordered[cursor]
  return focused && isSelectable(focused) ? [focused.sourceSessionId] : []
}

// --- list cursors ---------------------------------------------------------------

/** Move the cursor `direction` steps, wrapping, landing only on enabled rows
 *  (e.g. step 2 skips "nothing here yet" and the chosen destination). */
export function nextEnabledIndex(current: number, direction: number, enabled: boolean[]): number {
  const total = enabled.length
  if (total === 0 || !enabled.some(Boolean)) return current
  let index = current
  for (let i = 0; i < total; i++) {
    index = ((index + direction) % total + total) % total
    if (enabled[index]) return index
  }
  return current
}

export function firstEnabledIndex(enabled: boolean[]): number {
  const index = enabled.indexOf(true)
  return index === -1 ? 0 : index
}

// --- step 4: progress trail, spinner, microcopy -----------------------------------

export const TRAIL_CELLS = 24

export interface TrailParts {
  filled: string
  head: string
  rest: string
}

/** `━━━●┄┄┄┄` — filled lavender cells, brand-colored head, dim remainder;
 *  `cells` total including the head. */
export function progressTrail(done: number, total: number, cells: number = TRAIL_CELLS): TrailParts {
  const usable = Math.max(1, cells - 1)
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0
  const filled = Math.round(ratio * usable)
  return { filled: "━".repeat(filled), head: "●", rest: "┄".repeat(usable - filled) }
}

export const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"] as const
export const SPINNER_INTERVAL_MS = 120

export const IMPORT_MICROCOPY = ["packing context…", "porting memories…", "reading transcripts…"] as const
export const MICROCOPY_INTERVAL_MS = 2500

/** Whole seconds while a run is ticking: `12s`, `1m 5s`. */
export function formatTickingElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/** One-decimal seconds for the final summary: `3.2s`, `1m 5s`. */
export function formatFinalElapsed(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

// --- text -----------------------------------------------------------------------

/** Deterministic string truncation — layout-engine flex clipping proved
 *  unreliable here (see the scroll/highlight fixes in the git history), so
 *  rows truncate their own strings instead. */
export function truncateEnd(text: string, max: number): string {
  if (max <= 0) return ""
  if (text.length <= max) return text
  if (max === 1) return "…"
  return text.slice(0, max - 1) + "…"
}

// --- step 5: confetti -------------------------------------------------------------

export type ConfettiColor = "gold" | "lavender" | "coral"

export interface ConfettiSpan {
  text: string
  color?: ConfettiColor
}

const CONFETTI_CHARS = ["*", "✦", "˚", "·"] as const
const CONFETTI_COLORS: ConfettiColor[] = ["gold", "lavender", "coral"]

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One line of scattered `* ✦ ˚ ·` glyphs, deterministic per seed so tests can
 *  assert on it and the mount-time twinkle just advances the seed. */
export function confettiSpans(width: number, seed: number): ConfettiSpan[] {
  const rng = mulberry32(seed)
  const cells: ({ char: string; color: ConfettiColor } | undefined)[] = Array.from({ length: width })
  const glyphs = Math.max(4, Math.floor(width / 7))
  for (let i = 0; i < glyphs; i++) {
    const position = Math.floor(rng() * width)
    cells[position] = {
      char: CONFETTI_CHARS[Math.floor(rng() * CONFETTI_CHARS.length)]!,
      color: CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length)]!,
    }
  }
  const spans: ConfettiSpan[] = []
  let run = ""
  let runColor: ConfettiColor | undefined
  const flush = () => {
    if (!run) return
    spans.push(runColor ? { text: run, color: runColor } : { text: run })
    run = ""
  }
  for (const cell of cells) {
    if (run && cell?.color !== runColor) flush()
    runColor = cell?.color
    run += cell?.char ?? " "
  }
  flush()
  return spans
}
