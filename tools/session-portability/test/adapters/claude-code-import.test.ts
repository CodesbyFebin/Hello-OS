import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import { PortableSession } from "../../src/ir"
import { claudeCodeImport, toPortable } from "../../src/adapters/claude-code/import"
import * as ClaudeParser from "../../src/adapters/claude-code/parser"
import * as Ledger from "../../src/adapters/claude-code/ledger"
import { registerImport, getImport, _resetRegistry } from "../../src/registry"

// ---- temp-fixture helpers ---------------------------------------------------

let tmpDir: string

function writeJsonl(name: string, lines: unknown[]): string {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, lines.map((l) => JSON.stringify(l)).join("\n") + "\n")
  return p
}

const CWD = "/Users/howardgil/Desktop/demo"

function userStr(text: string, extra: Record<string, unknown> = {}) {
  return {
    type: "user",
    isSidechain: false,
    isMeta: false,
    cwd: CWD,
    sessionId: "s",
    timestamp: "2026-06-30T10:00:00.000Z",
    message: { role: "user", content: text },
    ...extra,
  }
}
function asstText(text: string, extra: Record<string, unknown> = {}) {
  return {
    type: "assistant",
    isSidechain: false,
    isMeta: false,
    cwd: CWD,
    sessionId: "s",
    timestamp: "2026-06-30T10:00:01.000Z",
    message: { role: "assistant", model: "claude-opus-4-8", content: [{ type: "text", text }] },
    ...extra,
  }
}
function asstBlocks(content: unknown[], extra: Record<string, unknown> = {}) {
  return {
    type: "assistant",
    isSidechain: false,
    isMeta: false,
    cwd: CWD,
    sessionId: "s",
    timestamp: "2026-06-30T10:00:02.000Z",
    message: { role: "assistant", model: "claude-opus-4-8", content },
    ...extra,
  }
}
function userBlocks(content: unknown[], extra: Record<string, unknown> = {}) {
  return { ...userStr("", extra), message: { role: "user", content } }
}

// Count of raw conversational turns per the shared extraction contract:
// user lines that carry text + every assistant line (text or tool/thinking-only).
function rawConversationalTurns(lines: any[]): number {
  return lines.filter((l) => {
    if (l.isSidechain || l.isMeta) return false
    if (l.type === "assistant") return true
    if (l.type === "user") {
      const c = l.message?.content
      if (typeof c === "string") return c.trim().length > 0
      if (Array.isArray(c)) return c.some((b: any) => b?.type === "text" && b.text?.trim())
      return false
    }
    return false
  }).length
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-import-"))
})
afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ---- Unit: turn extraction --------------------------------------------------

describe("turn extraction", () => {
  test("string user content becomes a user turn", () => {
    const p = writeJsonl("str.jsonl", [userStr("hello, what is 2+2?")])
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    expect(s.turns).toHaveLength(1)
    expect(s.turns[0]).toMatchObject({ role: "user", text: "hello, what is 2+2?" })
  })

  test("block assistant content is concatenated text", () => {
    const p = writeJsonl("blocks.jsonl", [
      userStr("hi"),
      asstBlocks([
        { type: "text", text: "line one" },
        { type: "thinking", thinking: "ignore me" },
        { type: "text", text: "line two" },
      ]),
    ])
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    const asst = s.turns.find((t) => t.role === "assistant")!
    expect(asst.text).toBe("line one\nline two")
    expect(asst.model).toBe("claude-opus-4-8")
  })

  test("tool_result-only user line is dropped (not a turn)", () => {
    const p = writeJsonl("toolresult.jsonl", [
      userStr("run it"),
      asstText("running"),
      userBlocks([{ type: "tool_result", tool_use_id: "toolu_x", content: "output" }]),
      userStr("thanks"),
    ])
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    expect(s.turns.map((t) => t.text)).toEqual(["run it", "running", "thanks"])
  })

  test("cwd comes from the line, title is the first-user preview (no provenance prefix)", () => {
    const p = writeJsonl("meta.jsonl", [userStr("hello, what is 2+2?"), asstText("4")])
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    expect(s.cwd).toBe(CWD)
    expect(s.title).toBe("hello, what is 2+2?")
  })
})

// ---- Unit: droppedTurns counting -------------------------------------------

describe("droppedTurns counting", () => {
  test("tool_use-only and thinking-only assistant turns are counted, not stored", () => {
    const p = writeJsonl("dropped.jsonl", [
      userStr("run it"),
      asstText("running"),
      asstBlocks([{ type: "tool_use", id: "toolu_x", name: "Read", input: {} }]),
      asstBlocks([{ type: "thinking", thinking: "hmm" }]),
      userStr("ok"),
      asstText("done"),
    ])
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    expect(s.turns).toHaveLength(4)
    expect(s.droppedTurns).toBe(2)
  })

  test("a session with zero text turns is still valid (dropped only)", () => {
    const p = writeJsonl("empty.jsonl", [
      { type: "summary", summary: "compacted" },
      asstBlocks([{ type: "tool_use", id: "t", name: "Bash", input: {} }]),
    ])
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    expect(s.turns).toHaveLength(0)
    expect(s.droppedTurns).toBe(1)
    expect(s.createdAt).toBeUndefined()
    expect(s.updatedAt).toBeUndefined()
  })
})

// ---- AC2: accounting invariant ----------------------------------------------

describe("AC2 — turns + droppedTurns accounts for every raw conversational turn", () => {
  test("committed fixture", () => {
    const p = fileURLToPath(new URL("../fixtures/claude-sample.jsonl", import.meta.url))
    const lines = fs
      .readFileSync(p, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    expect(s.turns.length + s.droppedTurns).toBe(rawConversationalTurns(lines))
  })

  test("controlled fixture with tools + dropped turns", () => {
    const lines = [
      userStr("run it"),
      asstText("running"),
      userBlocks([{ type: "tool_result", tool_use_id: "x", content: "out" }]),
      asstBlocks([{ type: "tool_use", id: "x", name: "Read", input: {} }]),
      userStr("ok"),
      asstText("done"),
    ]
    const p = writeJsonl("acct.jsonl", lines)
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    expect(s.turns.length + s.droppedTurns).toBe(rawConversationalTurns(lines))
  })
})

// ---- AC3: subagent/meta excluded; summary/control tolerated -----------------

describe("AC3 — sidechain/meta excluded, control lines don't crash", () => {
  test("excludes sidechain + meta, tolerates summary/snapshot/title", () => {
    const p = writeJsonl("exclude.jsonl", [
      userStr("hi"),
      asstText("yo"),
      userStr("sidechain q", { isSidechain: true }),
      asstText("sidechain a", { isSidechain: true }),
      userStr("meta prompt", { isMeta: true }),
      { type: "summary", summary: "post-compact" },
      { type: "file-history-snapshot", snapshot: {} },
      { type: "ai-title", title: "auto title" },
    ])
    const s = toPortable(ClaudeParser.parseSessionFile(p))
    expect(s.turns.map((t) => t.text)).toEqual(["hi", "yo"])
    expect(s.title).toBe("hi")
  })
})

// ---- Mapper shape -----------------------------------------------------------

describe("toPortable mapper", () => {
  test("maps IR fields and validates", () => {
    const p = writeJsonl("shape.jsonl", [userStr("hello"), asstText("hi back")])
    const parsed = ClaudeParser.parseSessionFile(p)
    const s = toPortable(parsed)
    expect(s.schemaVersion).toBe("1.0.0")
    expect(s.sourceHarness).toBe("claude-code")
    expect(s.sourceSessionId).toBe(parsed.claudeSessionID)
    expect(s.sourcePath).toBe(p)
    expect(s.cwd).toBe(parsed.directory)
    expect(s.sourceMetadata).toEqual({ lineCount: parsed.lineCount })
    expect(s.createdAt).toBe(s.turns[0]!.timestamp)
    expect(s.updatedAt).toBe(s.turns[s.turns.length - 1]!.timestamp)
    // Must already be a validated PortableSession.
    expect(() => PortableSession.parse(s)).not.toThrow()
  })
})

// ---- AC6: registry ----------------------------------------------------------

describe("AC6 — registration", () => {
  test("registerImport(claudeCodeImport) is retrievable by harness", () => {
    _resetRegistry()
    registerImport(claudeCodeImport)
    expect(getImport("claude-code")).toBe(claudeCodeImport)
    expect(claudeCodeImport.harness).toBe("claude-code")
  })
})

// ---- detect -----------------------------------------------------------------

describe("detect", () => {
  test("returns a boolean reflecting the projects root", async () => {
    const detected = await claudeCodeImport.detect()
    expect(typeof detected).toBe("boolean")
    expect(detected).toBe(fs.existsSync(ClaudeParser.claudeProjectsRoot()))
  })
})

// ---- AC1/AC4/AC5: integration against real ~/.claude/projects ---------------

describe("integration — real ~/.claude/projects", () => {
  const ledgerBackup = process.env.CLAUDE_IMPORT_LEDGER_DIR
  let realLedgerDir: string

  beforeAll(() => {
    realLedgerDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-ledger-"))
    Ledger.setLedgerDir(realLedgerDir) // isolate — never touch the real ~/.claude-importer
  })
  afterAll(() => {
    fs.rmSync(realLedgerDir, { recursive: true, force: true })
    Ledger.setLedgerDir(ledgerBackup || path.join(os.homedir(), ".claude-importer"))
  })

  test("AC1 — parse() a real transcript yields a valid PortableSession", async () => {
    const refs = await claudeCodeImport.discover()
    if (refs.length === 0) {
      console.warn("no real ~/.claude/projects transcripts — skipping AC1")
      return
    }
    const s = await claudeCodeImport.parse(refs[0]!)
    expect(() => PortableSession.parse(s)).not.toThrow()
    expect(s.sourceHarness).toBe("claude-code")
    expect(s.sourceSessionId.length).toBeGreaterThan(0)
  })

  test("AC5 — re-parsing the same file yields a stable sourceSessionId", async () => {
    const refs = await claudeCodeImport.discover()
    if (refs.length === 0) {
      console.warn("no real transcripts — skipping AC5")
      return
    }
    const a = await claudeCodeImport.parse(refs[0]!)
    const b = await claudeCodeImport.parse(refs[0]!)
    expect(a.sourceSessionId).toBe(b.sourceSessionId)
    expect(a.sourceSessionId).toBe(refs[0]!.sourceSessionId)
  })

  test("AC4 — discover() is newest-first with correct imported/sourceChanged", async () => {
    Ledger.write({ records: [] })
    const refs = await claudeCodeImport.discover()
    if (refs.length === 0) {
      console.warn("no real transcripts — skipping AC4")
      return
    }
    // newest-first: updatedAt (mtime) is non-increasing.
    for (let i = 1; i < refs.length; i++) {
      expect(refs[i - 1]!.updatedAt!).toBeGreaterThanOrEqual(refs[i]!.updatedAt!)
    }
    // empty ledger => nothing imported.
    expect(refs.every((r) => r.imported === false)).toBe(true)

    // Now record an import for the first session at its current lineCount.
    const first = refs[0]!
    const currentLineCount = ClaudeParser.previewSessionFile(first.sourcePath).lineCount
    Ledger.write({
      records: [
        {
          claudeSessionID: first.sourceSessionId,
          sourcePath: first.sourcePath,
          targetSessionID: "target-1",
          directory: "/x",
          importedAt: Date.now(),
          lineCount: currentLineCount,
        },
      ],
    })
    const afterImport = (await claudeCodeImport.discover()).find(
      (r) => r.sourceSessionId === first.sourceSessionId,
    )!
    expect(afterImport.imported).toBe(true)
    expect(afterImport.sourceChanged).toBe(false)

    // Simulate the source growing since import -> sourceChanged.
    Ledger.write({
      records: [
        {
          claudeSessionID: first.sourceSessionId,
          sourcePath: first.sourcePath,
          targetSessionID: "target-1",
          directory: "/x",
          importedAt: Date.now(),
          lineCount: currentLineCount - 1,
        },
      ],
    })
    const afterGrowth = (await claudeCodeImport.discover()).find(
      (r) => r.sourceSessionId === first.sourceSessionId,
    )!
    expect(afterGrowth.imported).toBe(true)
    expect(afterGrowth.sourceChanged).toBe(true)
  })
})
