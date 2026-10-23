// Regression coverage for the 2026-07-01 sidebar-visibility fix: Codex's
// desktop/IDE sidebar reads from a `threads` table in
// `<CODEX_HOME>/state_5.sqlite`, not by scanning the rollout files codex/export.ts
// writes. These tests prove codexExport.write() actually indexes there (and
// teardown() un-indexes), and that a missing/mismatched schema degrades to a
// silent no-op rather than ever failing the (load-bearing) rollout write.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { Database } from "bun:sqlite"

import { PortableSession } from "../../src/ir"
import { codexExport, configureCodexExport, resetCodexExportConfig } from "../../src/adapters/codex/export"

const T0 = Date.parse("2025-06-15T12:34:56.000Z")

function sampleSession(overrides: Partial<PortableSession> = {}): PortableSession {
  return PortableSession.parse({
    schemaVersion: "1.0.0",
    sourceHarness: "claude-code",
    sourceSessionId: "src-session-123",
    sourcePath: "/tmp/source.jsonl",
    cwd: "/home/user/project",
    title: "[claude-code] hello codex",
    createdAt: T0,
    updatedAt: T0,
    turns: [
      { role: "user", text: "hello codex, can you help me debug this?", timestamp: T0 },
      { role: "assistant", text: "sure, what's broken", timestamp: T0 + 1000 },
    ],
    droppedTurns: 0,
    sourceMetadata: { model_provider: "openai" },
    ...overrides,
  })
}

/** A minimal `threads` table matching the real, reverse-engineered schema —
 *  just the columns thread-index.ts actually depends on. */
function createThreadsDb(file: string): void {
  const db = new Database(file, { create: true })
  db.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      rollout_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      model_provider TEXT NOT NULL,
      cwd TEXT NOT NULL,
      title TEXT NOT NULL,
      sandbox_policy TEXT NOT NULL,
      approval_mode TEXT NOT NULL,
      cli_version TEXT NOT NULL DEFAULT '',
      first_user_message TEXT NOT NULL DEFAULT '',
      preview TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      thread_source TEXT
    )
  `)
  db.close()
}

function readThreadRow(file: string, id: string): Record<string, unknown> | null {
  const db = new Database(file, { readonly: true })
  try {
    return db.query("SELECT * FROM threads WHERE id = $id").get({ $id: id }) as Record<string, unknown> | null
  } finally {
    db.close()
  }
}

let home: string

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-home-"))
  fs.mkdirSync(path.join(home, "sessions"), { recursive: true })
  configureCodexExport({ codexHome: home, mode: "rollout", appendHistory: false })
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
  resetCodexExportConfig()
})

describe("codexExport.write indexes the session into threads (sidebar visibility)", () => {
  test("no state_5.sqlite present -> write() still succeeds (no-op indexing)", async () => {
    const result = await codexExport.write(sampleSession())
    expect(result.skipped).toBe(false)
    expect(fs.existsSync(path.join(home, "state_5.sqlite"))).toBe(false)
  })

  test("state_5.sqlite present -> a matching, non-empty-preview row is inserted", async () => {
    const dbFile = path.join(home, "state_5.sqlite")
    createThreadsDb(dbFile)

    const result = await codexExport.write(sampleSession())

    const row = readThreadRow(dbFile, result.destSessionId!)
    expect(row).not.toBeNull()
    expect(row!.rollout_path).toContain(result.destSessionId)
    expect(row!.cwd).toBe("/home/user/project")
    expect(row!.title).toBe("[claude-code] hello codex")
    expect(row!.archived).toBe(0)
    // The real schema's partial indexes filter on `preview <> ''` — an empty
    // preview means the sidebar's own query likely excludes the row, so this
    // must never be blank when there's a user turn to draw it from.
    expect(row!.preview).not.toBe("")
    expect(String(row!.preview)).toContain("hello codex")
  })

  test("continuation (existingDestId) updates the row in place instead of erroring on the PK", async () => {
    const dbFile = path.join(home, "state_5.sqlite")
    createThreadsDb(dbFile)

    const first = await codexExport.write(sampleSession())
    const grown = sampleSession({
      turns: [
        ...sampleSession().turns,
        { role: "user", text: "one more turn", timestamp: T0 + 5000 },
      ],
      title: "[claude-code] hello codex (continued)",
    })
    const second = await codexExport.write(grown, { existingDestId: first.destSessionId })

    expect(second.destSessionId).toBe(first.destSessionId)
    const row = readThreadRow(dbFile, first.destSessionId!)
    expect(row!.title).toBe("[claude-code] hello codex (continued)")

    const db = new Database(dbFile, { readonly: true })
    const count = db.query("SELECT COUNT(*) as n FROM threads").get() as { n: number }
    db.close()
    expect(count.n).toBe(1)
  })

  test("schema drift (missing expected column) degrades to a silent no-op, never fails the export", async () => {
    const dbFile = path.join(home, "state_5.sqlite")
    const db = new Database(dbFile, { create: true })
    // A `threads` table that exists but is missing columns this module needs
    // (simulates a future Codex version changing its schema).
    db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY)")
    db.close()

    const result = await codexExport.write(sampleSession())
    expect(result.skipped).toBe(false)
    expect(fs.existsSync(path.join(home, "sessions"))).toBe(true)
    // No throw, and no partial/garbage row inserted into the mismatched table.
    const check = new Database(dbFile, { readonly: true })
    const count = check.query("SELECT COUNT(*) as n FROM threads").get() as { n: number }
    check.close()
    expect(count.n).toBe(0)
  })

  test("teardown() removes the indexed row", async () => {
    const dbFile = path.join(home, "state_5.sqlite")
    createThreadsDb(dbFile)

    const result = await codexExport.write(sampleSession())
    expect(readThreadRow(dbFile, result.destSessionId!)).not.toBeNull()

    await codexExport.teardown(sampleSession().sourceSessionId)
    expect(readThreadRow(dbFile, result.destSessionId!)).toBeNull()
  })

  test("a session with no user turns gets an empty preview but still writes without throwing", async () => {
    const dbFile = path.join(home, "state_5.sqlite")
    createThreadsDb(dbFile)

    const result = await codexExport.write(
      sampleSession({ turns: [{ role: "assistant", text: "no user turn here", timestamp: T0 }] }),
    )
    const row = readThreadRow(dbFile, result.destSessionId!)
    expect(row).not.toBeNull()
    expect(row!.preview).toBe("")
  })
})
