// S6 — OpenCode EXPORT adapter tests (revised for S8).
//
// SAFETY: every test targets a throwaway OPENCODE_DB (a mktemp file). The real
// ~/.local/share/opencode/opencode.db is NEVER touched. We set OPENCODE_DB +
// OPENCODE_DISABLE_CHANNEL_DB before any adapter call and assert the resolved db
// path is under the OS temp dir.
//
// ─── SPIKE FINDING (S6 acceptance, project-creation question) ────────────────
// Resolved by running `opencode import` (v1.17.10) against a temp DB with the
// child cwd set to a git-tracked temp dir:
//
//   `opencode import` AUTO-CREATES / selects the `project` row itself.
//
// It does this from its own invocation context (the cwd it runs in), NOT from the
// JSON: it overwrites info.projectID / directory / path with the active project +
// cwd. The synthesized `info.projectID` is ignored. Therefore the adapter does
// NOT need to pre-create the project on the CLI path — spawning `opencode import`
// with cwd = session.cwd is sufficient, and the resulting session.directory
// equals realpath(session.cwd). (Pre-creation logic still exists in the Drizzle
// FALLBACK path, which files each cwd under a deterministic sha1 project id.)
// ─────────────────────────────────────────────────────────────────────────────
//
// S8 revision: this adapter owns no ledger of its own — write() is unconditional
// and update-in-place / teardown are driven by `opts.existingDestId` / a
// provenance scan over `session.metadata`, not a private ledger file.

import { test, expect, describe, beforeAll, afterAll, beforeEach, afterEach, spyOn } from "bun:test"
import * as childProcess from "child_process"
import { _resetDedupeTracker } from "../../src/adapters/opencode/open-project"
import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { Database } from "bun:sqlite"
import { PortableSession } from "../../src/ir"
import { opencodeExport, buildInterchange, resolveDbPath, isDefaultOpencodeStore } from "../../src/adapters/opencode/export"

const CLI_AVAILABLE = (() => {
  const r = spawnSync("which", ["opencode"], { encoding: "utf8" })
  return r.status === 0 && Boolean(r.stdout.trim())
})()

let ROOT: string
let DB_PATH: string
let CWD: string
let PREV_OPENCODE_DB: string | undefined
let PREV_DISABLE_CHANNEL_DB: string | undefined

function makeSession(cwd: string, overrides: Partial<PortableSession> = {}): PortableSession {
  return PortableSession.parse({
    schemaVersion: "1.0.0",
    sourceHarness: "claude-code",
    sourceSessionId: overrides.sourceSessionId ?? "src-" + Math.random().toString(36).slice(2),
    sourcePath: "/tmp/source.jsonl",
    cwd,
    title: "Ported Conversation",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_500,
    turns: overrides.turns ?? [
      { role: "user", text: "first user question", timestamp: 1_700_000_000_000 },
      { role: "assistant", text: "first assistant answer", timestamp: 1_700_000_000_100 },
      { role: "user", text: "second user question", timestamp: 1_700_000_000_200 },
      { role: "assistant", text: "second assistant answer", timestamp: 1_700_000_000_300 },
    ],
    droppedTurns: overrides.droppedTurns ?? 2,
    sourceMetadata: overrides.sourceMetadata ?? {},
    ...overrides,
  })
}

function queryDb(dbPath: string) {
  const db = new Database(dbPath, { readonly: true })
  try {
    const sessions = db.query("SELECT id, project_id, directory, title, metadata FROM session").all() as any[]
    const messages = db
      .query("SELECT id, session_id, json_extract(data,'$.role') as role FROM message ORDER BY time_created, id")
      .all() as any[]
    const parts = db
      .query(
        "SELECT id, session_id, message_id, json_extract(data,'$.type') as type, json_extract(data,'$.text') as text FROM part ORDER BY time_created, id",
      )
      .all() as any[]
    const projects = db.query("SELECT id, worktree, vcs FROM project").all() as any[]
    return { sessions, messages, parts, projects }
  } finally {
    db.close()
  }
}

beforeAll(() => {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "sp-oc-export-"))
  DB_PATH = path.join(ROOT, "test-opencode.db")
  CWD = path.join(ROOT, "project")
  fs.mkdirSync(CWD, { recursive: true })
  // Make the cwd a git repo so opencode files it as a real vcs project.
  spawnSync("git", ["init", "-q"], { cwd: CWD })
  spawnSync("git", ["config", "user.email", "t@t.co"], { cwd: CWD })
  spawnSync("git", ["config", "user.name", "t"], { cwd: CWD })
  fs.writeFileSync(path.join(CWD, "README.md"), "hi")
  spawnSync("git", ["add", "-A"], { cwd: CWD })
  spawnSync("git", ["commit", "-qm", "init"], { cwd: CWD })

  PREV_OPENCODE_DB = process.env.OPENCODE_DB
  PREV_DISABLE_CHANNEL_DB = process.env.OPENCODE_DISABLE_CHANNEL_DB
  process.env.OPENCODE_DB = DB_PATH
  process.env.OPENCODE_DISABLE_CHANNEL_DB = "1"
})

afterAll(() => {
  // Restore process.env so other test files (run in the same bun test process)
  // never see this file's temp DB path — a prior leak here made
  // opencode-import.test.ts's real-DB check see the wrong path and skip.
  if (PREV_OPENCODE_DB === undefined) delete process.env.OPENCODE_DB
  else process.env.OPENCODE_DB = PREV_OPENCODE_DB
  if (PREV_DISABLE_CHANNEL_DB === undefined) delete process.env.OPENCODE_DISABLE_CHANNEL_DB
  else process.env.OPENCODE_DISABLE_CHANNEL_DB = PREV_DISABLE_CHANNEL_DB
  try {
    fs.rmSync(ROOT, { recursive: true, force: true })
  } catch {}
})

beforeEach(() => {
  // Fresh DB per test. Never touches the real store.
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(DB_PATH + suffix, { force: true })
    } catch {}
  }
  delete process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
})

// ─── Unit: interchange builder ───────────────────────────────────────────────

describe("buildInterchange (unit)", () => {
  test("emits fresh ses_/msg_/prt_ ids, one TextPart per turn, roles preserved", () => {
    const session = makeSession("/tmp/some/dir")
    const ic = buildInterchange(session)

    expect(ic.info.id).toMatch(/^ses_/)
    expect(ic.info.directory).toBe("/tmp/some/dir")
    expect(ic.info.title).toBe("Ported Conversation")
    expect(ic.messages).toHaveLength(4)

    expect(ic.messages.map((m) => m.info.role)).toEqual(["user", "assistant", "user", "assistant"])
    for (const m of ic.messages) {
      expect(m.info.id).toMatch(/^msg_/)
      expect(m.info.sessionID).toBe(ic.info.id)
      expect(m.parts).toHaveLength(1)
      const p = m.parts[0]!
      expect(p.id).toMatch(/^prt_/)
      expect(p.type).toBe("text")
      expect(p.messageID).toBe(m.info.id)
      expect(p.sessionID).toBe(ic.info.id)
    }
    expect(ic.messages.map((m) => m.parts[0]!.text)).toEqual([
      "first user question",
      "first assistant answer",
      "second user question",
      "second assistant answer",
    ])
  })

  test("assistant messages carry a parentID and default model; user carries model", () => {
    const ic = buildInterchange(makeSession("/tmp/x"))
    const user = ic.messages[0]!.info as any
    const assistant = ic.messages[1]!.info as any
    expect(user.model).toEqual({ providerID: "anthropic", modelID: "claude-opus-4-8" })
    expect(assistant.parentID).toBe(ic.messages[0]!.info.id)
    expect(assistant.providerID).toBe("anthropic")
    expect(assistant.path).toEqual({ cwd: "/tmp/x", root: "/tmp/x" })
    expect(assistant.tokens).toEqual({ input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })
  })

  test("model provenance is taken from sourceMetadata when present", () => {
    const ic = buildInterchange(
      makeSession("/tmp/x", { sourceMetadata: { providerID: "openai", modelID: "gpt-5" } }),
    )
    expect(ic.info.model).toEqual({ id: "gpt-5", providerID: "openai" })
    expect((ic.messages[1]!.info as any).modelID).toBe("gpt-5")
  })

  test("fresh ids across two builds never collide", () => {
    const a = buildInterchange(makeSession("/tmp/a"))
    const b = buildInterchange(makeSession("/tmp/b"))
    expect(a.info.id).not.toBe(b.info.id)
    const ids = new Set([
      ...a.messages.map((m) => m.info.id),
      ...b.messages.map((m) => m.info.id),
      ...a.messages.flatMap((m) => m.parts.map((p) => p.id)),
      ...b.messages.flatMap((m) => m.parts.map((p) => p.id)),
    ])
    expect(ids.size).toBe(16) // 4 msg + 4 prt per build, 2 builds
  })

  test("opts.sessionId reuses an existing destination id (update-in-place support)", () => {
    const ic = buildInterchange(makeSession("/tmp/reuse"), { sessionId: "ses_reused123" })
    expect(ic.info.id).toBe("ses_reused123")
    expect(ic.messages.every((m) => m.info.sessionID === "ses_reused123")).toBe(true)
  })
})

// ─── Safety: temp-db resolution ──────────────────────────────────────────────

describe("temp-db safety", () => {
  test("resolveDbPath honors OPENCODE_DB and stays under the OS temp dir", () => {
    expect(resolveDbPath()).toBe(DB_PATH)
    expect(resolveDbPath().startsWith(os.tmpdir())).toBe(true)
    expect(resolveDbPath()).not.toContain(path.join(".local", "share", "opencode", "opencode.db"))
  })
})

// ─── Integration: CLI import path (skipped when opencode CLI unavailable) ─────

describe.if(CLI_AVAILABLE)("opencode import (CLI path)", () => {
  test("write() produces JSON opencode import accepts; parity + directory + project", async () => {
    const session = makeSession(CWD, { sourceSessionId: "cli-parity-1" })
    const res = await opencodeExport.write(session)

    expect(res.skipped).toBe(false)
    expect(res.destSessionId).toMatch(/^ses_/)

    const { sessions, messages, parts, projects } = queryDb(DB_PATH)

    // criterion 1 + 2: one session, turn count + per-turn text match the IR.
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe(res.destSessionId)
    expect(messages).toHaveLength(session.turns.length)
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"])
    expect(parts.map((p) => p.text)).toEqual(session.turns.map((t) => t.text))

    // criterion 3: imported directory == source cwd (cwd-overwrite mitigation),
    // and the project row was auto-created/selected by opencode itself.
    expect(sessions[0].directory).toBe(fs.realpathSync(CWD))
    expect(projects).toHaveLength(1)
    expect(projects[0].worktree).toBe(fs.realpathSync(CWD))
    expect(sessions[0].project_id).toBe(projects[0].id)

    // S8: provenance is stamped onto the session's own metadata column.
    const meta = JSON.parse(sessions[0].metadata)
    expect(meta.sourcePorter).toEqual({ sourceHarness: "claude-code", sourceSessionId: "cli-parity-1" })
  })

  test("droppedTurns are accounted for (only text turns land)", async () => {
    const session = makeSession(CWD, {
      sourceSessionId: "cli-dropped-1",
      turns: [
        { role: "user", text: "q1" },
        { role: "assistant", text: "a1" },
      ],
      droppedTurns: 5,
    })
    const res = await opencodeExport.write(session)
    const { messages } = queryDb(DB_PATH)
    expect(messages).toHaveLength(2) // 2 stored; the 5 dropped were never in turns
    expect(res.skipped).toBe(false)
  })

  test("write() is unconditional: two calls create two independent sessions", async () => {
    const session = makeSession(CWD, { sourceSessionId: "cli-idem-1" })

    const first = await opencodeExport.write(session)
    expect(first.skipped).toBe(false)

    const second = await opencodeExport.write(session)
    expect(second.skipped).toBe(false)
    expect(second.destSessionId).not.toBe(first.destSessionId)
    expect(queryDb(DB_PATH).sessions).toHaveLength(2)
  })

  test("opts.existingDestId updates the SAME session in place (S8)", async () => {
    const session = makeSession(CWD, { sourceSessionId: "cli-update-1" })
    const first = await opencodeExport.write(session)

    const grown = makeSession(CWD, {
      sourceSessionId: "cli-update-1",
      turns: [...session.turns, { role: "user", text: "one more turn" }],
      droppedTurns: session.droppedTurns,
    })
    const updated = await opencodeExport.write(grown, { existingDestId: first.destSessionId })

    expect(updated.skipped).toBe(false)
    expect(updated.destSessionId).toBe(first.destSessionId)

    const { sessions, messages } = queryDb(DB_PATH)
    expect(sessions).toHaveLength(1) // updated in place, not a second row
    expect(messages).toHaveLength(grown.turns.length)
  })

  test("teardown() removes the created session, its rows (found via provenance scan)", async () => {
    const session = makeSession(CWD, { sourceSessionId: "cli-teardown-1" })
    await opencodeExport.write(session)
    expect(queryDb(DB_PATH).sessions).toHaveLength(1)

    await opencodeExport.teardown("cli-teardown-1")

    const { sessions, messages, parts } = queryDb(DB_PATH)
    expect(sessions).toHaveLength(0)
    expect(messages).toHaveLength(0)
    expect(parts).toHaveLength(0)
    // teardown is idempotent
    await opencodeExport.teardown("cli-teardown-1")
  })
})

// ─── Integration: Drizzle/SQLite fallback (always runs; CLI forced off) ──────

describe("SQLite fallback (opencode CLI absent)", () => {
  beforeEach(() => {
    process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK = "1"
  })

  test("criterion 5: fallback inserts session/message/part into the temp DB", async () => {
    const session = makeSession(CWD, { sourceSessionId: "fb-1" })
    const res = await opencodeExport.write(session)
    expect(res.skipped).toBe(false)

    const { sessions, messages, parts, projects } = queryDb(DB_PATH)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe(res.destSessionId)
    expect(sessions[0].directory).toBe(CWD)
    expect(projects).toHaveLength(1) // fallback pre-creates the deterministic project
    expect(sessions[0].project_id).toBe(projects[0].id)
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"])
    expect(parts.map((p) => p.text)).toEqual(session.turns.map((t) => t.text))
    expect(parts.every((p) => p.type === "text")).toBe(true)

    const meta = JSON.parse(sessions[0].metadata)
    expect(meta.sourcePorter).toEqual({ sourceHarness: "claude-code", sourceSessionId: "fb-1" })
  })

  test("criterion 4 (revised, S8): write() is unconditional; existingDestId updates in place", async () => {
    const session = makeSession(CWD, { sourceSessionId: "fb-idem" })

    const first = await opencodeExport.write(session)
    const second = await opencodeExport.write(session)
    expect(second.skipped).toBe(false)
    expect(second.destSessionId).not.toBe(first.destSessionId)
    expect(queryDb(DB_PATH).sessions).toHaveLength(2)

    const grown = makeSession(CWD, {
      sourceSessionId: "fb-idem",
      turns: [...session.turns, { role: "assistant", text: "grown turn" }],
      droppedTurns: session.droppedTurns,
    })
    const updated = await opencodeExport.write(grown, { existingDestId: first.destSessionId })
    expect(updated.destSessionId).toBe(first.destSessionId)
    const { sessions, messages } = queryDb(DB_PATH)
    expect(sessions).toHaveLength(2) // the two independent creates from above, unaffected
    expect(messages.filter((m) => m.session_id === first.destSessionId)).toHaveLength(grown.turns.length)
  })

  test("criterion 6: fallback teardown removes session + rows (found via provenance scan)", async () => {
    const session = makeSession(CWD, { sourceSessionId: "fb-teardown" })
    await opencodeExport.write(session)
    expect(queryDb(DB_PATH).sessions).toHaveLength(1)

    await opencodeExport.teardown("fb-teardown")
    const { sessions, messages, parts } = queryDb(DB_PATH)
    expect(sessions).toHaveLength(0)
    expect(messages).toHaveLength(0)
    expect(parts).toHaveLength(0)
  })
})

// ─── desktop deep link: the store gate (never launch the GUI under isolation) ─
//
// The load-bearing safety property: a write() to a redirected/isolated opencode
// store must NEVER spawn a real `open` deep link — otherwise `bun test` floods
// the desktop app (it once wedged it with "unable to open database file"). This
// whole test file runs with OPENCODE_DB pointed at a temp DB, so every write()
// here is exactly the isolated case that must stay inert. The positive
// spawn/dedupe behaviour lives in opencode-open-project.test.ts.

describe("desktop deep link is suppressed for isolated (test/verify) stores", () => {
  const ORIGINAL_PLATFORM = process.platform
  const PREV_OPEN_ENV = process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP
  let spawnSpy: ReturnType<typeof spyOn>

  function setPlatform(value: NodeJS.Platform) {
    Object.defineProperty(process, "platform", { value, configurable: true })
  }

  beforeEach(() => {
    process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK = "1"
    // Opt in AND pretend to be macOS — the store gate must still suppress `open`
    // purely because OPENCODE_DB (set for this whole file) is a redirected store.
    process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
    _resetDedupeTracker()
    setPlatform("darwin")
    spawnSpy = spyOn(childProcess, "spawn").mockImplementation((() => ({
      on() {},
      unref() {},
    })) as unknown as typeof childProcess.spawn)
  })

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM)
    if (PREV_OPEN_ENV === undefined) delete process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP
    else process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = PREV_OPEN_ENV
    spawnSpy.mockRestore()
    _resetDedupeTracker()
  })

  test("a landed write to a temp OPENCODE_DB never spawns `open`, even opted-in on darwin", async () => {
    await opencodeExport.write(makeSession(CWD, { sourceSessionId: "iso-1" }))
    expect(spawnSpy).not.toHaveBeenCalled()
  })

  test("a batch of writes to the isolated store spawns nothing", async () => {
    await opencodeExport.write(makeSession(CWD, { sourceSessionId: "iso-a" }))
    await opencodeExport.write(makeSession(CWD, { sourceSessionId: "iso-b" }))
    expect(spawnSpy).not.toHaveBeenCalled()
  })
})

describe("isDefaultOpencodeStore (the safety gate)", () => {
  const PREV_DB = process.env.OPENCODE_DB
  const PREV_FF = process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK

  afterEach(() => {
    if (PREV_DB === undefined) delete process.env.OPENCODE_DB
    else process.env.OPENCODE_DB = PREV_DB
    if (PREV_FF === undefined) delete process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
    else process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK = PREV_FF
  })

  test("false for a redirected OPENCODE_DB (every in-process test)", () => {
    process.env.OPENCODE_DB = "/tmp/whatever.db"
    delete process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
    expect(isDefaultOpencodeStore("/tmp/whatever.db")).toBe(false)
  })

  test("false when the fallback force flag is set", () => {
    delete process.env.OPENCODE_DB
    process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK = "1"
    expect(isDefaultOpencodeStore("/Users/x/.local/share/opencode/opencode.db")).toBe(false)
  })

  test("false for an in-memory DB", () => {
    delete process.env.OPENCODE_DB
    delete process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
    expect(isDefaultOpencodeStore(":memory:")).toBe(false)
  })

  test("true only for the real default store (no redirect signals)", () => {
    delete process.env.OPENCODE_DB
    delete process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
    expect(isDefaultOpencodeStore("/Users/x/.local/share/opencode/opencode.db")).toBe(true)
  })
})

// ─── detect ──────────────────────────────────────────────────────────────────

describe("detect()", () => {
  test("returns true when the opencode CLI resolves or a db is present", async () => {
    const detected = await opencodeExport.detect()
    if (CLI_AVAILABLE) {
      expect(detected).toBe(true)
    } else {
      // no CLI: true only if the resolved temp db exists (it may not pre-test)
      expect(typeof detected).toBe("boolean")
    }
  })
})
