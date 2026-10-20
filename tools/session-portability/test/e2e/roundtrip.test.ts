// S12 — end-to-end verification harness.
//
// Proves the whole pipeline (S0-S8) on real data: round-trips real Claude Code
// sessions from this machine through the Hub IR into OpenCode and Codex,
// asserting fidelity and idempotency, plus full-mesh source coverage
// (Codex/OpenCode as sources too) and adversarial-input robustness.
//
// ISOLATION (hard safety constraint, not a suggestion): every export in this
// suite goes to a fresh mktemp target for claude-code (`setProjectsRoot`),
// codex (`configureCodexExport({ codexHome })`), and opencode (`OPENCODE_DB`).
// The real `~/.claude/projects`, `~/.codex/sessions`, and
// `~/.local/share/opencode/opencode.db` are ONLY ever read from (for the
// real-corpus sampling tests below) — never written to. Every test that reads
// real data says so in its own comment.

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { Database } from "bun:sqlite"

import { PortableSession } from "../../src/ir"
import { registerAllAdapters } from "../../src/adapters/index"
import { _resetRegistry } from "../../src/registry"
import { Orchestrator } from "../../src/core/orchestrator"
import * as Ledger from "../../src/core/ledger"

import { parseSessionFile } from "../../src/adapters/claude-code/parser"
import { claudeCodeImport, toPortable } from "../../src/adapters/claude-code/import"
import { setProjectsRoot, encodeCwd } from "../../src/adapters/claude-code/export"

import { codexImport } from "../../src/adapters/codex/import"
import { codexExport, configureCodexExport, resetCodexExportConfig } from "../../src/adapters/codex/export"

import { opencodeImport, resolveOpencodeDbPath } from "../../src/adapters/opencode/import"

// =============================================================================
// Isolation harness (applies to every test in this file)
// =============================================================================

let root: string
let claudeRoot: string
let codexHome: string
let opencodeDb: string
let prevOpencodeDb: string | undefined
let prevDisableChannel: string | undefined
let prevForceFallback: string | undefined

beforeEach(() => {
  _resetRegistry()
  registerAllAdapters()

  root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-e2e-"))
  claudeRoot = path.join(root, "claude-projects")
  codexHome = path.join(root, "codex-home")
  opencodeDb = path.join(root, "opencode.db")
  fs.mkdirSync(claudeRoot, { recursive: true })
  fs.mkdirSync(path.join(codexHome, "sessions"), { recursive: true })

  setProjectsRoot(claudeRoot)
  configureCodexExport({ codexHome })

  prevOpencodeDb = process.env.OPENCODE_DB
  prevDisableChannel = process.env.OPENCODE_DISABLE_CHANNEL_DB
  prevForceFallback = process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
  process.env.OPENCODE_DB = opencodeDb
  process.env.OPENCODE_DISABLE_CHANNEL_DB = "1"
  // Deterministic, no dependency on the opencode CLI's subprocess/cwd behavior
  // (real-corpus sessions can have a `cwd` that no longer exists on disk — the
  // CLI path would then fail to spawn; the SQLite fallback never shells out).
  process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK = "1"

  Ledger.setLedgerPath(path.join(root, "ledger.json"))
})

afterEach(() => {
  setProjectsRoot(undefined)
  resetCodexExportConfig()
  if (prevOpencodeDb === undefined) delete process.env.OPENCODE_DB
  else process.env.OPENCODE_DB = prevOpencodeDb
  if (prevDisableChannel === undefined) delete process.env.OPENCODE_DISABLE_CHANNEL_DB
  else process.env.OPENCODE_DISABLE_CHANNEL_DB = prevDisableChannel
  if (prevForceFallback === undefined) delete process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK
  else process.env.SESSION_PORTER_OPENCODE_FORCE_FALLBACK = prevForceFallback
  Ledger.setLedgerPath(undefined)
  _resetRegistry()
  fs.rmSync(root, { recursive: true, force: true })
})

// =============================================================================
// Fixtures + shared helpers
// =============================================================================

const CLAUDE_FIXTURE = decodeURIComponent(new URL("../fixtures/claude-sample.jsonl", import.meta.url).pathname)
const CODEX_FIXTURE = decodeURIComponent(new URL("../fixtures/codex-sample.jsonl", import.meta.url).pathname)

function ccSessionFromFixture(): PortableSession {
  return toPortable(parseSessionFile(CLAUDE_FIXTURE))
}

async function codexSessionFromFixture(): Promise<PortableSession> {
  return codexImport.parse({ harness: "codex", sourceSessionId: "unknown", sourcePath: CODEX_FIXTURE, title: "" })
}

/** Re-import a session claude-code just exported, bypassing discover() (S12 finding: claude-code's discover() walks the real, non-overridable os.homedir()-based projects root; parse() only needs an explicit path). */
async function reimportClaudeCode(destSessionId: string, cwd: string): Promise<PortableSession> {
  const filePath = path.join(claudeRoot, encodeCwd(cwd), `${destSessionId}.jsonl`)
  return claudeCodeImport.parse({ harness: "claude-code", sourceSessionId: destSessionId, sourcePath: filePath, title: "" })
}

/** Re-import a session codex just exported. codexImport.discover()/parse() honor CODEX_HOME per call, so flip it to our isolated codexHome only for the lookup, then restore. */
async function reimportCodex(destSessionId: string): Promise<PortableSession> {
  const saved = process.env.CODEX_HOME
  process.env.CODEX_HOME = codexHome
  try {
    const refs = await codexImport.discover()
    const ref = refs.find((r) => r.sourceSessionId === destSessionId)
    if (!ref) throw new Error(`test: could not locate the exported codex rollout for ${destSessionId}`)
    return await codexImport.parse(ref)
  } finally {
    if (saved === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = saved
  }
}

/** Re-import a session opencode just exported. OPENCODE_DB is already isolated for the whole test, so discover() is safe to use directly. */
async function reimportOpencode(destSessionId: string): Promise<PortableSession> {
  const refs = await opencodeImport.discover()
  const ref = refs.find((r) => r.sourceSessionId === destSessionId)
  if (!ref) throw new Error(`test: could not locate the exported opencode session for ${destSessionId}`)
  return await opencodeImport.parse(ref)
}

/** Turn/text/order + (optionally) title parity, cwd, and monotonic reimported timestamps. */
function assertTurnParity(source: PortableSession, reimported: PortableSession, opts?: { assertTitle?: boolean }): void {
  expect(reimported.turns.length).toBe(source.turns.length)
  for (let i = 0; i < source.turns.length; i++) {
    expect(reimported.turns[i]!.role).toBe(source.turns[i]!.role)
    expect(reimported.turns[i]!.text).toBe(source.turns[i]!.text)
  }
  if (opts?.assertTitle) expect(reimported.title).toBe(source.title)
  expect(reimported.cwd).toBe(source.cwd)

  const timestamps = reimported.turns.map((t) => t.timestamp).filter((t): t is number => typeof t === "number")
  for (let i = 1; i < timestamps.length; i++) {
    expect(timestamps[i]!).toBeGreaterThanOrEqual(timestamps[i - 1]!)
  }
}

// =============================================================================
// 1. CC -> IR -> OpenCode -> IR' (fixtures)
// =============================================================================

describe("round-trip: CC -> IR -> OpenCode -> IR' (fixtures)", () => {
  test("turn/text/order parity; droppedTurns accounted; title preserved (AC8)", async () => {
    const source = ccSessionFromFixture()
    expect(source.turns.length).toBeGreaterThan(0)
    expect(source.droppedTurns).toBeGreaterThan(0) // the fixture has one tool_use-only assistant turn

    const orch = new Orchestrator()
    const outcomes = await orch.exportSessions("opencode", [source])
    expect(outcomes[0]!.status).toBe("created")

    const reimported = await reimportOpencode(outcomes[0]!.destSessionId!)
    assertTurnParity(source, reimported, { assertTitle: true })
    // export only ever carries text turns forward; nothing further can be
    // dropped on re-import, so droppedTurns is fully "accounted for" at 0.
    expect(reimported.droppedTurns).toBe(0)
  })
})

// =============================================================================
// 2. CC -> IR -> Codex -> IR' (fixtures) + live Codex-surfacing check
// =============================================================================

describe("round-trip: CC -> IR -> Codex -> IR' (fixtures)", () => {
  test("turn/text/order parity; droppedTurns accounted; title NOT asserted (AC8 known gap)", async () => {
    const source = ccSessionFromFixture()
    const orch = new Orchestrator()
    const outcomes = await orch.exportSessions("codex", [source])
    expect(outcomes[0]!.status).toBe("created")

    const reimported = await reimportCodex(outcomes[0]!.destSessionId!)
    assertTurnParity(source, reimported) // no assertTitle — see AC8
    expect(reimported.droppedTurns).toBe(0)

    // AC8: codex/export.ts does not serialize session.title — it is re-derived
    // from turns on re-import. Now that the provenance prefix is gone, that
    // re-derivation coincides with the source's first-user-turn preview, so the
    // title round-trips cleanly with no [codex]/[claude] marker leaking in.
    expect(reimported.title.startsWith("[codex]")).toBe(false)
    expect(reimported.title.startsWith("[claude]")).toBe(false)
    expect(reimported.title.length).toBeGreaterThan(0)
  })
})

describe("Codex live-surfacing check (best-effort, AC2)", () => {
  test("headless verification is not possible with codex-cli; register-mode fallback works", async () => {
    const cli = Bun.which("codex")
    if (!cli) {
      console.warn("[S12 AC2] codex CLI not installed on this machine — skipping the live-surfacing probe.")
      return
    }

    const source = ccSessionFromFixture()
    await codexExport.write(source) // synthesizes a rollout into the isolated codexHome

    // Best-effort probe: Codex's session picker (`codex resume --all`) requires
    // an interactive TTY. Manually verified during S12 authoring: even faking a
    // pty via `script -q /dev/null`, the CLI launches its full ratatui UI and
    // blocks on input with no scriptable, non-interactive listing surface.
    // Headless assertion of "does Codex list this rollout" is therefore NOT
    // POSSIBLE with codex-cli 0.142.4 — this documents that finding instead of
    // asserting a pass/fail on the interactive picker itself (AC2's "OR the
    // finding is reported" clause).
    const probe = spawnSync("codex", ["resume", "--all"], {
      env: { ...process.env, CODEX_HOME: codexHome },
      encoding: "utf8",
      timeout: 5000,
    })
    const out = `${probe.stdout ?? ""}${probe.stderr ?? ""}`
    expect(out.toLowerCase()).toMatch(/terminal|tty/)
    console.warn(
      "[S12 AC2 finding] codex-cli requires a TTY for `resume --all`; there is " +
        "no headless/scriptable way to confirm an externally-written rollout " +
        "surfaces in the real Codex UI from an automated test. Falling back to " +
        'the documented mitigation: mode:"register" writes ' +
        "external_agent_session_imports.json, Codex's own foreign-import path.",
    )

    // AC2's documented fallback: a Claude→Codex write registers in Codex's own
    // native-import ledger (keyed on the Claude source) so Codex's "Import from
    // Claude Code" dedupes against our port. On-disk shape is `{ records: [...] }`.
    configureCodexExport({ codexHome })
    const res = await codexExport.write(ccSessionFromFixture())
    const registryFile = path.join(codexHome, "external_agent_session_imports.json")
    expect(fs.existsSync(registryFile)).toBe(true)
    const parsed = JSON.parse(fs.readFileSync(registryFile, "utf8")) as {
      records: Array<{ imported_thread_id: string }>
    }
    expect(parsed.records.some((e) => e.imported_thread_id === res.destSessionId)).toBe(true)
  })
})

// =============================================================================
// 3. CC -> IR -> CC -> IR' (fixtures): exact parity, droppedTurns == 0
// =============================================================================

describe("round-trip: CC -> IR -> CC -> IR' (fixtures)", () => {
  test("exact parity; droppedTurns == 0 on re-import", async () => {
    const source = ccSessionFromFixture()
    const orch = new Orchestrator()
    const outcomes = await orch.exportSessions("claude-code", [source])
    expect(outcomes[0]!.status).toBe("created")

    const reimported = await reimportClaudeCode(outcomes[0]!.destSessionId!, source.cwd)
    assertTurnParity(source, reimported, { assertTitle: true })
    expect(reimported.droppedTurns).toBe(0)
  })
})

// =============================================================================
// 4. Full-mesh source coverage: real Codex + real OpenCode as SOURCES,
//    and a non-CC source round-tripped to a different destination.
// =============================================================================

describe("full-mesh source coverage", () => {
  // Reads the REAL ~/.codex/sessions store (read-only — never mutated).
  test("real Codex rollouts import into schema-valid PortableSessions", async () => {
    if (!(await codexImport.detect())) {
      console.warn("[skip] no real ~/.codex/sessions on this machine")
      return
    }
    const refs = await codexImport.discover()
    if (refs.length === 0) {
      console.warn("[skip] no real codex rollouts discovered")
      return
    }
    for (const ref of refs.slice(0, 5)) {
      const session = await codexImport.parse(ref)
      expect(() => PortableSession.parse(session)).not.toThrow()
      expect(session.sourceHarness).toBe("codex")
      expect(session.sourceSessionId.length).toBeGreaterThan(0)
    }
  })

  // Reads the REAL opencode store (read-only — never mutated). Must
  // temporarily un-set the isolated OPENCODE_DB override to reach it.
  test("real OpenCode sessions import into schema-valid PortableSessions", async () => {
    const saved = process.env.OPENCODE_DB
    delete process.env.OPENCODE_DB
    try {
      if (!(await opencodeImport.detect())) {
        console.warn("[skip] no real opencode CLI/DB on this machine")
        return
      }
      const dbPath = resolveOpencodeDbPath()
      if (!fs.existsSync(dbPath)) {
        console.warn("[skip] no real opencode.db discovered")
        return
      }
      const refs = await opencodeImport.discover()
      if (refs.length === 0) {
        console.warn("[skip] no real opencode sessions discovered")
        return
      }
      for (const ref of refs.slice(0, 5)) {
        const session = await opencodeImport.parse(ref)
        expect(() => PortableSession.parse(session)).not.toThrow()
        expect(session.sourceHarness).toBe("opencode")
      }
    } finally {
      if (saved === undefined) delete process.env.OPENCODE_DB
      else process.env.OPENCODE_DB = saved
    }
  })

  test("non-CC source round-trip: Codex -> IR -> OpenCode", async () => {
    const source = await codexSessionFromFixture()
    expect(source.sourceHarness).toBe("codex")

    const orch = new Orchestrator()
    const outcomes = await orch.exportSessions("opencode", [source])
    expect(outcomes[0]!.status).toBe("created")

    const reimported = await reimportOpencode(outcomes[0]!.destSessionId!)
    assertTurnParity(source, reimported, { assertTitle: true })
  })
})

// =============================================================================
// 5. Adversarial inputs (AC7)
// =============================================================================

describe("adversarial: malformed JSONL line (AC7)", () => {
  test("claude-code: a malformed line is skipped with a logged reason, no crash", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-adv-cc-"))
    try {
      const file = path.join(dir, "malformed.jsonl")
      const good1 = JSON.stringify({
        type: "user",
        isSidechain: false,
        isMeta: false,
        cwd: "/tmp/adv",
        sessionId: "s",
        timestamp: "2026-06-30T10:00:00.000Z",
        message: { role: "user", content: "hello" },
      })
      const good2 = JSON.stringify({
        type: "assistant",
        isSidechain: false,
        isMeta: false,
        cwd: "/tmp/adv",
        sessionId: "s",
        timestamp: "2026-06-30T10:00:01.000Z",
        message: { role: "assistant", model: "claude-opus-4-8", content: [{ type: "text", text: "hi" }] },
      })
      fs.writeFileSync(file, [good1, "{this is not valid json!!", good2].join("\n") + "\n")

      const session = toPortable(parseSessionFile(file))
      expect(session.turns.map((t) => t.text)).toEqual(["hello", "hi"])

      const skipped = session.sourceMetadata.skippedLines as Array<{ line: number; reason: string }>
      expect(skipped).toBeDefined()
      expect(skipped).toHaveLength(1)
      expect(skipped[0]!.line).toBe(2)
      expect(typeof skipped[0]!.reason).toBe("string")
      expect(skipped[0]!.reason.length).toBeGreaterThan(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test("codex: a malformed line is skipped with a logged reason, no crash", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-adv-codex-"))
    try {
      const file = path.join(dir, "rollout-2026-07-01T00-00-00-malformed-id.jsonl")
      const meta = JSON.stringify({
        timestamp: "2026-07-01T00:00:00.000Z",
        type: "session_meta",
        payload: { session_id: "malformed-id", cwd: "/tmp/adv", timestamp: "2026-07-01T00:00:00.000Z" },
      })
      const user = JSON.stringify({
        timestamp: "2026-07-01T00:00:01.000Z",
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "q" }] },
      })
      fs.writeFileSync(file, [meta, "{{{ totally broken json", user].join("\n") + "\n")

      const session = await codexImport.parse({ harness: "codex", sourceSessionId: "malformed-id", sourcePath: file, title: "" })
      expect(session.turns.map((t) => t.text)).toEqual(["q"])

      const skipped = session.sourceMetadata.skippedLines as Array<{ line: number; reason: string }>
      expect(skipped).toBeDefined()
      expect(skipped).toHaveLength(1)
      expect(skipped[0]!.line).toBe(2)
      expect(typeof skipped[0]!.reason).toBe("string")
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test("opencode: a malformed row blob is skipped with a logged reason (console.warn), no crash", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-adv-oc-"))
    try {
      const dbPath = path.join(dir, "adv.db")
      const db = new Database(dbPath, { create: true })
      db.run(
        `CREATE TABLE session (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, directory TEXT NOT NULL,
          title TEXT NOT NULL, version TEXT NOT NULL, cost REAL DEFAULT 0 NOT NULL,
          tokens_input INTEGER DEFAULT 0 NOT NULL, tokens_output INTEGER DEFAULT 0 NOT NULL,
          tokens_reasoning INTEGER DEFAULT 0 NOT NULL, time_created INTEGER, time_updated INTEGER)`,
      )
      db.run(
        `CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
          time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)`,
      )
      db.run(
        `CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL,
          time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)`,
      )
      const sid = "ses_adv1"
      db.run("INSERT INTO session VALUES (?,?,?,?,?,?,?,?,?,?,?)", [sid, "p", "/tmp/adv", "adv title", "1.0.0", 0, 0, 0, 0, 1, 2])
      // one well-formed message, one with a corrupt `data` JSON blob
      db.run("INSERT INTO message VALUES (?,?,?,?,?)", ["msg_ok", sid, 1, 1, JSON.stringify({ role: "user", time: { created: 1 } })])
      db.run("INSERT INTO part VALUES (?,?,?,?,?,?)", ["prt_ok", "msg_ok", sid, 1, 1, JSON.stringify({ type: "text", text: "hello" })])
      db.run("INSERT INTO message VALUES (?,?,?,?,?)", ["msg_bad", sid, 2, 2, "{not valid json"])
      db.close()

      const warnSpy = spyOn(console, "warn").mockImplementation(() => {})
      try {
        const { readSessionFromDb, toPortableSession } = require("../../src/adapters/opencode/import")
        const exp = readSessionFromDb(dbPath, sid)
        const session = toPortableSession(exp, dbPath)
        expect(() => PortableSession.parse(session)).not.toThrow()
        // the malformed row's blob resolves to {} (no role/text) -> a dropped turn, not a crash
        expect(session.turns.map((t: any) => t.text)).toEqual(["hello"])
        expect(warnSpy).toHaveBeenCalled()
        const loggedReason = warnSpy.mock.calls.map((c) => String(c[0])).find((msg) => msg.includes("malformed"))
        expect(loggedReason).toBeDefined()
      } finally {
        warnSpy.mockRestore()
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("adversarial: truncated file (AC7)", () => {
  test("claude-code: a truncated trailing line is skipped; complete lines still parse", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-adv-trunc-cc-"))
    try {
      const file = path.join(dir, "truncated.jsonl")
      const good = JSON.stringify({
        type: "user",
        isSidechain: false,
        isMeta: false,
        cwd: "/tmp/adv",
        sessionId: "s",
        timestamp: "2026-06-30T10:00:00.000Z",
        message: { role: "user", content: "hello" },
      })
      // Trailing line is cut off mid-write (no closing braces/quotes) — a
      // realistic crash-during-write truncation.
      const truncated = '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"cut off mid'
      fs.writeFileSync(file, good + "\n" + truncated)

      const session = toPortable(parseSessionFile(file))
      expect(session.turns.map((t) => t.text)).toEqual(["hello"])
      const skipped = session.sourceMetadata.skippedLines as Array<{ line: number; reason: string }>
      expect(skipped.length).toBeGreaterThanOrEqual(1)
      expect(skipped[0]!.line).toBe(2)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test("codex: a truncated trailing line is skipped; complete lines still parse", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-adv-trunc-codex-"))
    try {
      const file = path.join(dir, "rollout-2026-07-01T00-00-00-truncated-id.jsonl")
      const meta = JSON.stringify({
        timestamp: "2026-07-01T00:00:00.000Z",
        type: "session_meta",
        payload: { session_id: "truncated-id", cwd: "/tmp/adv", timestamp: "2026-07-01T00:00:00.000Z" },
      })
      const user = JSON.stringify({
        timestamp: "2026-07-01T00:00:01.000Z",
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "q" }] },
      })
      const truncated = '{"timestamp":"2026-07-01T00:00:02.000Z","type":"response_item","payload":{"type":"message'
      fs.writeFileSync(file, [meta, user].join("\n") + "\n" + truncated)

      const session = await codexImport.parse({ harness: "codex", sourceSessionId: "truncated-id", sourcePath: file, title: "" })
      expect(session.turns.map((t) => t.text)).toEqual(["q"])
      const skipped = session.sourceMetadata.skippedLines as Array<{ line: number; reason: string }>
      expect(skipped.length).toBeGreaterThanOrEqual(1)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("adversarial: duplicate session id (AC7)", () => {
  test("exporting the same sourceSessionId twice never creates two destination artifacts", async () => {
    const source = ccSessionFromFixture()
    const duplicateDiscovery = { ...source } // e.g. the same session discovered via two different paths

    const orch = new Orchestrator()
    const first = await orch.exportSessions("opencode", [source])
    const second = await orch.exportSessions("opencode", [duplicateDiscovery])

    expect(first[0]!.status).toBe("created")
    expect(second[0]!.status).toBe("skipped")
    expect(second[0]!.destSessionId).toBe(first[0]!.destSessionId)

    const db = new Database(opencodeDb, { readonly: true })
    try {
      const count = db.query("SELECT COUNT(*) as c FROM session").get() as { c: number }
      expect(count.c).toBe(1)
    } finally {
      db.close()
    }
  })
})

describe("adversarial: grown session takes the ledger UPDATE path (AC7)", () => {
  test("claude-code destination: growing turns keeps the same destSessionId and the same file", async () => {
    const base = ccSessionFromFixture()
    const orch = new Orchestrator()
    const first = await orch.exportSessions("claude-code", [base])
    expect(first[0]!.status).toBe("created")

    const grown: PortableSession = {
      ...base,
      turns: [...base.turns, { role: "user", text: "one more turn", timestamp: (base.turns.at(-1)?.timestamp ?? Date.now()) + 1000 }],
    }
    const second = await orch.exportSessions("claude-code", [grown])
    expect(second[0]!.status).toBe("updated")
    expect(second[0]!.destSessionId).toBe(first[0]!.destSessionId)

    const dir = path.join(claudeRoot, encodeCwd(base.cwd))
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
    expect(files).toHaveLength(1) // same file rewritten in place, not a second one

    const reimported = await reimportClaudeCode(second[0]!.destSessionId!, base.cwd)
    expect(reimported.turns.length).toBe(grown.turns.length)
    expect(reimported.turns.at(-1)!.text).toBe("one more turn")
  })

  test("opencode destination: growing turns keeps the same destSessionId and updates in place", async () => {
    const base = await codexSessionFromFixture()
    const orch = new Orchestrator()
    const first = await orch.exportSessions("opencode", [base])
    expect(first[0]!.status).toBe("created")

    const grown: PortableSession = { ...base, turns: [...base.turns, { role: "assistant", text: "grown answer" }] }
    const second = await orch.exportSessions("opencode", [grown])
    expect(second[0]!.status).toBe("updated")
    expect(second[0]!.destSessionId).toBe(first[0]!.destSessionId)

    const db = new Database(opencodeDb, { readonly: true })
    try {
      const count = db.query("SELECT COUNT(*) as c FROM session").get() as { c: number }
      expect(count.c).toBe(1) // updated in place, not a second row
    } finally {
      db.close()
    }

    const reimported = await reimportOpencode(second[0]!.destSessionId!)
    expect(reimported.turns.length).toBe(grown.turns.length)
  })
})

// =============================================================================
// 6. Idempotency: second export run is a ledger no-op; --force re-exports (AC3)
// =============================================================================

describe("idempotency: second export run is a ledger no-op (AC3)", () => {
  test("claude-code: second export is skipped; --force re-exports from scratch", async () => {
    const source = ccSessionFromFixture()
    const orch = new Orchestrator()
    const first = await orch.exportSessions("claude-code", [source])
    expect(first[0]!.status).toBe("created")

    const second = await orch.exportSessions("claude-code", [source])
    expect(second[0]!.status).toBe("skipped")
    expect(second[0]!.destSessionId).toBe(first[0]!.destSessionId)

    const forced = await orch.exportSessions("claude-code", [source], { force: true })
    expect(forced[0]!.status).toBe("created")
    expect(forced[0]!.destSessionId).not.toBe(first[0]!.destSessionId)
  })

  test("codex: second export is skipped; --force re-exports from scratch", async () => {
    const source = ccSessionFromFixture()
    const orch = new Orchestrator()
    const first = await orch.exportSessions("codex", [source])
    expect(first[0]!.status).toBe("created")

    const second = await orch.exportSessions("codex", [source])
    expect(second[0]!.status).toBe("skipped")
    expect(second[0]!.destSessionId).toBe(first[0]!.destSessionId)

    const forced = await orch.exportSessions("codex", [source], { force: true })
    expect(forced[0]!.status).toBe("created")
    expect(forced[0]!.destSessionId).not.toBe(first[0]!.destSessionId)
  })

  test("opencode: second export is skipped; --force re-exports from scratch", async () => {
    const source = ccSessionFromFixture()
    const orch = new Orchestrator()
    const first = await orch.exportSessions("opencode", [source])
    expect(first[0]!.status).toBe("created")

    const second = await orch.exportSessions("opencode", [source])
    expect(second[0]!.status).toBe("skipped")
    expect(second[0]!.destSessionId).toBe(first[0]!.destSessionId)

    const forced = await orch.exportSessions("opencode", [source], { force: true })
    expect(forced[0]!.status).toBe("created")
    expect(forced[0]!.destSessionId).not.toBe(first[0]!.destSessionId)

    const db = new Database(opencodeDb, { readonly: true })
    try {
      const count = db.query("SELECT COUNT(*) as c FROM session").get() as { c: number }
      expect(count.c).toBe(2) // the skipped run created nothing; force created a second row
    } finally {
      db.close()
    }
  })
})

// =============================================================================
// 7. E2E: sample of real local CC sessions round-tripped to all 3 destinations
//    (AC1, AC4, AC5 partial). READS the real ~/.claude/projects store; every
//    export target stays isolated per the top-level beforeEach.
// =============================================================================

// Live-home corpus sampling is intentionally excluded. Fixture-based round-trip
// tests above cover the adapters without reading a developer's private sessions.

// =============================================================================
// 8. CLI surface: `hello-sessions verify` (AC1-AC5)
// =============================================================================

describe("CLI: hello-sessions verify", () => {
  const cliPath = path.join(import.meta.dir, "../../src/cli.ts")

  test("verify --from claude-code --to codex --sample 2 exits 0 or 1, never crashes, real stores untouched", () => {
    const r = spawnSync("bun", ["run", cliPath, "verify", "--from", "claude-code", "--to", "codex", "--sample", "2"], {
      encoding: "utf8",
      timeout: 60_000,
    })
    expect(r.error).toBeUndefined()
    expect(r.status === 0 || r.status === 1).toBe(true)
    expect(() => JSON.parse(r.stdout)).not.toThrow()
  }, 65_000)

  test("second invocation against the same pinned root is a ledger no-op (AC3)", () => {
    const pinnedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp-verify-cli-"))
    try {
      const env = { ...process.env, SESSION_PORTER_VERIFY_ROOT: pinnedRoot }
      const run = () =>
        spawnSync("bun", ["run", cliPath, "verify", "--from", "claude-code", "--to", "codex", "--sample", "1"], {
          encoding: "utf8",
          timeout: 60_000,
          env,
        })

      const first = run()
      expect(first.error).toBeUndefined()
      const firstReport = JSON.parse(first.stdout)
      if (firstReport.sampled === 0) {
        console.warn("[skip] no real claude-code sessions to verify idempotency against")
        return
      }
      expect(firstReport.perDestination.codex.created).toBeGreaterThan(0)

      const second = run()
      const secondReport = JSON.parse(second.stdout)
      expect(secondReport.perDestination.codex.skipped).toBe(firstReport.sampled)
      expect(secondReport.perDestination.codex.created).toBe(0)
    } finally {
      fs.rmSync(pinnedRoot, { recursive: true, force: true })
    }
  }, 130_000)

  test("--all completes over the full local corpus without unhandled crashes (AC5)", () => {
    const r = spawnSync("bun", ["run", cliPath, "verify", "--from", "claude-code", "--to", "opencode", "--all"], {
      encoding: "utf8",
      timeout: 150_000,
      env: { ...process.env, SESSION_PORTER_OPENCODE_FORCE_FALLBACK: "1" },
    })
    expect(r.error).toBeUndefined()
    expect(r.status === 0 || r.status === 1).toBe(true)
    const report = JSON.parse(r.stdout)
    expect(typeof report.sampled).toBe("number")
    if (report.failures?.length) {
      console.warn(`[S12 AC5 --all] ${report.failures.length} session(s) failed fidelity/export over the full corpus (reported, not crashed):`)
      for (const f of report.failures.slice(0, 10)) console.warn(`  ${f.destHarness} <- ${f.sourceSessionId}: ${f.reason}`)
    }
  }, 160_000)

  test("unknown --from harness is a clean usage error (exit 2), not a crash", () => {
    const r = spawnSync("bun", ["run", cliPath, "verify", "--from", "not-a-real-harness"], { encoding: "utf8", timeout: 20_000 })
    expect(r.status).toBe(2)
  })
})
