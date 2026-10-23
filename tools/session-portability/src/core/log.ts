// S8 — the local run log: a persistence sink over the orchestrator's PorterEvent
// stream. The CLI (--json) and the TUI are two listeners on that stream; this is
// the third, and the only one that writes to disk. Zero orchestrator/TUI imports,
// same discipline as events.ts.
//
// What it records (append-only JSONL, `<dataDir>/logs/runs.jsonl`):
//   - `error` events (with stack when the emitter provides one)
//   - one `run` summary line per port invocation
//   - `crash` lines from the CLI's top-level catch
// Progress events are deliberately NOT persisted — noise, no debug value.
//
// Privacy: this tool's whole job is private conversation data, so records are
// whitelisted field-by-field (never spread a raw event or error into a record)
// and every string passes through scrub(): the home directory is collapsed to
// `~` and lengths are capped. Conversation content, cwd, and absolute paths
// must never land in the log.
//
// Opt-out: honors DO_NOT_TRACK=1 and HELLO_SESSIONS_LOG=0 (checked per write, so
// tests and long-lived processes see env changes). Local-only — nothing here
// touches the network; this is also the substrate a future crash reporter or
// usage telemetry would tee from, reusing the same scrubbing and opt-out.

import fs from "fs"
import os from "os"
import path from "path"

import type { HarnessId } from "../ir"
import type { PorterEvent, PorterEventEmitter } from "./events"
import type { ExportStatus } from "./orchestrator"
import { defaultDataDir } from "./data-dir"

export { defaultDataDir } from "./data-dir"

const MAX_MESSAGE_CHARS = 500
const MAX_STACK_CHARS = 2000
const MAX_LOG_BYTES = 5 * 1024 * 1024

export interface RunSummary {
  from: HarnessId
  to: HarnessId
  options: { all: boolean; ids: number; force: boolean }
  counts: Record<ExportStatus, number>
  durationMs: number
  cliVersion: string
  status: "ok" | "partial" | "crash"
}

export interface RunLogger {
  /** Subscribe to a PorterEvent stream; persists only `error` events (redacted). Returns unsubscribe. */
  attach(events: PorterEventEmitter): () => void
  /** Write the one-line run summary. */
  finishRun(summary: RunSummary): void
  /** Record an uncaught top-level crash. */
  logCrash(err: unknown): void
}

/** Fold a port's outcomes into the run-summary counts + ok/partial status. */
export function summarizeOutcomes(outcomes: Array<{ status: ExportStatus }>): {
  counts: Record<ExportStatus, number>
  status: "ok" | "partial"
} {
  const counts: Record<ExportStatus, number> = { created: 0, updated: 0, skipped: 0, error: 0 }
  for (const o of outcomes) counts[o.status]++
  return { counts, status: counts.error > 0 ? "partial" : "ok" }
}

// --- enablement ----------------------------------------------------------------

/** Local logging is on by default; DO_NOT_TRACK=1 or HELLO_SESSIONS_LOG=0 turns it off. */
export function loggingEnabled(): boolean {
  if (process.env.DO_NOT_TRACK === "1") return false
  if (process.env.HELLO_SESSIONS_LOG === "0") return false
  return true
}

// --- path resolution -------------------------------------------------------------

let logPathOverride: string | undefined

/** Redirect the log at a specific file (tests point this at a temp path). */
export function setLogPath(p: string | undefined): void {
  logPathOverride = p
}

/** Resolve the log file path: override > $HELLO_SESSIONS_LOG_PATH > <dataDir>/logs/runs.jsonl. */
export function getLogPath(): string {
  return (
    logPathOverride ?? process.env.HELLO_SESSIONS_LOG_PATH ?? path.join(defaultDataDir(), "logs", "runs.jsonl")
  )
}

// --- redaction --------------------------------------------------------------------

function scrub(s: string, cap: number): string {
  const home = os.homedir()
  let out = s
  if (home && home !== "/") out = out.split(home).join("~")
  return out.length > cap ? out.slice(0, cap) : out
}

function crashMessage(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return {
      message: scrub(err.message, MAX_MESSAGE_CHARS),
      stack: err.stack ? scrub(err.stack, MAX_STACK_CHARS) : undefined,
    }
  }
  return { message: scrub(String(err), MAX_MESSAGE_CHARS) }
}

// --- file IO (best-effort: a failed log write must never fail the port) -------------

function appendLine(record: Record<string, unknown>): void {
  if (!loggingEnabled()) return
  const file = getLogPath()
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    try {
      if (fs.statSync(file).size > MAX_LOG_BYTES) fs.renameSync(file, `${file}.1`)
    } catch {}
    fs.appendFileSync(file, JSON.stringify(record) + "\n")
  } catch {}
}

// --- the logger -----------------------------------------------------------------------

export function createRunLogger(now: () => string): RunLogger {
  const errorRecord = (event: PorterEvent): Record<string, unknown> => {
    const record: Record<string, unknown> = {
      at: now(),
      kind: "error",
      harness: event.harness,
    }
    if (event.sourceSessionId !== undefined) record.sourceSessionId = event.sourceSessionId
    if (event.message !== undefined) record.message = scrub(event.message, MAX_MESSAGE_CHARS)
    if (event.stack !== undefined) record.stack = scrub(event.stack, MAX_STACK_CHARS)
    return record
  }

  return {
    attach(events: PorterEventEmitter): () => void {
      return events.on((event) => {
        if (event.type !== "error") return
        appendLine(errorRecord(event))
      })
    },

    finishRun(summary: RunSummary): void {
      appendLine({
        at: now(),
        kind: "run",
        from: summary.from,
        to: summary.to,
        options: summary.options,
        counts: summary.counts,
        durationMs: summary.durationMs,
        cliVersion: summary.cliVersion,
        status: summary.status,
      })
    },

    logCrash(err: unknown): void {
      appendLine({ at: now(), kind: "crash", ...crashMessage(err) })
    },
  }
}
