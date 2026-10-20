// Best-effort indexing of an exported session into Codex's own `threads`
// table (`<codexHome>/state_5.sqlite`).
//
// Finding (2026-07-01, real-machine investigation): Codex's desktop/IDE
// sidebar does NOT populate itself by scanning `<codexHome>/sessions/**`.
// It reads from this sqlite table, which Codex's own app maintains as an
// index over the rollout files it writes. A rollout file with no matching
// `threads` row is completely invisible in the sidebar no matter how many
// times Codex is restarted — confirmed by cross-referencing a real
// `external_agent_session_imports.json` (Codex's OWN dedup ledger for its
// native "import a Claude Code session" feature) 1:1 against this table:
// every entry in that ledger has a matching `threads` row, and a rollout we
// wrote WITHOUT one never appeared.
//
// This schema is undocumented and reverse-engineered from one real Codex
// install — it is not a supported integration surface and could change
// without notice on a Codex upgrade. Treat every write here as optional:
// the rollout file (codex/export.ts's real, load-bearing write) must always
// succeed and must never be blocked, slowed meaningfully, or rolled back by
// anything in this module. Every entry point below swallows its own errors.
//
// The partial indexes `idx_threads_visible_*_ms ... WHERE preview <> ''`
// are the load-bearing detail: a row with an empty `preview` is excluded
// from what those indexes cover, which is a strong signal the sidebar's own
// query filters on `preview <> ''`. A session with no user turns (so no
// preview text) will still get its row written, but may not surface in the
// sidebar the same way — matches Codex's own behavior (v1 gap, not fixable
// without knowing the sidebar's exact query).

import fs from "fs"
import path from "path"
import { Database } from "bun:sqlite"
import type { PortableSession } from "../../ir"

const DB_FILENAME = "state_5.sqlite"
const REQUIRED_COLUMNS = [
  "id",
  "rollout_path",
  "created_at",
  "updated_at",
  "source",
  "model_provider",
  "cwd",
  "title",
  "sandbox_policy",
  "approval_mode",
  "first_user_message",
  "preview",
  "archived",
] as const

function dbPath(codexHome: string): string {
  return path.join(codexHome, DB_FILENAME)
}

/** Truncate to a sane preview length — real Codex-authored previews are short. */
function previewOf(session: PortableSession, max = 300): string {
  const firstUser = session.turns.find((t) => t.role === "user")?.text ?? ""
  const flattened = firstUser.replace(/\s+/g, " ").trim()
  return flattened.length > max ? flattened.slice(0, max - 1) + "…" : flattened
}

/** Schema guard: only write if every column this module depends on still exists. */
function hasExpectedShape(db: InstanceType<typeof Database>): boolean {
  try {
    const cols = new Set(
      (db.query("PRAGMA table_info(threads)").all() as Array<{ name: string }>).map((c) => c.name),
    )
    return REQUIRED_COLUMNS.every((c) => cols.has(c))
  } catch {
    return false
  }
}

/**
 * Insert (or, on a continuation re-export, update) this session's row.
 * Never throws — a failure here means the session just won't surface in the
 * sidebar yet, not that the export itself failed.
 */
export function indexThreadBestEffort(
  codexHome: string,
  session: PortableSession,
  sessionId: string,
  rolloutPath: string,
  epochMs: number,
): void {
  const file = dbPath(codexHome)
  if (!fs.existsSync(file)) return

  let db: InstanceType<typeof Database> | undefined
  try {
    db = new Database(file)
    db.exec("PRAGMA busy_timeout = 2000") // tolerate a brief lock if Codex is running
    if (!hasExpectedShape(db)) return

    const createdAtSec = Math.floor((session.createdAt ?? epochMs) / 1000)
    const updatedAtSec = Math.floor((session.updatedAt ?? epochMs) / 1000)
    const preview = previewOf(session)

    db.query(
      `INSERT INTO threads
         (id, rollout_path, created_at, updated_at, source, model_provider, cwd,
          title, sandbox_policy, approval_mode, cli_version, first_user_message,
          preview, thread_source)
       VALUES
         ($id, $rolloutPath, $createdAt, $updatedAt, 'cli', $modelProvider, $cwd,
          $title, $sandboxPolicy, $approvalMode, $cliVersion, $firstUserMessage,
          $preview, 'user')
       ON CONFLICT(id) DO UPDATE SET
         rollout_path = excluded.rollout_path,
         updated_at = excluded.updated_at,
         title = excluded.title,
         first_user_message = excluded.first_user_message,
         preview = excluded.preview`,
    ).run({
      $id: sessionId,
      $rolloutPath: rolloutPath,
      $createdAt: createdAtSec,
      $updatedAt: updatedAtSec,
      $modelProvider:
        (typeof session.sourceMetadata?.model_provider === "string" && session.sourceMetadata.model_provider) ||
        "openai",
      $cwd: session.cwd,
      $title: session.title,
      $sandboxPolicy: JSON.stringify({ type: "read-only" }),
      $approvalMode: "on-request",
      $cliVersion: "hello-sessions",
      $firstUserMessage: preview,
      $preview: preview,
    })
  } catch {
    // Best-effort only — see module header. Schema drift, a locked DB, or a
    // missing table must never surface as an export failure.
  } finally {
    db?.close()
  }
}

/**
 * True iff a `threads` row for `sessionId` exists — the "did it land in the
 * sidebar index" check the desktop deep link gates on (a `codex://threads/<id>`
 * link only resolves if the app can find the thread). Never throws; a missing
 * DB, schema drift, or lock reads as "not indexed" so the deep link stays quiet.
 */
export function threadRowExists(codexHome: string, sessionId: string): boolean {
  const file = dbPath(codexHome)
  if (!fs.existsSync(file)) return false
  let db: InstanceType<typeof Database> | undefined
  try {
    db = new Database(file)
    db.exec("PRAGMA busy_timeout = 2000")
    if (!hasExpectedShape(db)) return false
    const row = db.query("SELECT 1 FROM threads WHERE id = $id LIMIT 1").get({ $id: sessionId })
    return row != null
  } catch {
    return false
  } finally {
    db?.close()
  }
}

/** Mirror of indexThreadBestEffort for teardown() — removes the row so an
 *  uninstalled session doesn't leave a dangling sidebar entry pointing at a
 *  deleted rollout file. Never throws. */
export function unindexThreadBestEffort(codexHome: string, sessionId: string): void {
  const file = dbPath(codexHome)
  if (!fs.existsSync(file)) return

  let db: InstanceType<typeof Database> | undefined
  try {
    db = new Database(file)
    db.exec("PRAGMA busy_timeout = 2000")
    if (!hasExpectedShape(db)) return
    db.query("DELETE FROM threads WHERE id = $id").run({ $id: sessionId })
  } catch {
    // Best-effort only.
  } finally {
    db?.close()
  }
}
