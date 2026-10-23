import { test, expect, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { sessionExists } from "../../scripts/sandbox/store-check"

let tmp: string
let prevCodexHome: string | undefined

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"))
  prevCodexHome = process.env.CODEX_HOME
  process.env.CODEX_HOME = path.join(tmp, "codex")
  fs.mkdirSync(path.join(tmp, "codex", "sessions"), { recursive: true })
})

afterAll(() => {
  if (prevCodexHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = prevCodexHome
  fs.rmSync(tmp, { recursive: true, force: true })
})

test("sessionExists returns false on an empty codex store", async () => {
  expect(await sessionExists("codex", () => true)).toBe(false)
})
