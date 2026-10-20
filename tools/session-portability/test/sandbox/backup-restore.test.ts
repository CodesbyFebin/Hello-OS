import { test, expect, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runBackup } from "../../scripts/sandbox/backup"
import { runRestore } from "../../scripts/sandbox/restore"
import { harnessStore } from "../../scripts/sandbox/config"

// bun test shares one process across files — save/restore every env we touch.
let tmp: string
let prevSandbox: string | undefined
let prevHome: string | undefined

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bk-"))
  prevSandbox = process.env.HELLO_SESSIONS_SANDBOX_ROOT
  prevHome = process.env.HOME
  process.env.HELLO_SESSIONS_SANDBOX_ROOT = path.join(tmp, "sandbox")
  process.env.HOME = path.join(tmp, "home")
})

afterAll(() => {
  process.env.HELLO_SESSIONS_SANDBOX_ROOT = prevSandbox
  process.env.HOME = prevHome
  if (prevSandbox === undefined) delete process.env.HELLO_SESSIONS_SANDBOX_ROOT
  fs.rmSync(tmp, { recursive: true, force: true })
})

test("backup snapshots the real store, restore puts it back", () => {
  const real = harnessStore("claude-code").real[0]!
  fs.mkdirSync(real, { recursive: true })
  fs.writeFileSync(path.join(real, "s.jsonl"), "orig")

  const dirs = runBackup(["claude-code"], "2026-07-06T00-00-00Z")
  expect(dirs.length).toBe(1)
  expect(fs.readFileSync(path.join(dirs[0]!, "store-0", "s.jsonl"), "utf8")).toBe("orig")

  fs.writeFileSync(path.join(real, "s.jsonl"), "corrupted")
  fs.writeFileSync(path.join(real, "stray.jsonl"), "should vanish on restore")

  runRestore(["claude-code"])
  expect(fs.readFileSync(path.join(real, "s.jsonl"), "utf8")).toBe("orig")
  expect(fs.existsSync(path.join(real, "stray.jsonl"))).toBe(false)
})

test("restore picks the newest backup by default", () => {
  const real = harnessStore("codex").real[0]!
  fs.mkdirSync(real, { recursive: true })
  fs.writeFileSync(path.join(real, "r.jsonl"), "v1")
  runBackup(["codex"], "2026-07-06T00-00-00Z")
  fs.writeFileSync(path.join(real, "r.jsonl"), "v2")
  runBackup(["codex"], "2026-07-06T01-00-00Z")
  fs.writeFileSync(path.join(real, "r.jsonl"), "junk")
  runRestore(["codex"])
  expect(fs.readFileSync(path.join(real, "r.jsonl"), "utf8")).toBe("v2")
})

test("restore with explicit --from timestamp", () => {
  const real = harnessStore("codex").real[0]!
  runRestore(["codex"], "2026-07-06T00-00-00Z")
  expect(fs.readFileSync(path.join(real, "r.jsonl"), "utf8")).toBe("v1")
})

test("restore throws when no backup exists", () => {
  expect(() => runRestore(["opencode"])).toThrow("no backup for opencode")
})
