// OpenCode import adapter (spoke -> Hub IR).
//
// Primary path: shell out to `opencode export <sessionID>` and parse its native
// interchange JSON `{ info, messages: [{ info, parts }] }`. This avoids coupling
// to the Drizzle SQLite schema.
//
// Fallback path (CLI unavailable): read the V1 `message` + `part` tables directly
// via a READ-ONLY SQLite handle. Never writes in the import path.
//
// Channel-DB landmine (see docs/adapters/opencode.md): a `bun`-run dev clone is
// channel `local` and targets `opencode-local.db`, not the installed app's
// `opencode.db`. We default reads to `opencode.db` (the `OPENCODE_DISABLE_CHANNEL_DB=1`
// behavior) and set that env var when shelling out to the CLI. `OPENCODE_DB` wins.

import fs from "fs"
import os from "os"
import path from "path"
import { Database } from "bun:sqlite"

import { PortableSession } from "../../ir"
import type { PortableSession as PS, PortableTurn } from "../../ir"
import type { ImportAdapter, SessionRef } from "../../adapter"

const HARNESS = "opencode" as const

// ---------------------------------------------------------------------------
// OpenCode native interchange shapes (the subset we read). Everything else in
// the export JSON is preserved verbatim under `sourceMetadata`.
// ---------------------------------------------------------------------------

interface OcPart {
  type: string
  text?: string
  [k: string]: unknown
}

interface OcMessageInfo {
  id?: string
  role?: string
  time?: { created?: number }
  model?: { providerID?: string; modelID?: string } | null
  modelID?: string | null
  providerID?: string | null
}

interface OcMessage {
  info: OcMessageInfo
  parts: OcPart[]
}

interface OcSessionInfo {
  id: string
  directory?: string
  title?: string
  time?: { created?: number; updated?: number }
  model?: unknown
  tokens?: unknown
  cost?: unknown
  version?: unknown
  projectID?: string
}

export interface OcExport {
  info: OcSessionInfo
  messages: OcMessage[]
}

// ---------------------------------------------------------------------------
// Path resolution — mirrors opencode's database.ts precedence for READS.
// ---------------------------------------------------------------------------

export function opencodeDataDir(env: Record<string, string | undefined> = process.env): string {
  if (env.XDG_DATA_HOME) return path.join(env.XDG_DATA_HOME, "opencode")
  return path.join(os.homedir(), ".local", "share", "opencode")
}

/**
 * Resolve the SQLite DB to read from.
 * - `OPENCODE_DB` override wins (honored per S3 AC-4).
 * - Otherwise default to `opencode.db` — the installed app DB — NOT the
 *   `opencode-local.db` a dev clone would write. This is the
 *   `OPENCODE_DISABLE_CHANNEL_DB=1` behavior, applied unconditionally for reads.
 */
export function resolveOpencodeDbPath(
  opts: { env?: Record<string, string | undefined>; dataDir?: string } = {},
): string {
  const env = opts.env ?? process.env
  if (env.OPENCODE_DB) return env.OPENCODE_DB
  const dataDir = opts.dataDir ?? opencodeDataDir(env)
  return path.join(dataDir, "opencode.db")
}

// ---------------------------------------------------------------------------
// Pure mapper: OpenCode interchange -> PortableSession. Shared by both paths so
// the SQLite fallback is guaranteed equivalent to the export path (AC-2).
// ---------------------------------------------------------------------------

function textOfParts(parts: OcPart[]): string {
  return (parts ?? [])
    .filter((p) => p && p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n\n")
    .trim()
}

/** Map an OpenCode export object into the Hub IR. Ends with PortableSession.parse(). */
export function toPortableSession(exp: OcExport, sourcePath: string): PS {
  const info = exp.info
  const turns: PortableTurn[] = []
  let droppedTurns = 0

  for (const m of exp.messages ?? []) {
    const role: PortableTurn["role"] = m.info?.role === "assistant" ? "assistant" : "user"
    const text = textOfParts(m.parts)
    // A message whose parts are all tool/reasoning/file/step (or empty) carries
    // no rendered text -> it is a dropped turn (v1 fidelity, HUB-IR rule 3).
    if (!text) {
      droppedTurns++
      continue
    }
    const turn: PortableTurn = { role, text }
    const ts = m.info?.time?.created
    if (typeof ts === "number") turn.timestamp = ts
    const model = m.info?.model?.modelID ?? m.info?.modelID ?? undefined
    if (role === "assistant" && typeof model === "string" && model) turn.model = model
    turns.push(turn)
  }

  const session: PS = {
    schemaVersion: "1.0.0",
    sourceHarness: HARNESS,
    sourceSessionId: info.id,
    sourcePath,
    cwd: info.directory ?? "",
    title: info.title ?? info.id,
    turns,
    droppedTurns,
    sourceMetadata: {
      model: info.model,
      tokens: info.tokens,
      cost: info.cost,
      version: info.version,
      projectID: info.projectID,
    },
  }
  const created = info.time?.created
  const updated = info.time?.updated
  if (typeof created === "number") session.createdAt = created
  if (typeof updated === "number") session.updatedAt = updated

  return PortableSession.parse(session)
}

// ---------------------------------------------------------------------------
// Primary path: `opencode export <id>`.
// ---------------------------------------------------------------------------

function cliAvailable(): boolean {
  return !!Bun.which("opencode")
}

async function runExportCli(
  sessionId: string,
  env: Record<string, string | undefined> = process.env,
): Promise<OcExport | null> {
  try {
    // Async `Bun.spawn`, NOT `Bun.spawnSync`. spawnSync blocks the single JS
    // thread for the full CLI boot (~0.5s per session). Called once per session
    // by parse(), it silently defeated the orchestrator's import worker pool
    // (the "concurrent" workers ran serially, each frozen on the sync spawn) and
    // — fatally for the TUI — pinned the event loop for the entire batch, so
    // opentui's render/input loop could not repaint or respond. On a real store
    // (149 sessions x ~0.5s ≈ 80s) that presented as a total UI freeze the
    // moment the OpenCode source tab was selected. Async spawn yields to the
    // event loop, restoring both real pool concurrency and a responsive UI.
    const proc = Bun.spawn(["opencode", "export", sessionId], {
      // Force the installed app DB, sidestepping the channel-db landmine.
      env: { ...env, OPENCODE_DISABLE_CHANNEL_DB: "1" },
      stdout: "pipe",
      stderr: "ignore",
    })
    const out = (await new Response(proc.stdout).text()).trim()
    const exitCode = await proc.exited
    if (exitCode !== 0) return null
    if (!out) return null
    const parsed = JSON.parse(out) as OcExport
    return parsed && parsed.info ? parsed : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Fallback path: read-only V1 `message` + `part` tables.
// ---------------------------------------------------------------------------

/**
 * Tolerant JSON parse for `message`/`part` row blobs. A malformed blob is
 * skipped (never thrown — one bad row shouldn't sink the whole session), but
 * now logs a reason (AC7) instead of silently swallowing the error. `context`
 * identifies which row failed (e.g. "message ses_x/msg_y") for the log line.
 */
function safeJson(raw: unknown, context?: string): any {
  if (typeof raw !== "string") return {}
  try {
    return JSON.parse(raw)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`opencode import: skipping malformed row${context ? ` (${context})` : ""}: ${reason}`)
    return {}
  }
}

function openReadOnly(dbPath: string): Database {
  // readonly guarantees the import path can never mutate the store (AC-5).
  return new Database(dbPath, { readonly: true })
}

/** Read one session's V1 rows into the OpenCode interchange shape (read-only). */
export function readSessionFromDb(dbPath: string, sessionId: string): OcExport {
  const db = openReadOnly(dbPath)
  try {
    const s = db
      .query(
        "SELECT id, directory, title, version, project_id, cost, tokens_input, tokens_output, tokens_reasoning, time_created, time_updated FROM session WHERE id = ?",
      )
      .get(sessionId) as any
    if (!s) throw new Error(`opencode session not found: ${sessionId}`)

    const msgRows = db
      .query(
        "SELECT id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC, id ASC",
      )
      .all(sessionId) as any[]
    const partStmt = db.query(
      "SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC, id ASC",
    )

    const messages: OcMessage[] = msgRows.map((row) => {
      const data = safeJson(row.data, `message ${sessionId}/${row.id}`)
      const parts = (partStmt.all(row.id) as any[]).map((p) => safeJson(p.data, `part of message ${row.id}`) as OcPart)
      return {
        info: {
          id: row.id,
          role: data.role,
          time: { created: row.time_created ?? data.time?.created },
          model: data.model ?? undefined,
          modelID: data.modelID ?? undefined,
          providerID: data.providerID ?? undefined,
        },
        parts,
      }
    })

    const info: OcSessionInfo = {
      id: s.id,
      directory: s.directory,
      title: s.title,
      version: s.version,
      projectID: s.project_id,
      cost: s.cost,
      tokens: { input: s.tokens_input, output: s.tokens_output, reasoning: s.tokens_reasoning },
      time: { created: s.time_created ?? undefined, updated: s.time_updated ?? undefined },
    }
    return { info, messages }
  } finally {
    db.close()
  }
}

// ---------------------------------------------------------------------------
// The adapter.
// ---------------------------------------------------------------------------

export const opencodeImport: ImportAdapter = {
  harness: HARNESS,

  async detect(): Promise<boolean> {
    if (cliAvailable()) return true
    try {
      return fs.readdirSync(opencodeDataDir()).some((f) => /^opencode.*\.db$/.test(f))
    } catch {
      return false
    }
  },

  async discover(): Promise<SessionRef[]> {
    const dbPath = resolveOpencodeDbPath()
    if (!fs.existsSync(dbPath)) return []
    const db = openReadOnly(dbPath)
    try {
      const rows = db
        .query("SELECT id, title, directory, time_updated FROM session ORDER BY time_updated DESC")
        .all() as any[]
      return rows.map((r) => {
        const ref: SessionRef = {
          harness: HARNESS,
          sourceSessionId: r.id,
          sourcePath: dbPath,
          title: r.title ?? r.id,
        }
        if (typeof r.time_updated === "number") ref.updatedAt = r.time_updated
        return ref
      })
    } finally {
      db.close()
    }
  },

  async parse(ref: SessionRef): Promise<PS> {
    const sessionId = ref.sourceSessionId
    const sourcePath = ref.sourcePath || `opencode://${sessionId}`

    // Primary: native export JSON.
    if (cliAvailable()) {
      const exp = await runExportCli(sessionId)
      if (exp) return toPortableSession(exp, sourcePath)
    }

    // Fallback: read-only SQLite.
    const dbPath = resolveOpencodeDbPath()
    const exp = readSessionFromDb(dbPath, sessionId)
    return toPortableSession(exp, sourcePath)
  },
}
