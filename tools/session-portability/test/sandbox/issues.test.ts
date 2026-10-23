import { test, expect, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { logIssue, readIssues } from "../../scripts/sandbox/issues"

let tmp: string
let prevSandbox: string | undefined

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "iss-"))
  prevSandbox = process.env.HELLO_SESSIONS_SANDBOX_ROOT
  process.env.HELLO_SESSIONS_SANDBOX_ROOT = tmp
})

afterAll(() => {
  if (prevSandbox === undefined) delete process.env.HELLO_SESSIONS_SANDBOX_ROOT
  else process.env.HELLO_SESSIONS_SANDBOX_ROOT = prevSandbox
  fs.rmSync(tmp, { recursive: true, force: true })
})

test("readIssues is empty before any log", () => {
  expect(readIssues()).toEqual([])
})

test("logIssue appends and readIssues reads back in order", () => {
  logIssue({
    at: "2026-07-06T00-00-00Z",
    sourceHarness: "codex",
    destHarness: "opencode",
    sessionId: "s1",
    project: "-proj-a",
    phase: "resume",
    message: "no ok in output",
  })
  logIssue({
    at: "2026-07-06T00-01-00Z",
    sourceHarness: "claude-code",
    destHarness: "codex",
    sessionId: "s2",
    project: "-proj-b",
    phase: "port",
    message: "adapter threw",
    log: "stack…",
  })
  const all = readIssues()
  expect(all.length).toBe(2)
  expect(all[0]!.phase).toBe("resume")
  expect(all[1]!.sessionId).toBe("s2")
  expect(all[1]!.log).toBe("stack…")
})
