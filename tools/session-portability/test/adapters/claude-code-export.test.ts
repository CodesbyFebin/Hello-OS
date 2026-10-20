import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"

import {
  claudeCodeExport,
  buildTranscript,
  encodeCwd,
  toIsoMs,
  setProjectsRoot,
  PORTER_VERSION,
  DEFAULT_MODEL,
  type ClaudeExportOptions,
} from "../../src/adapters/claude-code/export"
import { parseSessionFile } from "../../src/adapters/claude-code/parser"
import type { PortableSession } from "../../src/ir"

// --- test scaffolding -------------------------------------------------------

let tmpRoot: string
let projectsRoot: string

function opts(extra?: Partial<ClaudeExportOptions>): ClaudeExportOptions {
  return { projectsRoot, ...extra }
}

function makeSession(over?: Partial<PortableSession>): PortableSession {
  return {
    schemaVersion: "1.0.0",
    sourceHarness: "opencode",
    sourceSessionId: "ses_" + Math.random().toString(36).slice(2),
    sourcePath: "/tmp/whatever.json",
    cwd: "/Users/dev/project",
    title: "test session",
    turns: [
      { role: "user", text: "hello there", timestamp: 1_700_000_000_000 },
      { role: "assistant", text: "hi! how can I help?", timestamp: 1_700_000_001_000, model: "claude-sonnet-4" },
      { role: "user", text: "write a haiku", timestamp: 1_700_000_002_000 },
      { role: "assistant", text: "silent code compiles\ntests turn green in morning light\nship it to prod now", timestamp: 1_700_000_003_000 },
    ],
    droppedTurns: 0,
    sourceMetadata: { gitBranch: "main" },
    ...over,
  }
}

/** Count *.jsonl files under a project dir (ignores temp/dotfiles). */
function listJsonl(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
}

function projectDirFor(session: PortableSession): string {
  return path.join(projectsRoot, encodeCwd(session.cwd))
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cc-export-"))
  projectsRoot = path.join(tmpRoot, "projects")
  fs.mkdirSync(projectsRoot, { recursive: true })
  setProjectsRoot(projectsRoot)
})

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
  setProjectsRoot(undefined)
})

// --- unit: helpers ----------------------------------------------------------

describe("helpers", () => {
  test("encodeCwd replaces every slash with a dash (leading slash included)", () => {
    expect(encodeCwd("/Users/dev/project")).toBe("-Users-dev-project")
    expect(encodeCwd("/")).toBe("-")
  })

  test("toIsoMs renders epoch-ms as ISO-8601 UTC and defaults to now", () => {
    expect(toIsoMs(0)).toBe("1970-01-01T00:00:00.000Z")
    const now = toIsoMs()
    expect(Number.isNaN(Date.parse(now))).toBe(false)
  })
})

// --- unit: envelope builder + parentUuid chaining (criterion 2) -------------

describe("buildTranscript", () => {
  test("emits one line per turn with the correct envelope shape", () => {
    const s = makeSession()
    const lines = buildTranscript(s, "sess-1", "hello-sessions/test")
    expect(lines).toHaveLength(s.turns.length)

    for (const line of lines) {
      expect(line.sessionId).toBe("sess-1")
      expect(line.isSidechain).toBe(false)
      expect(line.isMeta).toBe(false)
      expect(line.cwd).toBe(s.cwd)
      expect(line.gitBranch).toBe("main")
      expect(line.version).toBe("hello-sessions/test")
      expect(typeof line.uuid).toBe("string")
      expect(Number.isNaN(Date.parse(line.timestamp as string))).toBe(false)
      // provenance stamp — the only way teardown() can find this file again now
      // that there is no adapter-level ledger (S8 owns idempotency, not us).
      expect(line.helloOsSource).toEqual({ harness: s.sourceHarness, sessionId: s.sourceSessionId })
    }
  })

  test("user vs assistant message shape", () => {
    const s = makeSession()
    const lines = buildTranscript(s, "sess-1")
    const user = lines[0] as any
    const assistant = lines[1] as any

    expect(user.type).toBe("user")
    expect(user.message).toEqual({ role: "user", content: "hello there" })

    expect(assistant.type).toBe("assistant")
    expect(assistant.message.role).toBe("assistant")
    expect(assistant.message.model).toBe("claude-sonnet-4")
    expect(assistant.message.content).toEqual([{ type: "text", text: "hi! how can I help?" }])
    expect(assistant.message.stop_reason).toBe("end_turn")
  })

  test("assistant model falls back to DEFAULT_MODEL", () => {
    const s = makeSession({
      turns: [
        { role: "user", text: "q" },
        { role: "assistant", text: "a" },
      ],
    })
    const lines = buildTranscript(s, "sess-1")
    expect((lines[1] as any).message.model).toBe(DEFAULT_MODEL)
  })

  test("parentUuid chains: line0=null, lineN.parentUuid==line(N-1).uuid; all uuids unique", () => {
    const s = makeSession()
    const lines = buildTranscript(s, "sess-1")
    expect(lines[0]!.parentUuid).toBeNull()
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]!.parentUuid).toBe(lines[i - 1]!.uuid)
    }
    const uuids = new Set(lines.map((l) => l.uuid as string))
    expect(uuids.size).toBe(lines.length)
  })

  test("gitBranch defaults to empty string when absent from sourceMetadata", () => {
    const s = makeSession({ sourceMetadata: {} })
    const lines = buildTranscript(s, "sess-1")
    expect(lines[0]!.gitBranch).toBe("")
  })
})

// --- integration: write produces a valid file (criteria 1 & 2) --------------

describe("write()", () => {
  test("criterion 1: writes <uuid>.jsonl under projects/<encode(cwd)>/ with one line per turn", async () => {
    const s = makeSession()
    const res = await claudeCodeExport.write(s, opts())
    expect(res.skipped).toBe(false)

    const dir = projectDirFor(s)
    const files = listJsonl(dir)
    expect(files).toHaveLength(1)
    expect(files[0]).toBe(`${res.destSessionId}.jsonl`)

    const raw = fs.readFileSync(path.join(dir, files[0]!), "utf8")
    const lines = raw.split("\n").filter(Boolean)
    expect(lines).toHaveLength(s.turns.length)
  })

  test("criterion 2 (on disk): fresh uuids, chained parents, null head", async () => {
    const s = makeSession()
    const res = await claudeCodeExport.write(s, opts())
    const dir = projectDirFor(s)
    const raw = fs.readFileSync(path.join(dir, `${res.destSessionId}.jsonl`), "utf8")
    const objs = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l))

    expect(objs[0].parentUuid).toBeNull()
    for (let i = 1; i < objs.length; i++) {
      expect(objs[i].parentUuid).toBe(objs[i - 1].uuid)
    }
    for (const o of objs) {
      expect(o.sessionId).toBe(res.destSessionId)
      expect(o.version).toBe(PORTER_VERSION)
    }
  })

  test("no leftover temp files after a successful write", async () => {
    const s = makeSession()
    await claudeCodeExport.write(s, opts())
    const dir = projectDirFor(s)
    const leftovers = fs.readdirSync(dir).filter((f) => f.endsWith(".tmp") || f.startsWith("."))
    expect(leftovers).toHaveLength(0)
  })

  test("every write() call is unconditional: two calls for the same source session create two files", async () => {
    // S8 revision: the adapter owns no ledger/skip logic — the orchestrator
    // decides whether to call write() at all. A second call always writes again.
    const s = makeSession()
    const first = await claudeCodeExport.write(s, opts())
    const second = await claudeCodeExport.write(s, opts())
    expect(second.skipped).toBe(false)
    expect(second.destSessionId).not.toBe(first.destSessionId)
    expect(listJsonl(projectDirFor(s))).toHaveLength(2)
  })
})

// --- integration: re-import parity (criterion 3) ----------------------------

describe("re-import parity (criterion 3)", () => {
  test("re-parsing the synthesized file yields identical turn count + text, 0 dropped", async () => {
    const s = makeSession()
    const res = await claudeCodeExport.write(s, opts())
    const filePath = path.join(projectDirFor(s), `${res.destSessionId}.jsonl`)

    const reparsed = parseSessionFile(filePath)
    expect(reparsed.turns).toHaveLength(s.turns.length)
    expect(reparsed.skippedToolOnly).toBe(0)

    for (let i = 0; i < s.turns.length; i++) {
      expect(reparsed.turns[i]!.role).toBe(s.turns[i]!.role)
      expect(reparsed.turns[i]!.text).toBe(s.turns[i]!.text)
    }
    expect(reparsed.directory).toBe(s.cwd)
  })
})

// --- integration: update-in-place + teardown (S8 revision) ------------------

describe("existingDestId (update in place, S8)", () => {
  test("passing opts.existingDestId overwrites the same file in place, keeping the id", async () => {
    const s = makeSession()
    const first = await claudeCodeExport.write(s, opts())
    const dir = projectDirFor(s)
    expect(listJsonl(dir)).toHaveLength(1)

    const grown = makeSession({
      sourceSessionId: s.sourceSessionId,
      cwd: s.cwd,
      turns: [...s.turns, { role: "user", text: "one more turn", timestamp: 1_700_000_004_000 }],
    })
    const updated = await claudeCodeExport.write(grown, opts({ existingDestId: first.destSessionId }))

    expect(updated.skipped).toBe(false)
    expect(updated.destSessionId).toBe(first.destSessionId)
    expect(listJsonl(dir)).toHaveLength(1) // same file, not a second one

    const raw = fs.readFileSync(path.join(dir, `${updated.destSessionId}.jsonl`), "utf8")
    const lines = raw.split("\n").filter(Boolean)
    expect(lines).toHaveLength(grown.turns.length)
  })
})

describe("teardown (S8: scan-based, no adapter ledger)", () => {
  test("teardown removes the file (found via the helloOsSource provenance stamp)", async () => {
    const s = makeSession()
    const res = await claudeCodeExport.write(s, opts())
    const dir = projectDirFor(s)
    expect(listJsonl(dir)).toHaveLength(1)

    await claudeCodeExport.teardown(s.sourceSessionId)
    expect(listJsonl(dir)).toHaveLength(0)

    const second = await claudeCodeExport.write(s, opts())
    expect(second.skipped).toBe(false)
    expect(second.destSessionId).not.toBe(res.destSessionId)
    expect(listJsonl(dir)).toHaveLength(1)
  })

  test("teardown on an unknown id is a no-op (no throw)", async () => {
    await expect(claudeCodeExport.teardown("nope")).resolves.toBeUndefined()
  })

  test("teardown only removes files stamped with the matching sourceSessionId", async () => {
    const a = makeSession()
    const b = makeSession({ cwd: a.cwd })
    await claudeCodeExport.write(a, opts())
    await claudeCodeExport.write(b, opts())
    expect(listJsonl(projectDirFor(a))).toHaveLength(2)

    await claudeCodeExport.teardown(a.sourceSessionId)
    expect(listJsonl(projectDirFor(a))).toHaveLength(1)
  })
})

// --- edge cases (criterion 7) -----------------------------------------------

describe("edge cases (criterion 7)", () => {
  test("empty cwd is rejected with a clear message and leaves no file", async () => {
    const s = makeSession({ cwd: "" })
    await expect(claudeCodeExport.write(s, opts())).rejects.toThrow(/cwd is empty/)
    // nothing created anywhere under the projects root
    expect(fs.readdirSync(projectsRoot)).toHaveLength(0)
  })

  test("zero-turn session is skipped with a clear message and leaves no file", async () => {
    const s = makeSession({ turns: [] })
    const res = await claudeCodeExport.write(s, opts())
    expect(res.skipped).toBe(true)
    expect(res.reason).toMatch(/zero-turn/)
    expect(listJsonl(projectDirFor(s))).toHaveLength(0)
  })
})

// --- detect -----------------------------------------------------------------

describe("detect()", () => {
  test("true when the projects root exists and is writable", async () => {
    expect(await claudeCodeExport.detect(opts())).toBe(true)
  })

  test("true when root is missing but the parent is writable (creatable)", async () => {
    const missing = path.join(tmpRoot, "brand", "new", "projects")
    fs.mkdirSync(path.dirname(missing), { recursive: true })
    expect(await claudeCodeExport.detect({ projectsRoot: missing })).toBe(true)
  })

  test("false when neither root nor its parent exist", async () => {
    const nowhere = path.join(tmpRoot, "does", "not", "exist", "projects")
    expect(await claudeCodeExport.detect({ projectsRoot: nowhere })).toBe(false)
  })
})

// --- E2E round-trip via a real ~/.claude session (criterion: E2E) -----------

describe("E2E round-trip", () => {
  test("real ~/.claude session -> import -> export -> re-import preserves text turns", async () => {
    const home = os.homedir()
    const realRoot = path.join(home, ".claude", "projects")
    if (!fs.existsSync(realRoot)) {
      // No local Claude install — skip gracefully rather than fail CI.
      return
    }
    // find one non-subagent .jsonl
    const stack = [realRoot]
    let sample: string | undefined
    while (stack.length && !sample) {
      const d = stack.pop()!
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name)
        if (e.isDirectory()) {
          if (e.name !== "subagents") stack.push(full)
        } else if (e.name.endsWith(".jsonl") && !full.includes("/subagents/")) {
          sample = full
          break
        }
      }
    }
    if (!sample) return

    const source = parseSessionFile(sample)
    if (source.turns.length === 0) return

    const session: PortableSession = {
      schemaVersion: "1.0.0",
      sourceHarness: "claude-code",
      sourceSessionId: "e2e_" + source.claudeSessionID,
      sourcePath: source.sourcePath,
      cwd: source.directory,
      title: source.title,
      turns: source.turns.map((t) => ({ role: t.role, text: t.text, timestamp: t.timestamp, model: t.model })),
      droppedTurns: source.skippedToolOnly,
      sourceMetadata: {},
    }

    const res = await claudeCodeExport.write(session, opts())
    const outPath = path.join(projectDirFor(session), `${res.destSessionId}.jsonl`)
    const reparsed = parseSessionFile(outPath)

    expect(reparsed.turns).toHaveLength(source.turns.length)
    for (let i = 0; i < source.turns.length; i++) {
      expect(reparsed.turns[i]!.text).toBe(source.turns[i]!.text)
      expect(reparsed.turns[i]!.role).toBe(source.turns[i]!.role)
    }
  })
})
