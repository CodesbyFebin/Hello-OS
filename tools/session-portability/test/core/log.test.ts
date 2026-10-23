import { test, expect, afterEach } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import * as Log from "../../src/core/log"
import { PorterEventEmitter } from "../../src/core/events"

const FIXED_NOW = "2026-07-07T12:00:00.000Z"

const made: string[] = []
afterEach(() => {
  delete process.env.HELLO_SESSIONS_LOG_PATH
  delete process.env.HELLO_SESSIONS_LOG
  delete process.env.DO_NOT_TRACK
  Log.setLogPath(undefined)
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

function tempLogPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omlog-"))
  made.push(dir)
  const p = path.join(dir, "runs.jsonl")
  Log.setLogPath(p)
  return p
}

function readLines(p: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(p)) return []
  return fs
    .readFileSync(p, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>)
}

function summary(overrides?: Partial<Log.RunSummary>): Log.RunSummary {
  return {
    from: "claude-code",
    to: "codex",
    options: { all: true, ids: 0, force: false },
    counts: { created: 2, updated: 0, skipped: 1, error: 0 },
    durationMs: 1234,
    cliVersion: "0.1.0",
    status: "ok",
    ...overrides,
  }
}

// --- enablement ---------------------------------------------------------------

test("loggingEnabled is true by default", () => {
  expect(Log.loggingEnabled()).toBe(true)
})

test("DO_NOT_TRACK=1 disables logging", () => {
  process.env.DO_NOT_TRACK = "1"
  expect(Log.loggingEnabled()).toBe(false)
})

test("HELLO_SESSIONS_LOG=0 disables logging", () => {
  process.env.HELLO_SESSIONS_LOG = "0"
  expect(Log.loggingEnabled()).toBe(false)
})

test("disabled logger writes nothing", () => {
  const p = tempLogPath()
  process.env.DO_NOT_TRACK = "1"
  const logger = Log.createRunLogger(() => FIXED_NOW)
  const events = new PorterEventEmitter()
  logger.attach(events)
  events.emit({ type: "error", harness: "codex", sourceSessionId: "s1", message: "boom" })
  logger.finishRun(summary())
  logger.logCrash(new Error("crash"))
  expect(fs.existsSync(p)).toBe(false)
})

// --- path resolution ------------------------------------------------------------

test("HELLO_SESSIONS_LOG_PATH redirects the log file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omlog-"))
  made.push(dir)
  const p = path.join(dir, "custom.jsonl")
  process.env.HELLO_SESSIONS_LOG_PATH = p
  expect(Log.getLogPath()).toBe(p)
})

test("explicit setLogPath wins over the env seam", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omlog-"))
  made.push(dir)
  process.env.HELLO_SESSIONS_LOG_PATH = path.join(dir, "env.jsonl")
  Log.setLogPath(path.join(dir, "explicit.jsonl"))
  expect(Log.getLogPath()).toBe(path.join(dir, "explicit.jsonl"))
})

test("default log path lives under the shared data dir next to the ledger", () => {
  expect(Log.getLogPath()).toBe(path.join(Log.defaultDataDir(), "logs", "runs.jsonl"))
})

// --- event sink ------------------------------------------------------------------

test("attach persists error events with harness and session id", () => {
  const p = tempLogPath()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  const events = new PorterEventEmitter()
  logger.attach(events)
  events.emit({ type: "error", harness: "codex", sourceSessionId: "s1", message: "parse failed" })
  const lines = readLines(p)
  expect(lines).toHaveLength(1)
  expect(lines[0]).toEqual({
    at: FIXED_NOW,
    kind: "error",
    harness: "codex",
    sourceSessionId: "s1",
    message: "parse failed",
  })
})

test("attach ignores progress and start/done events", () => {
  const p = tempLogPath()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  const events = new PorterEventEmitter()
  logger.attach(events)
  events.emit({ type: "import:start", harness: "codex", total: 3 })
  events.emit({ type: "import:progress", harness: "codex", sourceSessionId: "s1", current: 1, total: 3 })
  events.emit({ type: "import:done", harness: "codex", current: 3, total: 3 })
  events.emit({ type: "export:progress", harness: "opencode", current: 1, total: 3 })
  expect(readLines(p)).toHaveLength(0)
})

test("attach returns an unsubscribe function", () => {
  const p = tempLogPath()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  const events = new PorterEventEmitter()
  const off = logger.attach(events)
  off()
  events.emit({ type: "error", harness: "codex", sourceSessionId: "s1", message: "boom" })
  expect(readLines(p)).toHaveLength(0)
})

test("error events persist the stack when present", () => {
  const p = tempLogPath()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  const events = new PorterEventEmitter()
  logger.attach(events)
  events.emit({
    type: "error",
    harness: "codex",
    sourceSessionId: "s1",
    message: "boom",
    stack: "Error: boom\n    at parse (file.ts:1:1)",
  })
  const [line] = readLines(p)
  expect(line!.stack).toBe("Error: boom\n    at parse (file.ts:1:1)")
})

// --- run summary -------------------------------------------------------------------

test("finishRun writes exactly one run line", () => {
  const p = tempLogPath()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  logger.finishRun(summary({ status: "partial", counts: { created: 1, updated: 0, skipped: 0, error: 1 } }))
  const lines = readLines(p)
  expect(lines).toHaveLength(1)
  expect(lines[0]).toEqual({
    at: FIXED_NOW,
    kind: "run",
    from: "claude-code",
    to: "codex",
    options: { all: true, ids: 0, force: false },
    counts: { created: 1, updated: 0, skipped: 0, error: 1 },
    durationMs: 1234,
    cliVersion: "0.1.0",
    status: "partial",
  })
})

// --- crash ---------------------------------------------------------------------------

test("logCrash records message and stack from an Error", () => {
  const p = tempLogPath()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  const err = new Error("kaboom")
  logger.logCrash(err)
  const [line] = readLines(p)
  expect(line!.kind).toBe("crash")
  expect(line!.at).toBe(FIXED_NOW)
  expect(line!.message).toBe("kaboom")
  expect(String(line!.stack)).toContain("kaboom")
})

test("logCrash tolerates non-Error values", () => {
  const p = tempLogPath()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  logger.logCrash("string failure")
  const [line] = readLines(p)
  expect(line!.kind).toBe("crash")
  expect(line!.message).toBe("string failure")
})

// --- redaction (the load-bearing privacy tests) ---------------------------------------

test("home directory is scrubbed to ~ in messages and stacks", () => {
  const p = tempLogPath()
  const home = os.homedir()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  const events = new PorterEventEmitter()
  logger.attach(events)
  events.emit({
    type: "error",
    harness: "codex",
    sourceSessionId: "s1",
    message: `ENOENT: no such file ${home}/.codex/sessions/x.jsonl`,
    stack: `Error\n    at read (${home}/project/src/a.ts:1:1)`,
  })
  const [line] = readLines(p)
  expect(String(line!.message)).not.toContain(home)
  expect(String(line!.message)).toContain("~/.codex/sessions/x.jsonl")
  expect(String(line!.stack)).not.toContain(home)
})

test("logCrash scrubs the home directory too", () => {
  const p = tempLogPath()
  const home = os.homedir()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  logger.logCrash(new Error(`cannot open ${home}/.claude/projects/foo`))
  const [line] = readLines(p)
  expect(String(line!.message)).not.toContain(home)
})

test("messages are truncated to 500 chars and stacks to 2000", () => {
  const p = tempLogPath()
  const logger = Log.createRunLogger(() => FIXED_NOW)
  const events = new PorterEventEmitter()
  logger.attach(events)
  events.emit({
    type: "error",
    harness: "codex",
    sourceSessionId: "s1",
    message: "m".repeat(1000),
    stack: "s".repeat(5000),
  })
  const [line] = readLines(p)
  expect(String(line!.message).length).toBeLessThanOrEqual(500)
  expect(String(line!.stack).length).toBeLessThanOrEqual(2000)
})

// --- outcome summarization ---------------------------------------------------------------

test("summarizeOutcomes counts every status and reports ok when nothing errored", () => {
  expect(
    Log.summarizeOutcomes([{ status: "created" }, { status: "created" }, { status: "skipped" }, { status: "updated" }]),
  ).toEqual({
    counts: { created: 2, updated: 1, skipped: 1, error: 0 },
    status: "ok",
  })
})

test("summarizeOutcomes reports partial when any session errored", () => {
  expect(Log.summarizeOutcomes([{ status: "created" }, { status: "error" }])).toEqual({
    counts: { created: 1, updated: 0, skipped: 0, error: 1 },
    status: "partial",
  })
})

// --- rotation ---------------------------------------------------------------------------

test("a log over 5MB rotates to .1 and starts fresh", () => {
  const p = tempLogPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, "x".repeat(5 * 1024 * 1024 + 1))
  const logger = Log.createRunLogger(() => FIXED_NOW)
  logger.finishRun(summary())
  expect(fs.existsSync(`${p}.1`)).toBe(true)
  expect(readLines(p)).toHaveLength(1)
})

test("rotation overwrites a previous .1 generation", () => {
  const p = tempLogPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(`${p}.1`, "old generation")
  fs.writeFileSync(p, "x".repeat(5 * 1024 * 1024 + 1))
  const logger = Log.createRunLogger(() => FIXED_NOW)
  logger.finishRun(summary())
  expect(fs.readFileSync(`${p}.1`, "utf8")).not.toBe("old generation")
})
