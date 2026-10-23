import { test, expect, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runClear } from "../../scripts/sandbox/clear"
import { harnessStore } from "../../scripts/sandbox/config"

let tmp: string
let prevSandbox: string | undefined
let prevHome: string | undefined

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clr-"))
  prevSandbox = process.env.HELLO_SESSIONS_SANDBOX_ROOT
  prevHome = process.env.HOME
  process.env.HELLO_SESSIONS_SANDBOX_ROOT = path.join(tmp, "sandbox")
  process.env.HOME = path.join(tmp, "home")
})

afterAll(() => {
  process.env.HOME = prevHome
  if (prevSandbox === undefined) delete process.env.HELLO_SESSIONS_SANDBOX_ROOT
  else process.env.HELLO_SESSIONS_SANDBOX_ROOT = prevSandbox
  fs.rmSync(tmp, { recursive: true, force: true })
})

test("clear wipes sandbox store but not the real store", () => {
  const real = harnessStore("codex").real[0]!
  const sb = harnessStore("codex").sandbox[0]!
  fs.mkdirSync(real, { recursive: true })
  fs.writeFileSync(path.join(real, "keep"), "x")
  fs.mkdirSync(sb, { recursive: true })
  fs.writeFileSync(path.join(sb, "gone"), "x")
  runClear(["codex"])
  expect(fs.existsSync(path.join(sb, "gone"))).toBe(false)
  expect(fs.existsSync(path.join(real, "keep"))).toBe(true)
})

test("clear of all harnesses only touches sandbox paths", () => {
  for (const h of ["claude-code", "codex", "opencode"] as const) {
    const sb = harnessStore(h).sandbox[0]!
    fs.mkdirSync(sb, { recursive: true })
    fs.writeFileSync(path.join(sb, "f"), "x")
  }
  runClear(["claude-code", "codex", "opencode"])
  for (const h of ["claude-code", "codex", "opencode"] as const) {
    expect(fs.existsSync(harnessStore(h).sandbox[0]!)).toBe(false)
  }
})

test("clear drops the sandbox ledger alongside the stores", () => {
  const ledger = path.join(process.env.HELLO_SESSIONS_SANDBOX_ROOT!, "ledger.json")
  fs.mkdirSync(path.dirname(ledger), { recursive: true })
  fs.writeFileSync(ledger, '{"records":[]}')
  runClear(["codex"])
  expect(fs.existsSync(ledger)).toBe(false)
})
