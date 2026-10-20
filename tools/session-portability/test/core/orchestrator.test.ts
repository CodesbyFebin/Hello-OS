// S8 — orchestrator / event stream / ledger tests.
//
// Layout follows docs/specs/S8.md's Testing Plan table:
//   1. event ordering + counts
//   2. ledger dedupe / force / sourceChanged
//   3. concurrent ledger writes never lose a record
//   4. per-session failure isolation
//   5. --all excludes same-harness-as-dest sessions
//   6. integration: port() CC->opencode over fixtures end to end
//   7. --json event stream shape (+ ledger persistence across process boundaries)
//   8. regression: adapters no longer own ledger state
//
// Unit-level tests (1-5, 8) use FAKE import/export adapters registered directly
// through the registry (the same pattern test/registry.test.ts already uses) —
// this keeps them fast, deterministic, and nowhere near a real ~/.claude,
// ~/.codex, or ~/.local/share/opencode. The one genuine end-to-end test (6) mixes
// a real fixture-derived session with the REAL opencode export adapter, redirected
// at a throwaway temp DB. The --json test (7) shells out to the actual CLI in a
// fully redirected temp environment (CODEX_HOME + OPENCODE_DB + a temp
// XDG_DATA_HOME for the ledger) so it never touches this machine's real state.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { Database } from "bun:sqlite"

import { PortableSession } from "../../src/ir"
import type { ExportAdapter, ExportResult, ImportAdapter, SessionRef, WriteOptions } from "../../src/adapter"
import { registerExport, registerImport, _resetRegistry } from "../../src/registry"
import { Orchestrator } from "../../src/core/orchestrator"
import * as Ledger from "../../src/core/ledger"
import type { PorterEvent } from "../../src/core/events"
import { opencodeExport } from "../../src/adapters/opencode/export"
import { parseSessionFile } from "../../src/adapters/claude-code/parser"
import { toPortable } from "../../src/adapters/claude-code/import"

// --- shared fixtures ---------------------------------------------------------

function makeSession(overrides: Partial<PortableSession> = {}): PortableSession {
  return PortableSession.parse({
    schemaVersion: "1.0.0",
    sourceHarness: "codex",
    sourceSessionId: "s1",
    sourcePath: "/tmp/x.jsonl",
    cwd: "/tmp/project",
    title: "a session",
    turns: [
      { role: "user", text: "hi" },
      { role: "assistant", text: "hello" },
    ],
    droppedTurns: 0,
    sourceMetadata: {},
    ...overrides,
  })
}

/** A fully-controlled ImportAdapter over an in-memory list of sessions. */
function fakeImport(
  harness: PortableSession["sourceHarness"],
  sessions: PortableSession[],
  opts?: { failIds?: string[] },
): ImportAdapter {
  return {
    harness,
    detect: async () => true,
    discover: async (): Promise<SessionRef[]> =>
      sessions.map((s) => ({ harness, sourceSessionId: s.sourceSessionId, sourcePath: s.sourcePath, title: s.title })),
    parse: async (ref: SessionRef): Promise<PortableSession> => {
      if (opts?.failIds?.includes(ref.sourceSessionId)) throw new Error(`import failed: ${ref.sourceSessionId}`)
      const found = sessions.find((s) => s.sourceSessionId === ref.sourceSessionId)
      if (!found) throw new Error(`fixture bug: no session for ${ref.sourceSessionId}`)
      return found
    },
  }
}

type RecordedWrite = { session: PortableSession; opts: WriteOptions | undefined }

/** A fully-controlled ExportAdapter that records every write() call it receives. */
function fakeExport(
  harness: PortableSession["sourceHarness"],
  opts?: { failIds?: string[]; destIdOf?: (s: PortableSession) => string },
): { adapter: ExportAdapter; calls: RecordedWrite[] } {
  const calls: RecordedWrite[] = []
  const adapter: ExportAdapter = {
    harness,
    detect: async () => true,
    write: async (session: PortableSession, writeOpts?: WriteOptions): Promise<ExportResult> => {
      calls.push({ session, opts: writeOpts })
      if (opts?.failIds?.includes(session.sourceSessionId)) {
        throw new Error(`export failed: ${session.sourceSessionId}`)
      }
      const destSessionId = writeOpts?.existingDestId ?? opts?.destIdOf?.(session) ?? `dest-${session.sourceSessionId}-${calls.length}`
      return { destSessionId, skipped: false }
    },
    teardown: async () => {},
  }
  return { adapter, calls }
}

let ledgerDir: string

beforeEach(() => {
  _resetRegistry()
  ledgerDir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-ledger-"))
  Ledger.setLedgerPath(path.join(ledgerDir, "ledger.json"))
  // Isolate the default worktree remap from this machine's real conductor.db:
  // point it at a path that does not exist so the fallback returns null instantly.
  process.env.HELLO_SESSIONS_CONDUCTOR_DB = path.join(ledgerDir, "no-conductor.db")
})

afterEach(() => {
  Ledger.setLedgerPath(undefined)
  delete process.env.HELLO_SESSIONS_CONDUCTOR_DB
  fs.rmSync(ledgerDir, { recursive: true, force: true })
  _resetRegistry()
})

// =============================================================================
// 1. Event ordering + counts
// =============================================================================

describe("event ordering + counts", () => {
  test("importAll emits import:start -> N x import:progress -> import:done with correct current/total", async () => {
    const sessions = [makeSession({ sourceSessionId: "a" }), makeSession({ sourceSessionId: "b" }), makeSession({ sourceSessionId: "c" })]
    registerImport(fakeImport("codex", sessions))
    const orch = new Orchestrator()
    const events: PorterEvent[] = []
    orch.events.on((e) => events.push(e))

    await orch.importAll("codex")

    expect(events[0]).toMatchObject({ type: "import:start", harness: "codex", total: 3 })
    const progress = events.filter((e) => e.type === "import:progress")
    expect(progress).toHaveLength(3)
    expect(progress.map((e) => e.current)).toEqual([1, 2, 3])
    for (const e of progress) expect(e.total).toBe(3)
    expect(events[events.length - 1]).toMatchObject({ type: "import:done", harness: "codex", current: 3, total: 3 })
  })

  test("exportSessions emits export:start -> N x export:progress -> export:done", async () => {
    const sessions = [makeSession({ sourceSessionId: "a" }), makeSession({ sourceSessionId: "b" })]
    const { adapter } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()
    const events: PorterEvent[] = []
    orch.events.on((e) => events.push(e))

    await orch.exportSessions("opencode", sessions)

    expect(events[0]).toMatchObject({ type: "export:start", harness: "opencode", total: 2 })
    const progress = events.filter((e) => e.type === "export:progress")
    expect(progress.map((e) => e.current)).toEqual([1, 2])
    expect(events[events.length - 1]).toMatchObject({ type: "export:done", harness: "opencode", current: 2, total: 2 })
  })

  test("port() emits the full ordered sequence: import phase entirely before export phase", async () => {
    const sessions = [makeSession({ sourceSessionId: "a", sourceHarness: "codex" })]
    registerImport(fakeImport("codex", sessions))
    const { adapter } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()
    const events: PorterEvent[] = []
    orch.events.on((e) => events.push(e))

    await orch.port("codex", "opencode", { all: true })

    const types = events.map((e) => e.type)
    expect(types).toEqual(["import:start", "import:progress", "import:done", "export:start", "export:progress", "export:done"])
  })
})

// =============================================================================
// 2. Ledger dedupe / force / sourceChanged
// =============================================================================

describe("ledger dedupe / force / sourceChanged", () => {
  test("a second exportSessions() call for an unchanged session is skipped and does not call write() again", async () => {
    const s = makeSession({ sourceSessionId: "dup-1" })
    const { adapter, calls } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()

    const first = await orch.exportSessions("opencode", [s])
    expect(first[0]!.status).toBe("created")
    expect(calls).toHaveLength(1)

    const second = await orch.exportSessions("opencode", [s])
    expect(second[0]!.status).toBe("skipped")
    expect(second[0]!.destSessionId).toBe(first[0]!.destSessionId)
    expect(calls).toHaveLength(1) // write() was NOT called again
  })

  test("--force overrides the skip and re-exports from scratch", async () => {
    const s = makeSession({ sourceSessionId: "force-1" })
    const { adapter, calls } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()

    const first = await orch.exportSessions("opencode", [s])
    const forced = await orch.exportSessions("opencode", [s], { force: true })

    expect(forced[0]!.status).toBe("created")
    expect(calls).toHaveLength(2)
    expect(calls[1]!.opts?.force).toBe(true)
    expect(calls[1]!.opts?.existingDestId).toBeUndefined()
    // the ledger reflects the latest export
    const rec = await Ledger.getRecord({ sourceHarness: "codex", sourceSessionId: "force-1", destHarness: "opencode" })
    expect(rec?.destSessionId).toBe(forced[0]!.destSessionId)
    void first
  })

  test("a grown session (sourceChanged) triggers an update-in-place write with existingDestId set", async () => {
    const s = makeSession({ sourceSessionId: "grow-1", turns: [{ role: "user", text: "hi" }] })
    const { adapter, calls } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()

    const first = await orch.exportSessions("opencode", [s])
    expect(first[0]!.status).toBe("created")

    const grown = makeSession({
      sourceSessionId: "grow-1",
      turns: [
        { role: "user", text: "hi" },
        { role: "assistant", text: "more" },
      ],
    })
    const updated = await orch.exportSessions("opencode", [grown])

    expect(updated[0]!.status).toBe("updated")
    expect(updated[0]!.destSessionId).toBe(first[0]!.destSessionId)
    expect(calls[1]!.opts?.existingDestId).toBe(first[0]!.destSessionId)

    const rec = await Ledger.getRecord({ sourceHarness: "codex", sourceSessionId: "grow-1", destHarness: "opencode" })
    expect(rec?.sourceRevision).toBe(grown.turns.length)
  })
})

// =============================================================================
// 3. Concurrent ledger writes never lose a record (AC8)
// =============================================================================

describe("concurrent ledger writes never lose a record (AC8)", () => {
  test("N concurrent Ledger.upsertRecord() calls for distinct keys all land", async () => {
    const N = 40
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        Ledger.upsertRecord({
          sourceHarness: "codex",
          sourceSessionId: `s-${i}`,
          destHarness: "opencode",
          destSessionId: `d-${i}`,
          sourceRevision: 1,
          exportedAt: Date.now(),
        }),
      ),
    )
    const records = await Ledger.listRecords()
    expect(records).toHaveLength(N)
  })

  test("two concurrent exportSessions() batches against the same ledger never lose a record", async () => {
    const { adapter } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()

    const batchA = Array.from({ length: 15 }, (_, i) => makeSession({ sourceSessionId: `a-${i}` }))
    const batchB = Array.from({ length: 15 }, (_, i) => makeSession({ sourceSessionId: `b-${i}` }))

    // Fire both batches concurrently — neither awaits the other before starting.
    await Promise.all([orch.exportSessions("opencode", batchA), orch.exportSessions("opencode", batchB)])

    const records = await Ledger.listRecords()
    expect(records).toHaveLength(30)
    const ids = new Set(records.map((r) => r.sourceSessionId))
    expect(ids.size).toBe(30)
  })
})

// =============================================================================
// 4. Per-session failure isolation (AC3)
// =============================================================================

describe("per-session failure isolation (AC3)", () => {
  test("importAll: one failing parse() emits `error` and does not abort the batch", async () => {
    const sessions = [makeSession({ sourceSessionId: "ok-1" }), makeSession({ sourceSessionId: "bad" }), makeSession({ sourceSessionId: "ok-2" })]
    registerImport(fakeImport("codex", sessions, { failIds: ["bad"] }))
    const orch = new Orchestrator()
    const events: PorterEvent[] = []
    orch.events.on((e) => events.push(e))

    const result = await orch.importAll("codex")

    expect(result.map((s) => s.sourceSessionId).sort()).toEqual(["ok-1", "ok-2"])
    const errors = events.filter((e) => e.type === "error")
    expect(errors).toHaveLength(1)
    expect(errors[0]!.sourceSessionId).toBe("bad")
    // the run log needs the stack, not just the flattened message.
    expect(errors[0]!.stack).toContain("Error")
    // import:done still fires with the full attempted count.
    expect(events[events.length - 1]).toMatchObject({ type: "import:done", current: 3, total: 3 })
  })

  test("exportSessions: one failing write() emits `error`, marks that session as errored, and continues the batch", async () => {
    const sessions = [makeSession({ sourceSessionId: "ok-1" }), makeSession({ sourceSessionId: "bad" }), makeSession({ sourceSessionId: "ok-2" })]
    const { adapter } = fakeExport("opencode", { failIds: ["bad"] })
    registerExport(adapter)
    const orch = new Orchestrator()
    const events: PorterEvent[] = []
    orch.events.on((e) => events.push(e))

    const outcomes = await orch.exportSessions("opencode", sessions)

    expect(outcomes.map((o) => o.status)).toEqual(["created", "error", "created"])
    expect(outcomes[1]!.error).toContain("bad")
    const errors = events.filter((e) => e.type === "error")
    expect(errors).toHaveLength(1)
    expect(errors[0]!.sourceSessionId).toBe("bad")
    expect(errors[0]!.stack).toContain("Error")
    expect(events[events.length - 1]).toMatchObject({ type: "export:done", current: 3, total: 3 })

    // the failing session must not have poisoned the ledger.
    const rec = await Ledger.getRecord({ sourceHarness: "codex", sourceSessionId: "bad", destHarness: "opencode" })
    expect(rec).toBeUndefined()
  })
})

// =============================================================================
// event-loop yield: a batch must not starve the host's macrotask/timer phase
// =============================================================================
//
// Found while investigating a real user report: the TUI froze completely
// (no repaint, no responsive spinner, no keyboard input) for the full
// duration of a large import scan or export batch. Root cause: every await
// in this per-session loop (Ledger.getRecord/upsertRecord, an adapter's
// write()/parse()) resolves via an already-settled promise, i.e. a
// microtask, never real async I/O. Node only advances to the timer/macrotask
// phase — where a `setInterval`-driven render loop or spinner animation
// lives — once the microtask queue fully drains; a batch whose every
// iteration re-feeds that queue before it can drain starves timers for the
// whole run. `yieldToEventLoop()` (src/core/async-utils.ts) forces a real
// macrotask hop every iteration. These tests prove a concurrently-running
// timer actually gets to fire DURING the batch, not just after it.

// A `setInterval`/`setTimeout` ticker is wall-clock-gated (Node won't fire it
// until its delay has actually elapsed), which makes it a flaky witness for
// an all-in-memory fake batch that can complete in well under a millisecond
// of real time. `setImmediate` has no such gate — it runs once per real
// event-loop "check phase" turn, which is exactly the phase a starved batch
// prevents from ever being reached. A self-rescheduling setImmediate chain
// is therefore a deterministic proxy for "did the event loop actually turn
// between sessions", independent of how fast the fakes resolve.
function startMacrotaskTicker(): { ticks: () => number; stop: () => void } {
  let ticks = 0
  let stopped = false
  const tick = () => {
    if (stopped) return
    ticks++
    setImmediate(tick)
  }
  setImmediate(tick)
  return { ticks: () => ticks, stop: () => (stopped = true) }
}

describe("event-loop yield during batch operations", () => {
  test("exportSessions lets the event loop turn between sessions, not just after the batch", async () => {
    const sessions = Array.from({ length: 12 }, (_, i) => makeSession({ sourceSessionId: `s${i}` }))
    const { adapter } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()

    const ticker = startMacrotaskTicker()
    try {
      const outcomes = await orch.exportSessions("opencode", sessions)
      expect(outcomes).toHaveLength(12)
      // A starved event loop (the pre-fix behavior) would report 0 here,
      // since the whole batch would run as one uninterrupted microtask
      // chain before the check phase ever got a turn.
      expect(ticker.ticks()).toBeGreaterThan(0)
    } finally {
      ticker.stop()
    }
  })

  test("importAll lets the event loop turn between sessions, not just after the batch", async () => {
    const sessions = Array.from({ length: 12 }, (_, i) => makeSession({ sourceSessionId: `s${i}` }))
    registerImport(fakeImport("codex", sessions))
    const orch = new Orchestrator()

    const ticker = startMacrotaskTicker()
    try {
      const result = await orch.importAll("codex", { concurrency: 1 })
      expect(result).toHaveLength(12)
      expect(ticker.ticks()).toBeGreaterThan(0)
    } finally {
      ticker.stop()
    }
  })
})

// =============================================================================
// 5. --all excludes same-harness-as-dest sessions (AC9)
// =============================================================================

describe("--all excludes same-harness-as-dest sessions (AC9)", () => {
  test("port(harness -> same harness, --all) exports nothing; an explicit --id still targets it", async () => {
    const sessions = [makeSession({ sourceSessionId: "self-1", sourceHarness: "opencode" }), makeSession({ sourceSessionId: "self-2", sourceHarness: "opencode" })]
    registerImport(fakeImport("opencode", sessions))
    const { adapter, calls } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()

    const allResult = await orch.port("opencode", "opencode", { all: true })
    expect(allResult).toHaveLength(0)
    expect(calls).toHaveLength(0)

    const idResult = await orch.port("opencode", "opencode", { ids: ["self-1"] })
    expect(idResult).toHaveLength(1)
    expect(idResult[0]!.sourceSessionId).toBe("self-1")
  })

  test("port(A -> B, --all) keeps sessions whose sourceHarness differs from the destination", async () => {
    const sessions = [makeSession({ sourceSessionId: "keep-1", sourceHarness: "codex" }), makeSession({ sourceSessionId: "keep-2", sourceHarness: "codex" })]
    registerImport(fakeImport("codex", sessions))
    const { adapter } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()

    const result = await orch.port("codex", "opencode", { all: true })
    expect(result.map((o) => o.sourceSessionId).sort()).toEqual(["keep-1", "keep-2"])
  })
})

// =============================================================================
// 6. Integration: port() CC -> opencode over fixtures, end to end
// =============================================================================

describe("integration: port() CC -> opencode over fixtures end to end", () => {
  const FIXTURE = decodeURIComponent(new URL("../fixtures/claude-sample.jsonl", import.meta.url).pathname)

  let ocRoot: string
  let ocDbPath: string
  let prevDb: string | undefined
  let prevDisableChannel: string | undefined
  let prevForceFallback: string | undefined

  beforeEach(() => {
    ocRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp-orch-oc-"))
    ocDbPath = path.join(ocRoot, "opencode.db")
    prevDb = process.env.OPENCODE_DB
    prevDisableChannel = process.env.OPENCODE_DISABLE_CHANNEL_DB
    prevForceFallback = process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
    process.env.OPENCODE_DB = ocDbPath
    process.env.OPENCODE_DISABLE_CHANNEL_DB = "1"
    process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK = "1" // deterministic: never shells out to a real opencode CLI
  })

  afterEach(() => {
    if (prevDb === undefined) delete process.env.OPENCODE_DB
    else process.env.OPENCODE_DB = prevDb
    if (prevDisableChannel === undefined) delete process.env.OPENCODE_DISABLE_CHANNEL_DB
    else process.env.OPENCODE_DISABLE_CHANNEL_DB = prevDisableChannel
    if (prevForceFallback === undefined) delete process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
    else process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK = prevForceFallback
    fs.rmSync(ocRoot, { recursive: true, force: true })
  })

  function fixtureSession(): PortableSession {
    const parsed = parseSessionFile(FIXTURE)
    return toPortable(parsed)
  }

  function queryDb() {
    const db = new Database(ocDbPath, { readonly: true })
    try {
      return {
        sessions: db.query("SELECT id, title FROM session").all() as any[],
        messages: db.query("SELECT session_id, json_extract(data,'$.role') as role FROM message").all() as any[],
      }
    } finally {
      db.close()
    }
  }

  test("imports the real fixture, exports it into opencode, and dedupes on re-run", async () => {
    const source = fixtureSession()
    registerImport({
      harness: "claude-code",
      detect: async () => true,
      discover: async () => [{ harness: "claude-code", sourceSessionId: source.sourceSessionId, sourcePath: source.sourcePath, title: source.title }],
      parse: async () => source,
    })
    registerExport(opencodeExport)
    const orch = new Orchestrator()
    const events: PorterEvent[] = []
    orch.events.on((e) => events.push(e))

    const outcomes = await orch.port("claude-code", "opencode", { all: true })
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]!.status).toBe("created")

    const { sessions, messages } = queryDb()
    expect(sessions).toHaveLength(1)
    expect(messages).toHaveLength(source.turns.length)
    expect(messages.map((m) => m.role)).toEqual(source.turns.map((t) => t.role))
    expect(events.some((e) => e.type === "export:done")).toBe(true)

    // Re-run: unchanged source -> ledger dedupes, no second session created.
    const second = await orch.port("claude-code", "opencode", { all: true })
    expect(second[0]!.status).toBe("skipped")
    expect(queryDb().sessions).toHaveLength(1)
  })
})

// =============================================================================
// 7. --json CLI event stream shape + ledger persistence across process boundaries (AC4, AC5)
// =============================================================================

describe("CLI --json event stream (AC4) + ledger persistence across processes (AC5)", () => {
  test("port --json emits one parseable JSON event per line; re-running the CLI (new process) dedupes via the persisted ledger", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-cli-e2e-"))
    try {
      const codexHome = path.join(root, "codex-home")
      const sessionsDir = path.join(codexHome, "sessions", "2026", "06", "30")
      fs.mkdirSync(sessionsDir, { recursive: true })
      const sourceSessionId = "019f1aa6-8bb8-7e81-9217-000000000099"
      const rollout = [
        {
          timestamp: "2026-06-30T22:29:10.000Z",
          type: "session_meta",
          payload: {
            session_id: sourceSessionId,
            id: sourceSessionId,
            timestamp: "2026-06-30T22:29:10.000Z",
            cwd: "/Users/demo/project",
            originator: "codex-tui",
            cli_version: "0.142.4",
            source: "cli",
            model_provider: "openai",
          },
        },
        {
          timestamp: "2026-06-30T22:29:11.000Z",
          type: "response_item",
          payload: { type: "message", role: "user", content: [{ type: "input_text", text: "cli e2e question" }] },
        },
        {
          timestamp: "2026-06-30T22:29:12.000Z",
          type: "response_item",
          payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "cli e2e answer" }] },
        },
      ]
      fs.writeFileSync(
        path.join(sessionsDir, `rollout-2026-06-30T22-29-10-${sourceSessionId}.jsonl`),
        rollout.map((r) => JSON.stringify(r)).join("\n") + "\n",
      )

      const dataHome = path.join(root, "xdg-data") // hosts both the ledger AND the opencode db
      const env = {
        ...process.env,
        CODEX_HOME: codexHome,
        XDG_DATA_HOME: dataHome,
        OPENCODE_DB: path.join(dataHome, "opencode", "opencode.db"),
        OPENCODE_DISABLE_CHANNEL_DB: "1",
        SESSION_PORTER_OPENCODE_FORCE_FALLBACK: "1",
      }

      const cliPath = path.join(import.meta.dir, "../../src/cli.ts")
      const run = () => spawnSync("bun", ["run", cliPath, "port", "--from", "codex", "--to", "opencode", "--all", "--json"], { env, encoding: "utf8" })

      const first = run()
      expect(first.status).toBe(0)
      const firstLines = first.stdout.split("\n").filter((l) => l.trim())
      expect(firstLines.length).toBeGreaterThan(0)
      const firstEvents = firstLines.map((l) => JSON.parse(l) as PorterEvent)
      expect(firstEvents.map((e) => e.type)).toEqual([
        "import:start",
        "import:progress",
        "import:done",
        "export:start",
        "export:progress",
        "export:done",
      ])
      for (const e of firstEvents) {
        expect(typeof e.type).toBe("string")
        expect(typeof e.harness).toBe("string")
      }

      // Same env, brand-new OS process: the ledger (persisted under dataHome) must
      // already know about this export and skip it.
      const second = run()
      expect(second.status).toBe(0)
      const secondEvents = second.stdout
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as PorterEvent)
      const secondExportProgress = secondEvents.find((e) => e.type === "export:progress")
      expect(secondExportProgress?.message).toBe("skipped (duplicate)")

      const ledgerFile = path.join(dataHome, "hello-sessions", "ledger.json")
      expect(fs.existsSync(ledgerFile)).toBe(true)
      const ledgerData = JSON.parse(fs.readFileSync(ledgerFile, "utf8"))
      expect(ledgerData.records).toHaveLength(1)
      expect(ledgerData.records[0].sourceSessionId).toBe(sourceSessionId)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  }, 20_000)
})

// =============================================================================
// 8. Regression: adapters no longer own ledger state (AC7)
// =============================================================================

describe("regression: adapters no longer own ledger state (AC7)", () => {
  const adapterFiles = [
    "../../src/adapters/claude-code/export.ts",
    "../../src/adapters/codex/export.ts",
    "../../src/adapters/opencode/export.ts",
  ]
  const deletedLedgerFiles = [
    "../../src/adapters/claude-code/export-ledger.ts",
    "../../src/adapters/codex/export-ledger.ts",
    "../../src/adapters/opencode/export-ledger.ts",
  ]

  test("the 3 private export-ledger.ts files were deleted, not generalized", () => {
    for (const rel of deletedLedgerFiles) {
      const p = path.join(import.meta.dir, rel)
      expect(fs.existsSync(p)).toBe(false)
    }
  })

  test("no export.ts imports a deleted export-ledger module, or calls ledger CRUD functions", () => {
    // Grep for actual ledger-module *usage* (imports of the deleted module, or
    // `Ledger.`/`ExportLedger.` namespace calls / `findBySource(` calls) rather
    // than the bare word "ledger" — several files intentionally document IN
    // COMMENTS that they no longer own a ledger, which would otherwise be a false
    // positive for a naive substring search.
    const usagePatterns = [/from\s+["'].*export-ledger["']/, /\bExportLedger\./, /\bLedger\.(read|write|upsert|append|findBySource|removeBySource)\(/, /findBySource\s*\(/]

    for (const rel of adapterFiles) {
      const p = path.join(import.meta.dir, rel)
      const src = fs.readFileSync(p, "utf8")
      for (const pattern of usagePatterns) {
        expect(src).not.toMatch(pattern)
      }
    }
  })

  test("write() is unconditional per adapter: calling it twice for the same session always writes twice", async () => {
    // Proxy for "adapters no longer own skip/dedupe logic" using the fake export
    // harness wired straight through the orchestrator's exportSessions() with the
    // ledger bypassed (force:true both times) — equivalent to calling write() twice.
    const { adapter, calls } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator()
    const s = makeSession({ sourceSessionId: "unconditional-1" })

    await orch.exportSessions("opencode", [s], { force: true })
    await orch.exportSessions("opencode", [s], { force: true })

    expect(calls).toHaveLength(2)
  })
})

// =============================================================================
// reconcileLedger — prune records whose destination conversation was deleted
// =============================================================================

describe("reconcileLedger", () => {
  async function seed(record: Partial<Ledger.LedgerRecord> & Pick<Ledger.LedgerRecord, "sourceSessionId" | "destHarness" | "destSessionId">) {
    await Ledger.upsertRecord({
      sourceHarness: "claude-code",
      sourceRevision: 1,
      exportedAt: 0,
      ...record,
    })
  }

  test("drops records for the dest whose destSessionId is no longer live", async () => {
    await seed({ sourceSessionId: "a", destHarness: "codex", destSessionId: "dest-a" })
    await seed({ sourceSessionId: "b", destHarness: "codex", destSessionId: "dest-b" })
    const orch = new Orchestrator()

    const pruned = await orch.reconcileLedger("codex", new Set(["dest-a"])) // dest-b was deleted

    expect(pruned).toBe(1)
    const remaining = await Ledger.listRecords()
    expect(remaining.map((r) => r.destSessionId).sort()).toEqual(["dest-a"])
  })

  test("never touches records for a different destination harness", async () => {
    await seed({ sourceSessionId: "a", destHarness: "codex", destSessionId: "dest-a" })
    await seed({ sourceSessionId: "a", destHarness: "opencode", destSessionId: "oc-a" })
    const orch = new Orchestrator()

    // Empty live set for codex, but opencode records must survive untouched.
    const pruned = await orch.reconcileLedger("codex", new Set())

    expect(pruned).toBe(1)
    const remaining = await Ledger.listRecords()
    expect(remaining.map((r) => r.destHarness)).toEqual(["opencode"])
  })

  test("keeps every record when all destinations are still live", async () => {
    await seed({ sourceSessionId: "a", destHarness: "codex", destSessionId: "dest-a" })
    const orch = new Orchestrator()

    const pruned = await orch.reconcileLedger("codex", new Set(["dest-a"]))

    expect(pruned).toBe(0)
    expect(await Ledger.listRecords()).toHaveLength(1)
  })
})

// =============================================================================
// AC6 — orchestrator has zero TUI dependency
// =============================================================================

describe("AC6: orchestrator has zero TUI dependency", () => {
  test("orchestrator.ts source has no TUI/rendering imports", () => {
    const src = fs.readFileSync(path.join(import.meta.dir, "../../src/core/orchestrator.ts"), "utf8")
    for (const needle of ["solid-js", "opentui", "react", "ink"]) {
      expect(src.toLowerCase()).not.toContain(needle)
    }
  })

  test("Orchestrator is importable and usable with zero TUI packages in the dependency graph", () => {
    // The whole file already does this (no TUI import anywhere above) — this test
    // just makes the invariant explicit and asserts the class is a plain export.
    expect(typeof Orchestrator).toBe("function")
  })
})

// =============================================================================
// 9. Worktree -> parent-project cwd remap (hub-level, before write())
// =============================================================================

describe("worktree cwd remap", () => {
  test("remaps session.cwd before the export adapter sees it", async () => {
    const s = makeSession({ sourceSessionId: "w1", cwd: "/wt/banjul" })
    const { adapter, calls } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator({
      remapCwd: (sess) => {
        sess.sourceMetadata.originalCwd = sess.cwd
        sess.cwd = "/repo/hello-sessions"
      },
    })

    await orch.exportSessions("opencode", [s])

    expect(calls[0]!.session.cwd).toBe("/repo/hello-sessions")
    expect(calls[0]!.session.sourceMetadata.originalCwd).toBe("/wt/banjul")
  })

  test("importAll remaps cwd so the Select screen groups by the real project", async () => {
    const s = makeSession({ sourceSessionId: "w3", cwd: "/wt/nairobi" })
    registerImport(fakeImport("codex", [s]))
    const orch = new Orchestrator({
      remapCwd: (sess) => {
        if (sess.cwd.startsWith("/wt/")) {
          sess.sourceMetadata.originalCwd = sess.cwd
          sess.sourceMetadata.worktreeSource = "git"
          sess.cwd = "/repo/hello-sessions"
        }
      },
    })

    const [imported] = await orch.importAll("codex")

    expect(imported!.cwd).toBe("/repo/hello-sessions")
    expect(imported!.sourceMetadata.originalCwd).toBe("/wt/nairobi")
  })

  test("default remap leaves a non-worktree cwd untouched", async () => {
    const s = makeSession({ sourceSessionId: "w2", cwd: "/plain/not-a-repo" })
    const { adapter, calls } = fakeExport("opencode")
    registerExport(adapter)
    const orch = new Orchestrator() // real default resolver

    await orch.exportSessions("opencode", [s])

    expect(calls[0]!.session.cwd).toBe("/plain/not-a-repo")
    expect(calls[0]!.session.sourceMetadata.worktreeSource).toBeUndefined()
  })
})
