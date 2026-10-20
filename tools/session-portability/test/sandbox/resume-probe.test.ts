import { test, expect } from "bun:test"
import { resumeCommand } from "../../scripts/sandbox/resume-probe"

test("claude-code resumes non-interactively via --resume + -p", () => {
  const cmd = resumeCommand("claude-code", "abc", "reply only ok")
  expect(cmd?.bin).toBe("claude")
  expect(cmd?.args).toEqual(["--resume", "abc", "-p", "reply only ok"])
})

test("codex resumes via exec resume", () => {
  const cmd = resumeCommand("codex", "abc", "reply only ok")
  expect(cmd?.bin).toBe("codex")
  expect(cmd?.args).toEqual(["exec", "resume", "abc", "reply only ok"])
})

test("opencode resumes via run -s", () => {
  const cmd = resumeCommand("opencode", "abc", "reply only ok")
  expect(cmd?.bin).toBe("opencode")
  expect(cmd?.args).toEqual(["run", "-s", "abc", "reply only ok"])
})

import { beforeAll, afterAll } from "bun:test"
import { Database } from "bun:sqlite"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { retargetOpencodeSessionModel } from "../../scripts/sandbox/resume-probe"

let tmp: string
let prevSandbox: string | undefined

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rtm-"))
  prevSandbox = process.env.HELLO_SESSIONS_SANDBOX_ROOT
  process.env.HELLO_SESSIONS_SANDBOX_ROOT = tmp
})

afterAll(() => {
  if (prevSandbox === undefined) delete process.env.HELLO_SESSIONS_SANDBOX_ROOT
  else process.env.HELLO_SESSIONS_SANDBOX_ROOT = prevSandbox
  fs.rmSync(tmp, { recursive: true, force: true })
})

test("retargetOpencodeSessionModel rewrites session + message rows", () => {
  const dbPath = path.join(tmp, "opencode.db")
  const db = new Database(dbPath)
  db.run("CREATE TABLE session (id TEXT PRIMARY KEY, model TEXT)")
  db.run("CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT)")
  db.run("INSERT INTO session VALUES ('s1', ?)", [JSON.stringify({ id: "claude-opus-4-8", providerID: "anthropic" })])
  db.run("INSERT INTO message VALUES ('m1', 's1', ?)", [JSON.stringify({ role: "assistant", providerID: "anthropic", modelID: "claude-opus-4-8" })])
  db.run("INSERT INTO message VALUES ('m2', 's1', ?)", [JSON.stringify({ role: "user", model: { providerID: "anthropic", modelID: "claude-opus-4-8" } })])
  db.close()

  retargetOpencodeSessionModel(dbPath, "s1", { providerID: "openai", modelID: "gpt-5.4-mini" })

  const check = new Database(dbPath, { readonly: true })
  const s = JSON.parse((check.query("SELECT model FROM session WHERE id='s1'").get() as { model: string }).model)
  expect(s).toEqual({ id: "gpt-5.4-mini", providerID: "openai" })
  const m1 = JSON.parse((check.query("SELECT data FROM message WHERE id='m1'").get() as { data: string }).data)
  expect(m1.providerID).toBe("openai")
  expect(m1.modelID).toBe("gpt-5.4-mini")
  const m2 = JSON.parse((check.query("SELECT data FROM message WHERE id='m2'").get() as { data: string }).data)
  expect(m2.model).toEqual({ providerID: "openai", modelID: "gpt-5.4-mini" })
  check.close()
})

test("retargetOpencodeSessionModel refuses a non-sandbox db path", () => {
  expect(() =>
    retargetOpencodeSessionModel("/definitely/not/sandbox/opencode.db", "s1", { providerID: "openai", modelID: "x" }),
  ).toThrow("refusing to retarget")
})
