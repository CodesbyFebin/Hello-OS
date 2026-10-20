import { test, expect, describe, afterAll } from "bun:test"
import { Database } from "bun:sqlite"
import fs from "fs"
import os from "os"
import path from "path"

import { PortableSession } from "../../src/ir"
import {
  opencodeImport,
  toPortableSession,
  resolveOpencodeDbPath,
  opencodeDataDir,
  readSessionFromDb,
  type OcExport,
} from "../../src/adapters/opencode/import"
import { registerImport, getImport, _resetRegistry } from "../../src/registry"

const fixturePath = new URL("../fixtures/opencode-sample.json", import.meta.url)
const fixture = (await Bun.file(fixturePath).json()) as OcExport

// ---------------------------------------------------------------------------
// AC-1: export JSON -> PortableSession, passing PortableSession.parse().
// ---------------------------------------------------------------------------

describe("AC-1 export JSON mapping", () => {
  test("maps a committed opencode-export fixture into a valid PortableSession", () => {
    const s = toPortableSession(fixture, "opencode://ses_testfixture0001")
    // toPortableSession runs PortableSession.parse() internally; re-validate to be explicit.
    expect(() => PortableSession.parse(s)).not.toThrow()
    expect(s.sourceHarness).toBe("opencode")
    expect(s.sourceSessionId).toBe("ses_testfixture0001") // = info.id
    expect(s.cwd).toBe("/Users/x/proj") // = info.directory
    expect(s.title).toBe("Test session") // = info.title
    expect(s.createdAt).toBe(1782155266916) // = info.time.created
    expect(s.updatedAt).toBe(1782155267999) // = info.time.updated
  })

  test("turns come from user text + assistant TextPart text, in order", () => {
    const s = toPortableSession(fixture, "opencode://x")
    expect(s.turns.map((t) => t.role)).toEqual(["user", "assistant", "user"])
    expect(s.turns.map((t) => t.text)).toEqual([
      "hello, please help",
      "sure, here is the answer",
      "now run the tool",
    ])
    expect(s.turns[0]!.timestamp).toBe(1782155267072)
  })

  test("sourceMetadata carries {model, tokens, cost, version, projectID}", () => {
    const s = toPortableSession(fixture, "opencode://x")
    expect(s.sourceMetadata.projectID).toBe("global")
    expect(s.sourceMetadata.version).toBe("1.0.0")
    expect(s.sourceMetadata.cost).toBe(0.0123)
    expect(s.sourceMetadata.model).toEqual({ id: "gpt-5.5", providerID: "openai", variant: "default" })
    expect((s.sourceMetadata.tokens as any).input).toBe(12)
  })

  test("assistant turns carry model provenance; user turns do not", () => {
    const s = toPortableSession(fixture, "opencode://x")
    expect(s.turns[1]!.model).toBe("gpt-5.5") // assistant
    expect(s.turns[0]!.model).toBeUndefined() // user
  })
})

// ---------------------------------------------------------------------------
// AC-3: only TextPart / user-text turns stored; tool/reasoning/file -> dropped.
// Also the HUB-IR invariant: turns.length + droppedTurns == raw turns.
// ---------------------------------------------------------------------------

describe("AC-3 part-type drop counting", () => {
  test("a message with only tool/reasoning/file parts becomes a dropped turn", () => {
    const s = toPortableSession(fixture, "opencode://x")
    // msg_a2 (tool+reasoning+file, no text) and msg_a3 (whitespace-only text) drop.
    expect(s.droppedTurns).toBe(2)
    expect(s.turns).toHaveLength(3)
  })

  test("invariant: turns.length + droppedTurns === message count", () => {
    const s = toPortableSession(fixture, "opencode://x")
    expect(s.turns.length + s.droppedTurns).toBe(fixture.messages.length)
  })

  test("no tool/reasoning/file text leaks into stored turns", () => {
    const s = toPortableSession(fixture, "opencode://x")
    const joined = s.turns.map((t) => t.text).join("\n")
    expect(joined).not.toContain("think about this internally") // reasoning
    expect(joined).not.toContain("planning the tool call") // reasoning
    expect(joined).not.toContain("out.txt") // file
  })

  test("whitespace-only text part does not produce a stored turn", () => {
    const oneWhitespace: OcExport = {
      info: { id: "ses_ws", directory: "/tmp", title: "ws", time: { created: 1 } },
      messages: [
        { info: { id: "m", role: "assistant", time: { created: 1 } }, parts: [{ type: "text", text: "   " }] },
      ],
    }
    const s = toPortableSession(oneWhitespace, "opencode://ws")
    expect(s.turns).toHaveLength(0)
    expect(s.droppedTurns).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// AC-4: DB path resolution picks opencode.db (not opencode-local.db); honors OPENCODE_DB.
// ---------------------------------------------------------------------------

describe("AC-4 DB path resolution (channel landmine)", () => {
  test("defaults to opencode.db, never opencode-local.db", () => {
    const p = resolveOpencodeDbPath({ env: {}, dataDir: "/data/opencode" })
    expect(p).toBe("/data/opencode/opencode.db")
    expect(p).not.toContain("opencode-local.db")
  })

  test("OPENCODE_DB override wins", () => {
    const p = resolveOpencodeDbPath({ env: { OPENCODE_DB: "/custom/my.db" }, dataDir: "/data/opencode" })
    expect(p).toBe("/custom/my.db")
  })

  test("respects XDG_DATA_HOME for the data dir", () => {
    expect(opencodeDataDir({ XDG_DATA_HOME: "/xdg" })).toBe("/xdg/opencode")
    expect(resolveOpencodeDbPath({ env: { XDG_DATA_HOME: "/xdg" } })).toBe("/xdg/opencode/opencode.db")
  })
})

// ---------------------------------------------------------------------------
// AC-2 + AC-5: SQLite fallback parity with the export path, opened READ-ONLY.
// Uses a self-contained temp DB mirroring the fixture's conversational content.
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-import-test-"))
const tmpDb = path.join(tmpDir, "opencode.db")

function seedTempDb(dbPath: string) {
  const db = new Database(dbPath, { create: true })
  db.run(`CREATE TABLE session (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, directory TEXT NOT NULL,
    title TEXT NOT NULL, version TEXT NOT NULL, cost REAL DEFAULT 0 NOT NULL,
    tokens_input INTEGER DEFAULT 0 NOT NULL, tokens_output INTEGER DEFAULT 0 NOT NULL,
    tokens_reasoning INTEGER DEFAULT 0 NOT NULL, time_created INTEGER, time_updated INTEGER)`)
  db.run(`CREATE TABLE message (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)`)
  db.run(`CREATE TABLE part (
    id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)`)

  const sid = "ses_testfixture0001"
  db.run(
    "INSERT INTO session VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [sid, "global", "/Users/x/proj", "Test session", "1.0.0", 0.0123, 12, 34, 5, 1782155266916, 1782155267999],
  )

  const insMsg = db.query("INSERT INTO message VALUES (?,?,?,?,?)")
  const insPart = db.query("INSERT INTO part VALUES (?,?,?,?,?,?)")
  fixture.messages.forEach((m, mi) => {
    const mid = m.info.id!
    const created = m.info.time?.created ?? mi
    const mdata: any = { role: m.info.role, time: { created } }
    if (m.info.model) mdata.model = m.info.model
    insMsg.run(mid, sid, created, created, JSON.stringify(mdata))
    m.parts.forEach((p, pi) => {
      insPart.run(`${mid}_p${pi}`, mid, sid, created + pi, created + pi, JSON.stringify(p))
    })
  })
  db.close()
}

seedTempDb(tmpDb)

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("AC-2 SQLite fallback parity", () => {
  test("readSessionFromDb -> toPortableSession matches the export-path result", () => {
    const fromExport = toPortableSession(fixture, tmpDb)
    const fromDb = toPortableSession(readSessionFromDb(tmpDb, "ses_testfixture0001"), tmpDb)

    // Conversational content must be identical across the two paths.
    expect(fromDb.turns).toEqual(fromExport.turns)
    expect(fromDb.droppedTurns).toBe(fromExport.droppedTurns)
    expect(fromDb.sourceSessionId).toBe(fromExport.sourceSessionId)
    expect(fromDb.cwd).toBe(fromExport.cwd)
    expect(fromDb.title).toBe(fromExport.title)
    expect(fromDb.createdAt).toBe(fromExport.createdAt)
    expect(fromDb.updatedAt).toBe(fromExport.updatedAt)
    expect(fromDb.sourceMetadata.projectID).toBe(fromExport.sourceMetadata.projectID)
    expect(fromDb.sourceMetadata.version).toBe(fromExport.sourceMetadata.version)
  })

  test("discover-like read: session is enumerable from the DB", () => {
    const db = new Database(tmpDb, { readonly: true })
    const row = db.query("SELECT id, title FROM session ORDER BY time_updated DESC").get() as any
    db.close()
    expect(row.id).toBe("ses_testfixture0001")
  })
})

describe("AC-5 import path never mutates the DB (read-only)", () => {
  test("a read-only handle rejects writes", () => {
    const ro = new Database(tmpDb, { readonly: true })
    expect(() => ro.run("INSERT INTO session VALUES ('x','p','/d','t','v',0,0,0,0,0,0)")).toThrow()
    ro.close()
  })

  test("readSessionFromDb leaves the DB file byte-identical", () => {
    const before = fs.readFileSync(tmpDb)
    readSessionFromDb(tmpDb, "ses_testfixture0001")
    const after = fs.readFileSync(tmpDb)
    expect(Buffer.compare(before, after)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AC-6: registered as the `opencode` import adapter.
// (We cannot edit src/registry.ts here; we prove the adapter is registerable.)
// ---------------------------------------------------------------------------

describe("AC-6 registration", () => {
  test("opencodeImport conforms to the ImportAdapter shape", () => {
    expect(opencodeImport.harness).toBe("opencode")
    expect(typeof opencodeImport.detect).toBe("function")
    expect(typeof opencodeImport.discover).toBe("function")
    expect(typeof opencodeImport.parse).toBe("function")
  })

  test("registerImport(opencodeImport) is retrievable via getImport('opencode')", () => {
    _resetRegistry()
    registerImport(opencodeImport)
    expect(getImport("opencode")).toBe(opencodeImport)
    _resetRegistry()
  })
})

// ---------------------------------------------------------------------------
// Integration (best-effort): if the real opencode CLI + DB are present, assert
// the CLI export path and the SQLite fallback agree on turn text for one session.
// Skipped automatically when unavailable so the suite stays deterministic.
// ---------------------------------------------------------------------------

describe("integration: real opencode CLI/DB parity (best-effort)", () => {
  const cli = Bun.which("opencode")
  const realDb = resolveOpencodeDbPath()
  const hasReal = !!cli && fs.existsSync(realDb)

  test.skipIf(!hasReal)("CLI export and DB fallback produce the same turns for a real session", () => {
    const db = new Database(realDb, { readonly: true })
    const row = db
      .query("SELECT id FROM session WHERE (SELECT COUNT(*) FROM message WHERE session_id = session.id) > 0 ORDER BY time_updated DESC")
      .get() as any
    db.close()
    if (!row) return // no populated session; nothing to compare

    const sid = row.id as string
    const proc = Bun.spawnSync(["opencode", "export", sid], {
      env: { ...process.env, OPENCODE_DISABLE_CHANNEL_DB: "1" },
      stdout: "pipe",
      stderr: "pipe",
    })
    if (!proc.success) return
    const exp = JSON.parse(proc.stdout.toString()) as OcExport

    const fromCli = toPortableSession(exp, `opencode://${sid}`)
    const fromDb = toPortableSession(readSessionFromDb(realDb, sid), `opencode://${sid}`)

    expect(fromDb.turns.map((t) => t.text)).toEqual(fromCli.turns.map((t) => t.text))
    expect(fromDb.turns.map((t) => t.role)).toEqual(fromCli.turns.map((t) => t.role))
    expect(fromDb.droppedTurns).toBe(fromCli.droppedTurns)
  })

  // Regression (UI-freeze): parse() shells out to `opencode export`, which takes
  // ~0.5s of CLI boot per session. It MUST not block the JS thread while doing
  // so — a synchronous `Bun.spawnSync` would pin the event loop for the whole
  // import batch and freeze the TUI. Proof: a timer scheduled every 10ms must
  // still fire while a single parse() is in flight. With the old spawnSync it
  // fired exactly zero times; with async spawn it fires many.
  test.skipIf(!hasReal)("parse() does not block the event loop (async spawn, not spawnSync)", async () => {
    const db = new Database(realDb, { readonly: true })
    const row = db
      .query("SELECT id FROM session WHERE (SELECT COUNT(*) FROM message WHERE session_id = session.id) > 0 ORDER BY time_updated DESC")
      .get() as any
    db.close()
    if (!row) return // no populated session; nothing to import

    const ref = { harness: "opencode" as const, sourceSessionId: row.id as string, sourcePath: realDb, title: "t" }

    let ticks = 0
    const interval = setInterval(() => ticks++, 10)
    try {
      const session = await opencodeImport.parse(ref)
      expect(session.sourceSessionId).toBe(row.id)
    } finally {
      clearInterval(interval)
    }
    // spawnSync starves the timer -> 0 ticks. Async spawn yields -> many.
    expect(ticks).toBeGreaterThan(0)
  })
})
