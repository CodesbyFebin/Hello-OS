import { test, expect, describe } from "bun:test"
import { PortableSession, SCHEMA_VERSION, type PortableSession as PS } from "../src/ir"

const valid: PS = {
  schemaVersion: "1.0.0",
  sourceHarness: "claude-code",
  sourceSessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  sourcePath: "/Users/x/.claude/projects/-Users-x-demo/aaaaaaaa.jsonl",
  cwd: "/Users/x/demo",
  title: "hello, what is 2+2?",
  createdAt: 1_780_000_000_000,
  updatedAt: 1_780_000_001_000,
  turns: [
    { role: "user", text: "hello, what is 2+2?", timestamp: 1_780_000_000_000 },
    { role: "assistant", text: "2 + 2 = 4.", timestamp: 1_780_000_001_000, model: "claude-opus-4-8" },
  ],
  droppedTurns: 1,
  sourceMetadata: { gitBranch: "main", version: "2.1.181", lineCount: 3 },
}

describe("PortableSession schema", () => {
  test("parses a valid session", () => {
    const out = PortableSession.parse(valid)
    expect(out.sourceHarness).toBe("claude-code")
    expect(out.turns).toHaveLength(2)
    expect(out.schemaVersion).toBe(SCHEMA_VERSION)
  })

  test("rejects a bad schemaVersion", () => {
    expect(() => PortableSession.parse({ ...valid, schemaVersion: "2.0.0" })).toThrow()
  })

  test("rejects an unknown harness", () => {
    expect(() => PortableSession.parse({ ...valid, sourceHarness: "gemini" })).toThrow()
  })

  test("rejects a negative droppedTurns", () => {
    expect(() => PortableSession.parse({ ...valid, droppedTurns: -1 })).toThrow()
  })

  test("rejects a missing required field (cwd)", () => {
    const { cwd, ...missing } = valid
    expect(() => PortableSession.parse(missing)).toThrow()
  })

  // Invariant from HUB-IR.md: stored turns + dropped turns == raw conversational turns.
  test("turns + droppedTurns accounts for every raw turn in the fixture", () => {
    const raw = Bun.file(new URL("./fixtures/claude-sample.jsonl", import.meta.url))
    return raw.text().then((txt) => {
      const rawTurns = txt
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .filter((o) => o.type === "user" || o.type === "assistant").length
      const s = PortableSession.parse(valid)
      expect(s.turns.length + s.droppedTurns).toBe(rawTurns)
    })
  })
})
