import { test, expect, afterEach } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import * as Log from "../../src/core/log"
import { PorterEventEmitter } from "../../src/core/events"
import type { ExportOutcome } from "../../src/core/orchestrator"
import { PortableSession, type HarnessId } from "../../src/ir"
import { withRunLogging } from "../../src/tui/wizard"

const FIXED_NOW = "2026-07-07T12:00:00.000Z"

const made: string[] = []
afterEach(() => {
  Log.setLogPath(undefined)
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

function tempLogPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omtuilog-"))
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

function makeSession(overrides: Partial<PortableSession> = {}): PortableSession {
  return PortableSession.parse({
    schemaVersion: "1.0.0",
    sourceHarness: "claude-code",
    sourceSessionId: "s1",
    sourcePath: "/tmp/x.jsonl",
    cwd: "/tmp/project",
    title: "a session",
    turns: [
      { role: "user", text: "hi" },
      { role: "assistant", text: "hello" },
    ],
    droppedTurns: 0,
    sourceMetadata: {},
    ...overrides,
  })
}

function outcome(overrides: Partial<ExportOutcome> = {}): ExportOutcome {
  return {
    sourceHarness: "claude-code",
    sourceSessionId: "s1",
    destHarness: "codex",
    status: "created",
    ...overrides,
  }
}

function makeOrchestrator(outcomes: ExportOutcome[]) {
  return {
    events: new PorterEventEmitter(),
    listSources: async (): Promise<HarnessId[]> => ["claude-code"],
    exportSessions: async (_dest: HarnessId, _sessions: PortableSession[], _opts?: { force?: boolean }) => outcomes,
  }
}

test("exportSessions through the wrapper writes one run line and passes outcomes through", async () => {
  const p = tempLogPath()
  const orch = makeOrchestrator([outcome(), outcome({ sourceSessionId: "s2", status: "skipped" })])
  const wrapped = withRunLogging(orch, Log.createRunLogger(() => FIXED_NOW))

  const result = await wrapped.exportSessions("codex", [makeSession(), makeSession({ sourceSessionId: "s2" })])

  expect(result).toHaveLength(2)
  const lines = readLines(p)
  expect(lines).toHaveLength(1)
  expect(lines[0]).toMatchObject({
    kind: "run",
    from: "claude-code",
    to: "codex",
    options: { all: false, ids: 2, force: false },
    counts: { created: 1, updated: 0, skipped: 1, error: 0 },
    status: "ok",
  })
})

test("the force flag lands in the run record's options", async () => {
  const p = tempLogPath()
  const wrapped = withRunLogging(makeOrchestrator([outcome()]), Log.createRunLogger(() => FIXED_NOW))
  await wrapped.exportSessions("codex", [makeSession()], { force: true })
  expect(readLines(p)[0]).toMatchObject({ options: { all: false, ids: 1, force: true } })
})

test("an empty batch writes no run line", async () => {
  const p = tempLogPath()
  const wrapped = withRunLogging(makeOrchestrator([]), Log.createRunLogger(() => FIXED_NOW))
  await wrapped.exportSessions("codex", [])
  expect(readLines(p)).toHaveLength(0)
})

test("error events on the wrapped orchestrator's stream are persisted", () => {
  const p = tempLogPath()
  const orch = makeOrchestrator([])
  withRunLogging(orch, Log.createRunLogger(() => FIXED_NOW))
  orch.events.emit({ type: "error", harness: "codex", sourceSessionId: "bad", message: "boom" })
  expect(readLines(p)[0]).toMatchObject({ kind: "error", harness: "codex", sourceSessionId: "bad" })
})

test("other members pass through untouched", async () => {
  tempLogPath()
  const orch = makeOrchestrator([])
  const wrapped = withRunLogging(orch, Log.createRunLogger(() => FIXED_NOW))
  expect(await wrapped.listSources()).toEqual(["claude-code"])
  expect(wrapped.events).toBe(orch.events)
})
