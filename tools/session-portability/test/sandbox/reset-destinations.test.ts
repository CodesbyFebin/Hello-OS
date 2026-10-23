import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { ledgerPath, pruneLedgerForDests } from "../../scripts/demo/reset-destinations"

let dir: string
const prevEnv = process.env.HELLO_SESSIONS_LEDGER_PATH

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-reset-"))
  process.env.HELLO_SESSIONS_LEDGER_PATH = path.join(dir, "ledger.json")
})

afterEach(() => {
  if (prevEnv === undefined) delete process.env.HELLO_SESSIONS_LEDGER_PATH
  else process.env.HELLO_SESSIONS_LEDGER_PATH = prevEnv
  fs.rmSync(dir, { recursive: true, force: true })
})

function seed(records: Array<{ sourceHarness: string; sourceSessionId: string; destHarness: string; destSessionId: string }>) {
  fs.writeFileSync(ledgerPath(), JSON.stringify({ records }, null, 2))
}

function remaining() {
  return JSON.parse(fs.readFileSync(ledgerPath(), "utf8")).records as Array<{ destHarness: string }>
}

describe("pruneLedgerForDests", () => {
  test("removes only records whose destHarness is in the cleared set", () => {
    seed([
      { sourceHarness: "claude-code", sourceSessionId: "a", destHarness: "opencode", destSessionId: "oc-a" },
      { sourceHarness: "claude-code", sourceSessionId: "b", destHarness: "opencode", destSessionId: "oc-b" },
      { sourceHarness: "claude-code", sourceSessionId: "c", destHarness: "codex", destSessionId: "cx-c" },
    ])

    const removed = pruneLedgerForDests(new Set(["opencode"]) as Set<any>)

    expect(removed).toBe(2)
    expect(remaining().map((r) => r.destHarness)).toEqual(["codex"])
  })

  test("clearing both destinations empties the ledger", () => {
    seed([
      { sourceHarness: "claude-code", sourceSessionId: "a", destHarness: "opencode", destSessionId: "oc-a" },
      { sourceHarness: "claude-code", sourceSessionId: "c", destHarness: "codex", destSessionId: "cx-c" },
    ])

    expect(pruneLedgerForDests(new Set(["opencode", "codex"]) as Set<any>)).toBe(2)
    expect(remaining()).toHaveLength(0)
  })

  test("no ledger file is a no-op (returns 0)", () => {
    expect(pruneLedgerForDests(new Set(["opencode"]) as Set<any>)).toBe(0)
  })

  test("leaves the file untouched when nothing matches", () => {
    seed([{ sourceHarness: "claude-code", sourceSessionId: "c", destHarness: "codex", destSessionId: "cx-c" }])
    expect(pruneLedgerForDests(new Set(["opencode"]) as Set<any>)).toBe(0)
    expect(remaining()).toHaveLength(1)
  })
})
