// OpenCode EXPORT adapter (revised for S8) — Hub IR -> opencode.
//
// Strategy (S6, decided): synthesize opencode's native interchange JSON
// `{ info, messages: [{ info, parts }] }` from a PortableSession, write it to a
// temp file, and shell out to `opencode import <tmpfile>`. opencode owns the
// mutation, so we never couple to the live SQLite schema on the happy path.
//
// KEY BEHAVIOUR (verified by the S6 spike, see opencode-export.test.ts header):
//   * `opencode import` does NOT trust `info.projectID`/`directory`/`path` in the
//     JSON — it overwrites them from the *invocation context* (the cwd the command
//     runs from). So we spawn `opencode import` with the child process cwd set to
//     `session.cwd` to land the session in the right project.
//   * With cwd = session.cwd, `opencode import` AUTO-CREATES (or selects) the
//     `project` row on its own — no pre-creation needed. (Spike finding.)
//   * `opencode import` preserves the synthesized `info.id` as the created
//     session's id (verified by the S6 spike + its tests) — this is what lets us
//     treat `info.id` as the destSessionId.
//
// Fallback (S6 criterion 5): when `opencode` is not on PATH we insert rows
// directly via bun:sqlite into the opencode store, replicating the project
// resolution the shipped ClaudeWriter uses (git-tracked cwd is filed by opencode
// on the CLI path; the fallback files every cwd under a deterministic per-cwd
// project id). Selected automatically when the CLI is absent, or forced for tests
// via SESSION_PORTER_OPENCODE_FORCE_FALLBACK=1.
//
// Idempotency ownership (S8 revision): this adapter has NO ledger of its own — S8's
// orchestrator (src/core/ledger.ts) is the single idempotency authority. write()
// unconditionally creates (or, with opts.existingDestId, updates in place):
//   - no opts.existingDestId -> fresh ses_/msg_/prt_ ids, a brand-new session.
//   - opts.existingDestId set -> the orchestrator has a live ledger record for this
//     (source, dest) pair; we try to find that session row and replace its
//     messages/parts in place (same session id — continuation keeps its
//     destSessionId). If the row isn't found (e.g. deleted out of band), we fall
//     back to a fresh create using that same id.
// Since we own no side-channel ledger, provenance is stamped directly onto the
// destination's own `session.metadata` column (`{ sourcePorter: { sourceHarness,
// sourceSessionId } }`) so teardown()/update-in-place can find "our" row by
// scanning the DB, on both the CLI and fallback write paths.

import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { createHash, randomBytes } from "crypto"
import { Database } from "bun:sqlite"
import type { PortableSession } from "../../ir"
import type { ExportAdapter, ExportResult, HarnessId, WriteOptions } from "../../adapter"
import { openProjectInDesktopApp, shouldOpenProjectOnce } from "./open-project"

const HARNESS: HarnessId = "opencode"

const DEFAULT_PROVIDER = "anthropic"
const DEFAULT_MODEL = "claude-opus-4-8"

// --- interchange types (structural mirror of opencode's export shape) ---------

export type OcTextPart = {
  id: string
  sessionID: string
  messageID: string
  type: "text"
  text: string
}

export type OcUserMessage = {
  id: string
  sessionID: string
  role: "user"
  time: { created: number }
  agent: string
  model: { providerID: string; modelID: string }
}

export type OcAssistantMessage = {
  id: string
  sessionID: string
  role: "assistant"
  time: { created: number; completed: number }
  parentID: string
  modelID: string
  providerID: string
  mode: string
  agent: string
  path: { cwd: string; root: string }
  cost: number
  tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } }
}

export type OcSessionInfo = {
  id: string
  slug: string
  projectID: string
  directory: string
  path: string
  title: string
  version: string
  time: { created: number; updated: number }
  model: { id: string; providerID: string }
}

export type Interchange = {
  info: OcSessionInfo
  messages: Array<{ info: OcUserMessage | OcAssistantMessage; parts: OcTextPart[] }>
}

/** Provenance stamped into `session.metadata` — our only idempotency signal (no ledger of our own). */
type Provenance = { sourcePorter: { sourceHarness: string; sourceSessionId: string } }

function provenanceOf(session: PortableSession): Provenance {
  return { sourcePorter: { sourceHarness: session.sourceHarness, sourceSessionId: session.sourceSessionId } }
}

// --- id generation ------------------------------------------------------------

let idCounter = 0
function freshId(prefix: "ses" | "msg" | "prt"): string {
  const ts = Date.now().toString(36)
  const seq = (idCounter++).toString(36).padStart(6, "0")
  return `${prefix}_${ts}${seq}${randomBytes(5).toString("hex")}`
}

// --- interchange builder (pure; unit-tested) ----------------------------------

/**
 * Synthesize opencode's native interchange JSON from a PortableSession.
 * Fresh msg_/prt_ ids, one TextPart per turn, alternating roles preserved from the
 * IR. Pass `opts.sessionId` to reuse an existing destination id (update-in-place)
 * instead of minting a fresh `ses_...` id. `directory` is set to `session.cwd`
 * (opencode overwrites it from the invocation cwd, but we set it for a faithful,
 * self-describing document).
 */
export function buildInterchange(session: PortableSession, opts?: { sessionId?: string }): Interchange {
  const model = pickModel(session)
  const sessionId = opts?.sessionId ?? freshId("ses")
  const baseCreated = session.createdAt ?? session.turns[0]?.timestamp ?? Date.now()
  const baseUpdated = session.updatedAt ?? session.turns[session.turns.length - 1]?.timestamp ?? baseCreated

  const messages: Interchange["messages"] = []
  let lastUserId: string | undefined

  session.turns.forEach((turn, i) => {
    const created = turn.timestamp ?? baseCreated + i
    const messageId = freshId("msg")
    const part: OcTextPart = {
      id: freshId("prt"),
      sessionID: sessionId,
      messageID: messageId,
      type: "text",
      text: turn.text,
    }

    if (turn.role === "user") {
      const info: OcUserMessage = {
        id: messageId,
        sessionID: sessionId,
        role: "user",
        time: { created },
        agent: "build",
        model: { providerID: model.providerID, modelID: turn.model || model.modelID },
      }
      messages.push({ info, parts: [part] })
      lastUserId = messageId
      return
    }

    const info: OcAssistantMessage = {
      id: messageId,
      sessionID: sessionId,
      role: "assistant",
      time: { created, completed: created },
      // opencode requires a parentID on assistant messages; anchor to the last
      // user turn, or to itself if the transcript opens with an assistant turn.
      parentID: lastUserId ?? messageId,
      modelID: turn.model || model.modelID,
      providerID: model.providerID,
      mode: "build",
      agent: "build",
      path: { cwd: session.cwd, root: session.cwd },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    }
    messages.push({ info, parts: [part] })
  })

  const info: OcSessionInfo = {
    id: sessionId,
    slug: slugFor(session.title, sessionId),
    // Overwritten by `opencode import` from the invocation cwd; a deterministic
    // placeholder keeps the document valid + gives the fallback a real project id.
    projectID: projectIdForCwd(session.cwd),
    directory: session.cwd,
    path: ".",
    title: session.title,
    version: "0.0.0",
    time: { created: baseCreated, updated: baseUpdated },
    model: { id: model.modelID, providerID: model.providerID },
  }

  return { info, messages }
}

function pickModel(session: PortableSession): { providerID: string; modelID: string } {
  const meta = session.sourceMetadata as Record<string, unknown>
  const providerID = typeof meta.providerID === "string" ? meta.providerID : DEFAULT_PROVIDER
  const modelID =
    typeof meta.modelID === "string"
      ? meta.modelID
      : session.turns.find((t) => t.model)?.model || DEFAULT_MODEL
  return { providerID, modelID }
}

function slugFor(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return base || id.slice(-8)
}

/** Deterministic 40-char hex project id keyed on cwd (mirrors ClaudeWriter). */
function projectIdForCwd(cwd: string): string {
  return createHash("sha1").update("hello-sessions:" + cwd).digest("hex")
}

// --- environment / db resolution ---------------------------------------------

function cliAvailable(): boolean {
  if (process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK === "1") return false
  const r = spawnSync("which", ["opencode"], { encoding: "utf8" })
  return r.status === 0 && Boolean(r.stdout.trim())
}

/** Resolve the opencode DB path the same way opencode's channel logic does. */
export function resolveDbPath(): string {
  const override = process.env.OPENCODE_DB
  if (override) {
    if (override === ":memory:" || path.isAbsolute(override)) return override
    return path.join(dataDir(), override)
  }
  return path.join(dataDir(), "opencode.db")
}

function dataDir(): string {
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) return path.join(xdg, "opencode")
  return path.join(os.homedir(), ".local", "share", "opencode")
}

// --- provenance stamp + scan (no adapter-level ledger) ------------------------

function stampProvenance(dbPath: string, destSessionId: string, session: PortableSession): void {
  if (dbPath === ":memory:" || !fs.existsSync(dbPath)) return
  try {
    const db = new Database(dbPath)
    try {
      db.run("UPDATE session SET metadata = ? WHERE id = ?", [
        JSON.stringify(provenanceOf(session)),
        destSessionId,
      ])
    } finally {
      db.close()
    }
  } catch {
    // best-effort provenance stamp; never fail the export over this.
  }
}

/** Find the destination session id we previously created for this source session, if any. */
function findDestBySource(dbPath: string, sourceSessionId: string): { destSessionId: string } | undefined {
  if (dbPath === ":memory:" || !fs.existsSync(dbPath)) return undefined
  const db = new Database(dbPath, { readonly: true })
  try {
    const rows = db.query("SELECT id, metadata FROM session WHERE metadata IS NOT NULL").all() as Array<{
      id: string
      metadata: string | null
    }>
    for (const row of rows) {
      if (!row.metadata) continue
      try {
        const meta = JSON.parse(row.metadata) as Partial<Provenance>
        if (meta?.sourcePorter?.sourceSessionId === sourceSessionId) return { destSessionId: row.id }
      } catch {
        // not our provenance shape; ignore
      }
    }
    return undefined
  } finally {
    db.close()
  }
}

/** Replace an existing destination session's messages/parts in place, keeping its id. */
function updateInPlace(dbPath: string, destSessionId: string, interchange: Interchange, session: PortableSession): boolean {
  if (dbPath === ":memory:" || !fs.existsSync(dbPath)) return false
  const db = new Database(dbPath)
  try {
    const row = db.query("SELECT id FROM session WHERE id = ?").get(destSessionId) as { id: string } | undefined
    if (!row) return false

    db.run("DELETE FROM part WHERE session_id = ?", [destSessionId])
    db.run("DELETE FROM message WHERE session_id = ?", [destSessionId])

    const now = Date.now()
    db.run("UPDATE session SET title = ?, time_updated = ?, metadata = ? WHERE id = ?", [
      interchange.info.title,
      now,
      JSON.stringify(provenanceOf(session)),
      destSessionId,
    ])

    for (const msg of interchange.messages) {
      const { id, sessionID: _s, ...data } = msg.info as Record<string, unknown> & { id: string }
      db.run(
        `INSERT INTO message (id, session_id, time_created, time_updated, data)
         VALUES (?, ?, ?, ?, ?)`,
        [id, destSessionId, msg.info.time.created, now, JSON.stringify(data)],
      )
      for (const part of msg.parts) {
        const { id: pid, sessionID: _ss, messageID: _m, ...pdata } = part
        db.run(
          `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pid, msg.info.id, destSessionId, msg.info.time.created, now, JSON.stringify(pdata)],
        )
      }
    }
    return true
  } finally {
    db.close()
  }
}

// --- desktop deep link (best-effort UX nicety, never in the write contract) ---

/**
 * After a write, verify the session actually landed (its row + all expected
 * messages are present in opencode.db) and, gated on cwd + a per-directory
 * dedupe, fire the fire-and-forget deep link that opens/focuses the project in
 * the OpenCode desktop app. Never opens a window on a failed/partial write.
 */
function maybeOpenProject(
  dbPath: string,
  destSessionId: string,
  interchange: Interchange,
  session: PortableSession,
): void {
  // Authoritative cwd from the IR — never re-derived from an encoded path.
  if (!session.cwd) return
  // Only ever launch the GUI when we wrote to the user's real, default opencode
  // store. Every test / verify / sandbox run redirects the store, so this is the
  // gate that keeps automated writes from opening (or crashing) the desktop app.
  if (!isDefaultOpencodeStore(dbPath)) return
  if (!sessionLanded(dbPath, destSessionId, interchange.messages.length)) return
  if (!shouldOpenProjectOnce(session.cwd)) return
  openProjectInDesktopApp(session.cwd)
}

/**
 * True only for the user's real, default-located opencode store. Any redirect
 * signal (a temp `OPENCODE_DB`, the fallback force flag, or an in-memory DB)
 * means we're in a test / verify / sandbox context that must NOT touch the real
 * desktop app. This is the load-bearing safety gate: without it, `bun test`
 * floods the desktop app with real deep links (it wedged the app with "unable to
 * open database file").
 */
export function isDefaultOpencodeStore(dbPath: string): boolean {
  if (dbPath === ":memory:") return false
  if (process.env.OPENCODE_DB) return false
  if (process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK === "1") return false
  return true
}

/** True only if the session row exists and carries at least the expected message count. */
function sessionLanded(dbPath: string, destSessionId: string, expectedMessages: number): boolean {
  if (dbPath === ":memory:" || !fs.existsSync(dbPath)) return false
  try {
    const db = new Database(dbPath, { readonly: true })
    try {
      const row = db.query("SELECT id FROM session WHERE id = ?").get(destSessionId)
      if (!row) return false
      const counted = db.query("SELECT COUNT(*) AS n FROM message WHERE session_id = ?").get(destSessionId) as {
        n: number
      }
      return counted.n >= expectedMessages
    } finally {
      db.close()
    }
  } catch {
    // Can't confirm the landing — err toward NOT opening a window.
    return false
  }
}

// --- adapter ------------------------------------------------------------------

export const opencodeExport = {
  harness: HARNESS,

  async detect(): Promise<boolean> {
    if (cliAvailable()) return true
    const db = resolveDbPath()
    return db !== ":memory:" && fs.existsSync(db)
  },

  /**
   * Create (or, with `opts.existingDestId`, update in place) the session in
   * opencode. Unconditional: this adapter owns no ledger, so every call writes.
   */
  async write(session: PortableSession, opts?: WriteOptions): Promise<ExportResult> {
    const existingDestId = opts?.existingDestId
    const interchange = buildInterchange(session, existingDestId ? { sessionId: existingDestId } : undefined)
    const destSessionId = interchange.info.id

    if (existingDestId) {
      const updated = updateInPlace(resolveDbPath(), existingDestId, interchange, session)
      if (updated) {
        maybeOpenProject(resolveDbPath(), destSessionId, interchange, session)
        return { destSessionId, skipped: false }
      }
      // Fall through: the ledger pointed at a destination we can't find anymore —
      // create fresh, reusing the same id so the ledger stays consistent.
    }

    if (cliAvailable()) {
      runCliImport(interchange, session.cwd)
    } else {
      writeViaSqlite(interchange, session.cwd)
    }

    stampProvenance(resolveDbPath(), destSessionId, session)
    maybeOpenProject(resolveDbPath(), destSessionId, interchange, session)

    return { destSessionId, skipped: false }
  },

  /** Delete the created session + its messages/parts (found by provenance scan, not a ledger). */
  async teardown(sourceSessionId: string): Promise<void> {
    const dbPath = resolveDbPath()
    const found = findDestBySource(dbPath, sourceSessionId)
    if (!found) return

    const db = new Database(dbPath)
    try {
      db.run("PRAGMA foreign_keys = ON")
      db.run("DELETE FROM part WHERE session_id = ?", [found.destSessionId])
      db.run("DELETE FROM message WHERE session_id = ?", [found.destSessionId])
      db.run("DELETE FROM session WHERE id = ?", [found.destSessionId])
    } finally {
      db.close()
    }
  },
} satisfies ExportAdapter

// --- primary path: shell out to `opencode import` -----------------------------

function runCliImport(interchange: Interchange, cwd: string): void {
  const tmpFile = path.join(
    os.tmpdir(),
    `hello-sessions-oc-${Date.now()}-${randomBytes(4).toString("hex")}.json`,
  )
  fs.writeFileSync(tmpFile, JSON.stringify(interchange))
  try {
    const r = spawnSync("opencode", ["import", tmpFile], {
      cwd, // S6: land the session in the project rooted at session.cwd
      env: process.env, // OPENCODE_DB / OPENCODE_DISABLE_CHANNEL_DB passthrough
      encoding: "utf8",
    })
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`
    if (r.status !== 0 || !out.includes("Imported session")) {
      throw new Error(
        `opencode import failed (status=${r.status}): ${out.trim() || r.error?.message || "unknown error"}`,
      )
    }
  } finally {
    try {
      fs.unlinkSync(tmpFile)
    } catch {}
  }
}

// --- fallback: direct SQLite insert (opencode CLI absent) ---------------------

// Column set mirrors packages/core/src/session/sql.ts. CREATE ... IF NOT EXISTS
// is a no-op against a real opencode.db (tables already exist) and self-provisions
// a compatible store when writing to a fresh temp DB in tests.
function ensureSchema(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS project (
    id text PRIMARY KEY, worktree text NOT NULL, vcs text, name text,
    icon_url text, icon_url_override text, icon_color text,
    time_created integer NOT NULL, time_updated integer NOT NULL,
    time_initialized integer, sandboxes text NOT NULL, commands text)`)
  db.run(`CREATE TABLE IF NOT EXISTS session (
    id text PRIMARY KEY, project_id text NOT NULL, workspace_id text, parent_id text,
    slug text NOT NULL, directory text NOT NULL, path text, title text NOT NULL,
    version text NOT NULL, share_url text, summary_additions integer,
    summary_deletions integer, summary_files integer, summary_diffs text, metadata text,
    cost real DEFAULT 0 NOT NULL, tokens_input integer DEFAULT 0 NOT NULL,
    tokens_output integer DEFAULT 0 NOT NULL, tokens_reasoning integer DEFAULT 0 NOT NULL,
    tokens_cache_read integer DEFAULT 0 NOT NULL, tokens_cache_write integer DEFAULT 0 NOT NULL,
    revert text, permission text, agent text, model text,
    time_created integer NOT NULL, time_updated integer NOT NULL,
    time_compacting integer, time_archived integer)`)
  db.run(`CREATE TABLE IF NOT EXISTS message (
    id text PRIMARY KEY, session_id text NOT NULL, time_created integer NOT NULL,
    time_updated integer NOT NULL, data text NOT NULL)`)
  db.run(`CREATE TABLE IF NOT EXISTS part (
    id text PRIMARY KEY, message_id text NOT NULL, session_id text NOT NULL,
    time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL)`)
}

function writeViaSqlite(interchange: Interchange, cwd: string): void {
  const dbPath = resolveDbPath()
  if (dbPath === ":memory:") throw new Error("fallback requires a file-backed OPENCODE_DB")
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath, { create: true })
  try {
    ensureSchema(db)
    const now = Date.now()
    const projectId = projectIdForCwd(cwd)

    db.run(
      `INSERT INTO project (id, worktree, vcs, sandboxes, time_created, time_updated)
       VALUES (?, ?, NULL, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [projectId, cwd, JSON.stringify([cwd]), now, now],
    )

    const s = interchange.info
    db.run(
      `INSERT INTO session (id, project_id, slug, directory, path, title, version, cost,
        tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write,
        model, time_created, time_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [
        s.id,
        projectId,
        s.slug,
        cwd,
        ".",
        s.title,
        s.version,
        JSON.stringify(s.model),
        s.time.created,
        s.time.updated,
      ],
    )

    for (const msg of interchange.messages) {
      const { id, sessionID: _s, ...data } = msg.info as Record<string, unknown> & { id: string }
      db.run(
        `INSERT INTO message (id, session_id, time_created, time_updated, data)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
        [id, s.id, msg.info.time.created, now, JSON.stringify(data)],
      )
      for (const part of msg.parts) {
        const { id: pid, sessionID: _ss, messageID: _m, ...pdata } = part
        db.run(
          `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
           VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
          [pid, msg.info.id, s.id, msg.info.time.created, now, JSON.stringify(pdata)],
        )
      }
    }
  } finally {
    db.close()
  }
}
