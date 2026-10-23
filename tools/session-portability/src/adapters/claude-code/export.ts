// Claude Code EXPORT adapter (S4, revised for S8): Hub IR -> a synthesized Claude
// Code transcript.
//
// Claude Code has no "create session" API; its only integration surface is the
// on-disk JSONL at ~/.claude/projects/<encode(cwd)>/<session-uuid>.jsonl, threaded
// by a `parentUuid` linked list (null at the start). We synthesize one such file
// from a PortableSession: one JSONL line per turn, fresh uuids, chained parents.
//
// Scope (v1): text turns only. No tool_use / thinking / attachments. Always writes
// a NEW file unless `opts.existingDestId` is given, in which case the same-named
// file is atomically overwritten in place (continuation keeps its destSessionId).
// Writes atomically (temp file + rename).
//
// Idempotency ownership (S8 revision): this adapter has NO ledger of its own —
// S8's orchestrator (src/core/ledger.ts) is the single idempotency authority. This
// module unconditionally does what it's told: write() always writes,
// teardown() always removes. Each synthesized line carries a small
// `helloOsSource` provenance stamp so teardown() (which has no ledger to
// consult) can find the right file(s) by scanning.

import fs from "fs"
import os from "os"
import path from "path"

import type { ExportAdapter, ExportResult, PortableSession, WriteOptions } from "../../adapter"

/** Stamped into every synthesized line's `version` field so exports are identifiable. */
export const PORTER_VERSION = "hello-sessions/0.1"

/** Fallback model for assistant lines when the IR turn carries no `model`. */
export const DEFAULT_MODEL = "claude-opus-4-8"

/** cwd -> Claude's project dir name: every "/" becomes "-" (leading slash included). */
export function encodeCwd(cwd: string): string {
  return cwd.replaceAll("/", "-")
}

/** epoch-ms (or now) -> ISO-8601 UTC, matching Claude's `timestamp` format. */
export function toIsoMs(epochMs?: number): string {
  return new Date(epochMs ?? Date.now()).toISOString()
}

export interface ClaudeExportOptions extends WriteOptions {
  /** Override the projects root (tests point this at a temp dir). */
  projectsRoot?: string
  /** Override the porter version stamp. */
  version?: string
}

let projectsRootOverride: string | undefined = process.env.CLAUDE_PROJECTS_ROOT

/** Redirect the default projects root (tests point this at a temp dir). */
export function setProjectsRoot(dir: string | undefined): void {
  projectsRootOverride = dir
}

function resolveProjectsRoot(opts?: { projectsRoot?: string }): string {
  return (
    opts?.projectsRoot ??
    projectsRootOverride ??
    path.join(os.homedir(), ".claude", "projects")
  )
}

function gitBranchOf(session: PortableSession): string {
  const b = (session.sourceMetadata as Record<string, unknown> | undefined)?.gitBranch
  return typeof b === "string" ? b : ""
}

/**
 * Build the ordered list of JSONL line objects for a session, chaining `parentUuid`.
 * Pure + side-effect free so it can be unit-tested without touching disk. Every
 * line carries a `helloOsSource` provenance stamp — the only way
 * teardown() can find this file again now that there is no adapter-level ledger.
 */
export function buildTranscript(
  session: PortableSession,
  sessionId: string,
  version: string = PORTER_VERSION,
): Array<Record<string, unknown>> {
  const gitBranch = gitBranchOf(session)
  const helloOsSource = { harness: session.sourceHarness, sessionId: session.sourceSessionId }
  const lines: Array<Record<string, unknown>> = []
  let parentUuid: string | null = null

  for (const turn of session.turns) {
    const uuid = crypto.randomUUID()
    const envelope = {
      uuid,
      parentUuid,
      isSidechain: false,
      isMeta: false,
      sessionId,
      timestamp: toIsoMs(turn.timestamp),
      cwd: session.cwd,
      gitBranch,
      version,
      type: turn.role,
      helloOsSource,
    }

    if (turn.role === "user") {
      lines.push({ ...envelope, message: { role: "user", content: turn.text } })
    } else {
      lines.push({
        ...envelope,
        message: {
          role: "assistant",
          model: turn.model ?? DEFAULT_MODEL,
          content: [{ type: "text", text: turn.text }],
          stop_reason: "end_turn",
        },
      })
    }
    parentUuid = uuid
  }

  return lines
}

async function detect(opts?: { projectsRoot?: string }): Promise<boolean> {
  const root = resolveProjectsRoot(opts)
  try {
    if (fs.existsSync(root)) {
      fs.accessSync(root, fs.constants.W_OK)
      return true
    }
    // Fall back to creatable: the projects root can be made if its parent is writable
    // (e.g. ~/.claude exists but ~/.claude/projects doesn't yet).
    const parent = path.dirname(root)
    if (fs.existsSync(parent)) {
      fs.accessSync(parent, fs.constants.W_OK)
      return true
    }
    return false
  } catch {
    return false
  }
}

async function write(session: PortableSession, opts?: ClaudeExportOptions): Promise<ExportResult> {
  // Edge cases first — never leave a partial file behind.
  if (!session.cwd || !session.cwd.trim()) {
    throw new Error(
      "claude-code export: session.cwd is empty; cannot place the transcript file",
    )
  }
  if (!Array.isArray(session.turns) || session.turns.length === 0) {
    return {
      destSessionId: "",
      skipped: true,
      reason: "claude-code export: zero-turn session; nothing to write",
    }
  }

  const root = resolveProjectsRoot(opts)
  const dir = path.join(root, encodeCwd(session.cwd))
  fs.mkdirSync(dir, { recursive: true })

  // opts.existingDestId (set by S8's orchestrator when the ledger has a live
  // record) -> update the SAME file in place, preserving destSessionId across a
  // grown/continued source. Otherwise mint a brand-new session id.
  const sessionId = opts?.existingDestId ?? crypto.randomUUID()
  const finalPath = path.join(dir, `${sessionId}.jsonl`)
  const version = opts?.version ?? PORTER_VERSION

  const lines = buildTranscript(session, sessionId, version)
  const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n"

  // Atomic write: temp file in the same dir, then rename (rename is atomic on same
  // fs, and overwrites an existing same-named file — this is what makes
  // "update in place" and "create" the same code path).
  const tmpPath = path.join(dir, `.${sessionId}.${process.pid}.${Date.now()}.tmp`)
  fs.writeFileSync(tmpPath, body)
  try {
    fs.renameSync(tmpPath, finalPath)
  } catch (err) {
    try {
      fs.rmSync(tmpPath, { force: true })
    } catch {}
    throw err
  }

  return { destSessionId: sessionId, skipped: false }
}

// --- teardown: no adapter-level ledger, so scan for our provenance stamp -----

function walkJsonlFiles(root: string): string[] {
  const out: string[] = []
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name.endsWith(".jsonl")) out.push(full)
    }
  }
  return out
}

function firstLine(file: string): Record<string, unknown> | undefined {
  try {
    const raw = fs.readFileSync(file, "utf8")
    const line = raw.split("\n").find((l) => l.trim())
    return line ? (JSON.parse(line) as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

async function teardown(sourceSessionId: string): Promise<void> {
  const root = resolveProjectsRoot()
  if (!fs.existsSync(root)) return
  for (const file of walkJsonlFiles(root)) {
    const obj = firstLine(file)
    const stamp = obj?.helloOsSource as { sessionId?: string } | undefined
    if (stamp?.sessionId === sourceSessionId) {
      try {
        fs.rmSync(file, { force: true })
      } catch {}
    }
  }
}

/** ExportAdapter, plus opts-aware `write`/`detect` overloads used by the CLI/tests. */
export interface ClaudeCodeExportAdapter extends ExportAdapter {
  write(session: PortableSession, opts?: ClaudeExportOptions): Promise<ExportResult>
  detect(opts?: { projectsRoot?: string }): Promise<boolean>
}

export const claudeCodeExport: ClaudeCodeExportAdapter = {
  harness: "claude-code",
  detect,
  write,
  teardown,
}
