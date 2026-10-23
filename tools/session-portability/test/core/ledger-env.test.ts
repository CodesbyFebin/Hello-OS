import { test, expect, afterEach } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import * as Ledger from "../../src/core/ledger"

const made: string[] = []
afterEach(() => {
  delete process.env.HELLO_SESSIONS_LEDGER_PATH
  Ledger.setLedgerPath(undefined)
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

test("HELLO_SESSIONS_LEDGER_PATH redirects the ledger file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "led-"))
  made.push(dir)
  const p = path.join(dir, "ledger.json")
  process.env.HELLO_SESSIONS_LEDGER_PATH = p
  expect(Ledger.getLedgerPath()).toBe(p)
})

test("explicit setLedgerPath wins over the env seam", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "led-"))
  made.push(dir)
  process.env.HELLO_SESSIONS_LEDGER_PATH = path.join(dir, "env.json")
  Ledger.setLedgerPath(path.join(dir, "explicit.json"))
  expect(Ledger.getLedgerPath()).toBe(path.join(dir, "explicit.json"))
})

test("ledger writes land at the env-selected path", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "led-"))
  made.push(dir)
  const p = path.join(dir, "ledger.json")
  process.env.HELLO_SESSIONS_LEDGER_PATH = p
  await Ledger.upsertRecord({
    sourceHarness: "claude-code",
    sourceSessionId: "s1",
    destHarness: "codex",
    destSessionId: "d1",
    sourceRevision: 1,
    exportedAt: 123,
  })
  expect(fs.existsSync(p)).toBe(true)
  const records = await Ledger.listRecords()
  expect(records.length).toBe(1)
})
