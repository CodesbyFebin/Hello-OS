// Codex EXPORT adapter (S5, revised for S8) — Hub IR -> a synthesized Codex "rollout".
//
// Codex discovers sessions by walking `<CODEX_HOME>/sessions/YYYY/MM/DD/` and
// parsing `rollout-<ts>-<uuidv7>.jsonl` filenames — there is no index file. So the
// primary strategy is to synthesize a schema-valid rollout and drop it into the
// date-sharded tree where Codex looks.
//
// RESOLVED (2026-07-01, real-machine investigation — see thread-index.ts's header
// for the full finding): the rollout file alone is NOT enough. Codex's desktop/IDE
// sidebar reads from a `threads` table in `<CODEX_HOME>/state_5.sqlite`, an index
// Codex's own app maintains — a rollout with no matching row is invisible no
// matter how many times Codex restarts. `write()` below always writes the rollout
// file (load-bearing, must never fail or be weakened) and then makes a best-effort
// attempt to index it into that table (thread-index.ts — reverse-engineered,
// undocumented, wrapped so it can never fail the export). Two modes remain for the
// OLDER, file-only mitigation:
//   - "rollout"  (default): synthesize the rollout file only (+ the sqlite index,
//     always attempted regardless of mode).
//   - "register" (fallback): also registers in `external_agent_session_imports.json`,
//     mirroring Codex's own foreign-import path (source_path, content_sha256,
//     imported_thread_id, imported_at). Independent of, and no longer required
//     for, sidebar visibility — the sqlite index is what actually does that.
//
// Safety: the rollout is built in a temp file in the same directory, fsync'd, then
// atomically renamed into place — Codex can never read a half-written file. We
// refuse to follow symlinks anywhere along the target path, and stamp
// `originator:"hello-sessions"` in session_meta so teardown() only ever deletes
// files this tool authored.
//
// Idempotency ownership (S8 revision): this adapter has NO ledger of its own — S8's
// orchestrator (src/core/ledger.ts) is the single idempotency authority. write()
// unconditionally synthesizes a rollout every time it's called:
//   - no opts.existingDestId -> brand-new uuidv7 + brand-new rollout file.
//   - opts.existingDestId set -> the orchestrator has a live ledger record for this
//     (source, dest) pair; we look for the rollout file we previously wrote for that
//     id and overwrite it IN PLACE (same path, same id — continuation keeps its
//     destSessionId). If we can't find it (e.g. it was deleted out of band), we fall
//     back to writing a fresh file under that same id.
// Each session_meta we write stamps `imported_source_session_id` /
// `imported_source_harness` so teardown() (which has no ledger to consult) can find
// the right file by scanning, the same way `originator` lets it prove ownership.

import crypto from "crypto"
import fs from "fs"
import os from "os"
import path from "path"

import type { PortableSession } from "../../ir"
import type { ExportAdapter, ExportResult, HarnessId, WriteOptions } from "../../adapter"
import { indexThreadBestEffort, threadRowExists, unindexThreadBestEffort } from "./thread-index"
import { openThreadInDesktopApp, shouldOpenThreadOnce } from "./open-project"

const HARNESS: HarnessId = "codex"

/** Stamped into every synthesized session_meta.cli_version. */
export const CLI_VERSION = "hello-sessions/0.0.1"

export type CodexExportMode = "rollout" | "register"

// ---------------------------------------------------------------------------
// Configuration (the ExportAdapter contract carries per-call opts for
// force/existingDestId only — everything else is a static runtime knob that
// tests/orchestrator redirect here: codex home, mode, cli version, history mirror).
// ---------------------------------------------------------------------------

export interface CodexExportConfig {
  /** Root of the Codex install to write into. Default: $CODEX_HOME or ~/.codex. */
  codexHome: string
  /** "rollout" writes the file only; "register" also indexes it for Codex import. */
  mode: CodexExportMode
  /** Stamped into session_meta.cli_version. */
  cliVersion: string
  /** Mirror user turns into `<codexHome>/history.jsonl` (teardown reverts it). */
  appendHistory: boolean
}

function defaultCodexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex")
}

function defaultConfig(): CodexExportConfig {
  return {
    codexHome: defaultCodexHome(),
    mode: "rollout",
    cliVersion: CLI_VERSION,
    appendHistory: false,
  }
}

let config: CodexExportConfig = defaultConfig()

/** Override any subset of the config (used by tests + the orchestrator/CLI). */
export function configureCodexExport(partial: Partial<CodexExportConfig>): void {
  config = { ...config, ...partial }
}

/** Reset config to environment defaults — test hygiene. */
export function resetCodexExportConfig(): void {
  config = defaultConfig()
}

export function getCodexExportConfig(): Readonly<CodexExportConfig> {
  return config
}

// ---------------------------------------------------------------------------
// uuidv7 + timestamp helpers
// ---------------------------------------------------------------------------

/** RFC 9562 UUIDv7: 48-bit big-endian unix-ms prefix, version 7, variant 10. */
export function uuidv7(now: number = Date.now()): string {
  const bytes = crypto.randomBytes(16)
  const ts = Math.floor(now)
  bytes[0] = Math.floor(ts / 2 ** 40) & 0xff
  bytes[1] = Math.floor(ts / 2 ** 32) & 0xff
  bytes[2] = Math.floor(ts / 2 ** 24) & 0xff
  bytes[3] = Math.floor(ts / 2 ** 16) & 0xff
  bytes[4] = Math.floor(ts / 2 ** 8) & 0xff
  bytes[5] = ts & 0xff
  bytes[6] = (bytes[6]! & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // variant 10
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Codex rollout filename stamp: `YYYY-MM-DDTHH-MM-SS` (ISO seconds, colons→dashes). */
export function formatRolloutTimestamp(epochMs: number): string {
  const iso = new Date(epochMs).toISOString() // 2025-06-15T12:34:56.789Z
  return iso.slice(0, 19).replace(/:/g, "-") // 2025-06-15T12-34-56
}

/** Date-shard components (UTC) for the sessions/ tree. */
function dateShard(epochMs: number): { y: string; m: string; d: string } {
  const iso = new Date(epochMs).toISOString()
  return { y: iso.slice(0, 4), m: iso.slice(5, 7), d: iso.slice(8, 10) }
}

// ---------------------------------------------------------------------------
// Record builders (exported for unit tests)
// ---------------------------------------------------------------------------

type Envelope = { timestamp: string; type: string; payload: Record<string, unknown> }

export function buildSessionMeta(session: PortableSession, sessionId: string, epochMs: number, cliVersion = config.cliVersion): Envelope {
  const timestamp = new Date(epochMs).toISOString()
  const modelProvider =
    (typeof session.sourceMetadata?.model_provider === "string" && session.sourceMetadata.model_provider) || "openai"
  return {
    timestamp,
    type: "session_meta",
    payload: {
      session_id: sessionId,
      id: sessionId,
      timestamp,
      cwd: session.cwd,
      originator: "hello-sessions",
      cli_version: cliVersion,
      // Codex's resume PICKER lists only `state_5.sqlite` `threads` rows, and
      // codex reconciles each row's `source` FROM this field. An unrecognized
      // value (e.g. the old "import") is stored as "unknown", which the picker
      // excludes — so a ported session never shows. "cli" is codex's own
      // interactive-TUI source, which the default picker lists. (Verified on
      // codex 0.142.5; see thread-index.ts for the preview half of this.)
      source: "cli",
      thread_source: "user",
      model_provider: modelProvider,
      base_instructions: { text: "" },
      // Provenance stamp — the only way teardown() can find this file again now
      // that there is no adapter-level ledger (S8 owns idempotency, not us).
      imported_source_session_id: session.sourceSessionId,
      imported_source_harness: session.sourceHarness,
    },
  }
}

export function buildTurnContext(session: PortableSession, epochMs: number): Envelope {
  const timestamp = new Date(epochMs).toISOString()
  return {
    timestamp,
    type: "turn_context",
    payload: {
      turn_id: uuidv7(epochMs),
      cwd: session.cwd,
      workspace_roots: [session.cwd],
      current_date: timestamp.slice(0, 10),
      timezone: "UTC",
    },
  }
}

export function buildMessageItem(role: "user" | "assistant", text: string, epochMs: number): Envelope {
  const contentType = role === "user" ? "input_text" : "output_text"
  return {
    timestamp: new Date(epochMs).toISOString(),
    type: "response_item",
    payload: {
      type: "message",
      role,
      content: [{ type: contentType, text }],
    },
  }
}

/**
 * The `event_msg` mirror of a turn. Codex derives a thread's `preview`, `title`,
 * and `first_user_message` (the `threads` columns its resume picker filters and
 * displays) from these records — specifically the first `user_message`.message —
 * NOT from the `response_item` message above. A rollout with no `user_message`
 * event gets an empty preview, and the picker's visible partial indexes filter
 * `preview <> ''`, so it stays hidden. Our own importer treats these as
 * redundant UI mirrors and ignores them when response_item turns exist, so
 * emitting both is round-trip-safe (no double-counting).
 */
export function buildMessageEvent(role: "user" | "assistant", text: string, epochMs: number): Envelope {
  return {
    timestamp: new Date(epochMs).toISOString(),
    type: "event_msg",
    payload: {
      type: role === "user" ? "user_message" : "agent_message",
      message: text,
    },
  }
}

/** Build the full ordered list of rollout records for a session. */
export function buildRolloutRecords(session: PortableSession, sessionId: string, baseEpochMs: number): Envelope[] {
  const records: Envelope[] = [
    buildSessionMeta(session, sessionId, baseEpochMs),
    buildTurnContext(session, baseEpochMs),
  ]
  for (const turn of session.turns) {
    const ts = turn.timestamp ?? baseEpochMs
    records.push(buildMessageItem(turn.role, turn.text, ts))
    records.push(buildMessageEvent(turn.role, turn.text, ts))
  }
  return records
}

// ---------------------------------------------------------------------------
// Safe filesystem primitives
// ---------------------------------------------------------------------------

/** Throw if any existing component from `root` down to `target` is a symlink. */
function assertNoSymlinks(root: string, target: string): void {
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) {
    throw new Error(`codex export: refusing to follow symlink: ${root}`)
  }
  const rel = path.relative(root, target)
  let cur = root
  for (const part of rel.split(path.sep)) {
    if (!part) continue
    cur = path.join(cur, part)
    if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) {
      throw new Error(`codex export: refusing to follow symlink: ${cur}`)
    }
  }
}

/** Atomic write: temp file in same dir (O_EXCL) -> fsync -> rename (rename overwrites a same-named target). */
function safeWriteFile(target: string, contents: string): void {
  const dir = path.dirname(target)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = path.join(dir, `.rollout-${crypto.randomBytes(6).toString("hex")}.tmp`)
  const fd = fs.openSync(tmp, "wx", 0o600) // wx = fail if exists, never follows a symlink
  try {
    fs.writeSync(fd, contents)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(tmp, target)
}

function sessionsRoot(codexHome: string): string {
  return path.join(codexHome, "sessions")
}

function rolloutPath(codexHome: string, ts: string, id: string, epochMs: number): string {
  const { y, m, d } = dateShard(epochMs)
  return path.join(sessionsRoot(codexHome), y, m, d, `rollout-${ts}-${id}.jsonl`)
}

// ---------------------------------------------------------------------------
// external_agent_session_imports.json (register-mode fallback)
// ---------------------------------------------------------------------------

function registryPath(codexHome: string): string {
  return path.join(codexHome, "external_agent_session_imports.json")
}

// A record in Codex's `external_agent_session_imports.json`. This is Codex's own
// dedupe ledger for its native "Import from Claude Code" feature: before importing
// a Claude `.jsonl`, Codex checks this file and SKIPS any source it already has a
// record for (keyed on the source's content hash). We write records keyed on the
// ORIGINAL Claude source — pointing `imported_thread_id` at OUR rollout — so Codex's
// native import treats our ports as already-imported and never creates a duplicate.
//
// `source_modified_at` is the source file's `st_mtime_ns`, which exceeds JS's safe
// integer range — we carry it as a decimal STRING end to end so read→merge→write
// never truncates it (ours or Codex's own records). It's serialized back to a raw
// JSON integer on write to match Codex's on-disk shape exactly.
type RegistryEntry = {
  source_path: string
  content_sha256: string
  imported_thread_id: string
  imported_at: number // unix seconds, matching Codex
  source_modified_at?: string // decimal ns digits (string to preserve precision)
}

const MTIME_KEY = "source_modified_at"

function readRegistry(codexHome: string): RegistryEntry[] {
  const p = registryPath(codexHome)
  if (!fs.existsSync(p)) return []
  try {
    // Quote the out-of-safe-range ns integers to strings BEFORE parsing so no
    // record (ours or Codex's) loses precision on the round-trip.
    const raw = fs.readFileSync(p, "utf8").replace(new RegExp(`("${MTIME_KEY}":\\s*)(\\d+)`, "g"), '$1"$2"')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as RegistryEntry[]
    // Codex's actual on-disk shape is `{ records: [...] }`; also tolerate `{ imports: [] }`.
    if (parsed && Array.isArray(parsed.records)) return parsed.records as RegistryEntry[]
    if (parsed && Array.isArray(parsed.imports)) return parsed.imports as RegistryEntry[]
    return []
  } catch {
    return []
  }
}

function writeRegistry(codexHome: string, entries: RegistryEntry[]): void {
  // Match Codex's exact on-disk shape (`{ records: [...] }`) and unquote the ns
  // string back to a raw integer literal so Codex parses it as a number.
  const json = JSON.stringify({ records: entries }, null, 2).replace(
    new RegExp(`("${MTIME_KEY}":\\s*)"(\\d+)"`, "g"),
    "$1$2",
  )
  fs.writeFileSync(registryPath(codexHome), json)
}

/**
 * Register a Claude→Codex port in Codex's native import ledger, keyed on the
 * ORIGINAL Claude source file so Codex's "Import from Claude Code" dedupes against
 * our port instead of creating a second copy. Best-effort and claude-code-only:
 * a missing/unreadable source, or any non-Claude origin, is simply a no-op.
 */
function registerClaudeSourceImport(codexHome: string, session: PortableSession, threadId: string): void {
  if (session.sourceHarness !== "claude-code") return
  const src = session.sourcePath
  try {
    if (!src || !fs.existsSync(src)) return
    const bytes = fs.readFileSync(src)
    const sha = crypto.createHash("sha256").update(bytes).digest("hex")
    const mtimeNs = fs.statSync(src, { bigint: true }).mtimeNs.toString()
    // Drop any prior record for this thread OR this exact source path, then add ours.
    const entries = readRegistry(codexHome).filter(
      (e) => e.imported_thread_id !== threadId && e.source_path !== src,
    )
    entries.push({
      source_path: src,
      content_sha256: sha,
      imported_thread_id: threadId,
      imported_at: Math.floor(Date.now() / 1000),
      source_modified_at: mtimeNs,
    })
    writeRegistry(codexHome, entries)
  } catch {
    // Best-effort only — dedupe registration must never fail the export.
  }
}

function unregisterImportEntry(codexHome: string, threadId: string): void {
  if (!fs.existsSync(registryPath(codexHome))) return
  const entries = readRegistry(codexHome).filter((e) => e.imported_thread_id !== threadId)
  writeRegistry(codexHome, entries)
}

// ---------------------------------------------------------------------------
// history.jsonl mirror (optional)
// ---------------------------------------------------------------------------

function appendHistory(codexHome: string, sessionId: string, session: PortableSession): void {
  const p = path.join(codexHome, "history.jsonl")
  const lines = session.turns
    .filter((t) => t.role === "user")
    .map((t) => JSON.stringify({ session_id: sessionId, ts: Math.floor((t.timestamp ?? Date.now()) / 1000), text: t.text }))
  if (lines.length === 0) return
  fs.appendFileSync(p, lines.join("\n") + "\n")
}

function pruneHistory(codexHome: string, sessionId: string): void {
  const p = path.join(codexHome, "history.jsonl")
  if (!fs.existsSync(p)) return
  const kept = fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((line) => {
      if (!line.trim()) return false
      try {
        return JSON.parse(line).session_id !== sessionId
      } catch {
        return true // leave lines we don't understand
      }
    })
  fs.writeFileSync(p, kept.length ? kept.join("\n") + "\n" : "")
}

// ---------------------------------------------------------------------------
// Provenance scan — no adapter-level ledger, so find our own files by content.
// ---------------------------------------------------------------------------

type OwnedRollout = { path: string; destId: string; mode?: CodexExportMode }

function readFirstRecord(file: string): Record<string, unknown> | undefined {
  try {
    const first = fs.readFileSync(file, "utf8").split("\n").find((l) => l.trim())
    return first ? (JSON.parse(first) as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function isOwnedRollout(file: string): boolean {
  const rec = readFirstRecord(file)
  const payload = rec?.payload as Record<string, unknown> | undefined
  return rec?.type === "session_meta" && payload?.originator === "hello-sessions"
}

/** Walk sessionsRoot recursively for a rollout file whose filename ends in `-<id>.jsonl`. */
function findRolloutFileById(codexHome: string, id: string): string | undefined {
  const root = sessionsRoot(codexHome)
  if (!fs.existsSync(root)) return undefined
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
      else if (entry.name.endsWith(`-${id}.jsonl`)) return full
    }
  }
  return undefined
}

/** Walk sessionsRoot recursively for a rollout we authored whose provenance stamp matches sourceSessionId. */
function findOwnedRolloutBySource(codexHome: string, sourceSessionId: string): OwnedRollout | undefined {
  const root = sessionsRoot(codexHome)
  if (!fs.existsSync(root)) return undefined
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
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!entry.name.endsWith(".jsonl")) continue
      const rec = readFirstRecord(full)
      const payload = rec?.payload as Record<string, unknown> | undefined
      if (
        rec?.type === "session_meta" &&
        payload?.originator === "hello-sessions" &&
        payload?.imported_source_session_id === sourceSessionId
      ) {
        return { path: full, destId: String(payload.session_id), mode: undefined }
      }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const codexExport: ExportAdapter = {
  harness: HARNESS,

  async detect(): Promise<boolean> {
    const home = config.codexHome
    // Never create ~/.codex if Codex isn't installed; only proceed if the home exists.
    if (!fs.existsSync(home)) return false
    const sessions = sessionsRoot(home)
    try {
      fs.mkdirSync(sessions, { recursive: true }) // Codex creates this lazily too
      fs.accessSync(sessions, fs.constants.W_OK)
      return true
    } catch {
      return false
    }
  },

  async write(session: PortableSession, opts?: WriteOptions): Promise<ExportResult> {
    const home = config.codexHome
    const baseEpochMs = session.updatedAt ?? Date.now()

    // opts.existingDestId (set by S8's orchestrator when the ledger has a live
    // record) -> try to update the SAME rollout file in place, preserving the id.
    let newId: string
    let target: string
    if (opts?.existingDestId) {
      newId = opts.existingDestId
      target = findRolloutFileById(home, newId) ?? rolloutPath(home, formatRolloutTimestamp(baseEpochMs), newId, baseEpochMs)
    } else {
      newId = uuidv7(baseEpochMs)
      target = rolloutPath(home, formatRolloutTimestamp(baseEpochMs), newId, baseEpochMs)
    }

    // Ensure the shard tree exists, then reject any symlink along the way.
    fs.mkdirSync(path.dirname(target), { recursive: true })
    assertNoSymlinks(home, target)

    const records = buildRolloutRecords(session, newId, baseEpochMs)
    const contents = records.map((r) => JSON.stringify(r)).join("\n") + "\n"
    safeWriteFile(target, contents)

    if (config.appendHistory) {
      appendHistory(home, newId, session)
    }

    // Register in Codex's native import ledger keyed on the ORIGINAL Claude
    // source (claude-code ports only) so Codex's own "Import from Claude Code"
    // dedupes against our port instead of creating a duplicate. Always-on and
    // best-effort — never throws, never affects the write's return status.
    registerClaudeSourceImport(home, session, newId)

    // Always attempted, independent of `mode` — this is what actually makes
    // the session appear in Codex's sidebar (see thread-index.ts). Never
    // throws, so a schema mismatch or locked DB can't fail the export;
    // worst case the rollout file exists but stays invisible until Codex's
    // own importer or a future run picks it up.
    indexThreadBestEffort(home, session, newId, target, baseEpochMs)

    // Best-effort UX nicety — open/focus the imported thread in the Codex
    // desktop app. Gated so it can NEVER fire from tests/verify/sandbox; see
    // maybeOpenThreadInDesktop. Independent of write()'s return status.
    maybeOpenThreadInDesktop(home, newId, session)

    return { destSessionId: newId, skipped: false }
  },

  // --- desktop deep link (best-effort UX nicety, never in the write contract) ---

  async teardown(sourceSessionId: string): Promise<void> {
    const home = config.codexHome
    const found = findOwnedRolloutBySource(home, sourceSessionId)
    if (!found) return
    if (isOwnedRollout(found.path)) {
      try {
        fs.unlinkSync(found.path)
      } catch {}
    }
    unregisterImportEntry(home, found.destId)
    pruneHistory(home, found.destId)
    unindexThreadBestEffort(home, found.destId)
  },
}

/**
 * True only for the user's real, default Codex home (`~/.codex`). Every test /
 * verify / sandbox run redirects the home (via `configureCodexExport({codexHome})`
 * or a sandbox `CODEX_HOME` pointing at a temp dir), so a non-default home means
 * we're in an automated context that must NOT touch the real desktop app. This is
 * the load-bearing safety gate alongside the HELLO_SESSIONS_OPEN_IN_DESKTOP opt-in:
 * without it, `bun test` could flood the desktop app with real deep links.
 */
export function isDefaultCodexHome(home: string): boolean {
  return home === path.join(os.homedir(), ".codex")
}

/**
 * After a write, confirm the thread actually landed in the sidebar index (its
 * `threads` row is present) and, gated on cwd + a per-directory dedupe, fire the
 * fire-and-forget deep link that opens/focuses it in the Codex desktop app.
 * Never opens a window on a failed/partial write, from a redirected home, or
 * without the HELLO_SESSIONS_OPEN_IN_DESKTOP opt-in (checked in openThreadInDesktopApp).
 */
function maybeOpenThreadInDesktop(home: string, destSessionId: string, session: PortableSession): void {
  // Authoritative cwd from the IR — never re-derived from an encoded path.
  if (!session.cwd) return
  if (!isDefaultCodexHome(home)) return
  if (!threadRowExists(home, destSessionId)) return
  if (!shouldOpenThreadOnce(session.cwd)) return
  openThreadInDesktopApp(destSessionId)
}
