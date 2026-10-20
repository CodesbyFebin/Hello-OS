// Harness detection + capability registry (S7).
//
// Pure, read-only detection of which harnesses are present on this machine and,
// per harness, whether they can be read from (import / source) and written to
// (export / destination). No adapter imports on purpose: this stays independent
// of the parallel per-adapter work (S1-S6) so the two can land in either order.
//
// Signals (see docs/adapters/*.md):
//   claude-code: ~/.claude exists (installed); ~/.claude/projects exists (import);
//                projects/ writable — or ~/.claude writable to create it (export).
//   codex:       base = CODEX_HOME ?? ~/.codex; base exists (installed);
//                base/sessions exists (import); sessions writable — or base
//                writable to create it (export).
//   opencode:    `opencode` on PATH and/or an opencode*.db under the XDG data dir.
//                installed = CLI or DB present; import = CLI or DB readable;
//                export = CLI on PATH (primary) else DB writable (fallback).

import { accessSync, constants, readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import type { HarnessId } from "./ir"

export interface HarnessCapability {
  harness: HarnessId
  /** Any trace of the harness on this machine. */
  installed: boolean
  /** Usable as an import source. */
  canImport: boolean
  /** Usable as an export destination. */
  canExport: boolean
  /** Where sessions live, for the import screen (absolute path). */
  sourcePath?: string
  /** Why a capability is unavailable, or which fallback applies. */
  note?: string
}

/** Injectable environment so tests can stub HOME / PATH / overrides. */
export type DetectEnv = Record<string, string | undefined>

// --- filesystem probes (never throw) ---------------------------------------

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function canAccess(path: string, mode: number): boolean {
  try {
    accessSync(path, mode)
    return true
  } catch {
    return false
  }
}

const isWritable = (path: string): boolean => canAccess(path, constants.W_OK)
const isReadable = (path: string): boolean => canAccess(path, constants.R_OK)

function resolveHome(env: DetectEnv): string {
  return env.HOME || homedir()
}

/** First executable named `name` found by walking PATH, or undefined. */
function binaryOnPath(name: string, env: DetectEnv): string | undefined {
  const parts = (env.PATH ?? "").split(":")
  for (const dir of parts) {
    if (!dir) continue
    const candidate = join(dir, name)
    if (canAccess(candidate, constants.X_OK)) return candidate
  }
  return undefined
}

/** A directory exists and we can create children in it (create-on-write). */
function canCreateIn(dir: string): boolean {
  return isDir(dir) && isWritable(dir)
}

// --- per-harness detection --------------------------------------------------

function detectClaudeCode(env: DetectEnv): HarnessCapability {
  const base = join(resolveHome(env), ".claude")
  const projects = join(base, "projects")
  const baseExists = isDir(base)
  const projectsExists = isDir(projects)

  const installed = baseExists
  const canImport = projectsExists
  const canExport = projectsExists ? isWritable(projects) : canCreateIn(base)

  const cap: HarnessCapability = { harness: "claude-code", installed, canImport, canExport }
  if (projectsExists) cap.sourcePath = projects
  if (!installed) cap.note = "~/.claude not present"
  else if (!canImport) cap.note = "~/.claude present but projects/ missing (no sessions yet)"
  else if (!canExport) cap.note = "~/.claude/projects present but not writable"
  return cap
}

function detectCodex(env: DetectEnv): HarnessCapability {
  const base = env.CODEX_HOME || join(resolveHome(env), ".codex")
  const sessions = join(base, "sessions")
  const baseExists = isDir(base)
  const sessionsExists = isDir(sessions)

  const installed = baseExists
  const canImport = sessionsExists
  const canExport = sessionsExists ? isWritable(sessions) : canCreateIn(base)

  const cap: HarnessCapability = { harness: "codex", installed, canImport, canExport }
  if (sessionsExists) cap.sourcePath = sessions
  const via = env.CODEX_HOME ? " (via CODEX_HOME)" : ""
  if (!installed) cap.note = `Codex home not present${via}`
  else if (!canImport) cap.note = `Codex home present but sessions/ missing${via}`
  else if (!canExport) cap.note = `Codex sessions/ present but not writable${via}`
  return cap
}

function opencodeDataDir(env: DetectEnv): string {
  const dataHome = env.XDG_DATA_HOME || join(resolveHome(env), ".local", "share")
  return join(dataHome, "opencode")
}

/** Candidate opencode*.db files, respecting the OPENCODE_DB override. */
function opencodeDbFiles(env: DetectEnv): string[] {
  if (env.OPENCODE_DB) return isFile(env.OPENCODE_DB) ? [env.OPENCODE_DB] : []
  const dir = opencodeDataDir(env)
  try {
    return readdirSync(dir)
      .filter((f) => /^opencode.*\.db$/.test(f))
      .map((f) => join(dir, f))
  } catch {
    return []
  }
}

/**
 * Prefer the real prod DB (`opencode.db`) over a dev-clone `opencode-local.db`
 * (the channel-DB landmine from docs/adapters/opencode.md).
 */
function primaryOpencodeDb(dbs: string[]): string | undefined {
  return dbs.find((d) => d.endsWith("opencode.db")) ?? dbs[0]
}

function detectOpencode(env: DetectEnv): HarnessCapability {
  const cli = binaryOnPath("opencode", env)
  const dbs = opencodeDbFiles(env)
  const db = primaryOpencodeDb(dbs)

  const hasCli = !!cli
  const hasDb = dbs.length > 0

  const installed = hasCli || hasDb
  const canImport = hasCli || (db ? isReadable(db) : false)
  // Export: CLI is the primary/supported write path; direct DB write is the fallback.
  const canExport = hasCli || (db ? isWritable(db) : false)

  const cap: HarnessCapability = { harness: "opencode", installed, canImport, canExport }
  if (db) cap.sourcePath = db
  else if (installed) cap.sourcePath = join(opencodeDataDir(env), "opencode.db")

  const landmine =
    "set OPENCODE_DISABLE_CHANNEL_DB=1 to target the installed opencode.db, not a dev-clone opencode-local.db"
  if (!installed) {
    cap.note = "opencode CLI not on PATH and no opencode*.db found"
  } else if (!hasCli && canExport) {
    cap.note = `opencode CLI not on PATH; export via Drizzle DB fallback (${landmine})`
  } else if (!hasCli && !canExport) {
    cap.note = `opencode CLI not on PATH and DB not writable; no export path (${landmine})`
  } else if (hasCli && !hasDb) {
    cap.note = "opencode CLI on PATH; no DB yet — import/export via the CLI"
  }
  return cap
}

// --- aggregator -------------------------------------------------------------

/**
 * Detect every known harness on this machine. Never throws; an absent harness
 * yields { installed:false, canImport:false, canExport:false }.
 *
 * `env` is injectable purely for testing (stub HOME / CODEX_HOME / PATH /
 * XDG_DATA_HOME / OPENCODE_DB); production callers use the default process env.
 *
 * Reconciliation: registry.listInstalled() can call this and project it into
 * { sources: caps.filter(canImport).harness, destinations: caps.filter(canExport).harness }.
 */
export async function detectHarnesses(env: DetectEnv = process.env): Promise<HarnessCapability[]> {
  return [detectClaudeCode(env), detectCodex(env), detectOpencode(env)]
}
