// S5 — Codex EXPORT adapter tests (revised for S8).
//
// Every test redirects the adapter at a mktemp CODEX_HOME (AC6) so the real
// ~/.codex is never touched. Covers all S5 acceptance criteria; the AC3 "does real
// Codex surface it" round-trip is a MANUAL gate (documented below) — the automated
// proxy for AC3 is the register-mode fallback + the S2 re-import parity check.
//
// S8 revision: this adapter owns no ledger of its own — write() is unconditional
// (always synthesizes a rollout) and update-in-place / teardown are driven by
// `opts.existingDestId` / a provenance scan, not a private ledger file.

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import * as childProcess from "child_process"
import crypto from "crypto"
import fs from "fs"
import os from "os"
import path from "path"

import { PortableSession } from "../../src/ir"
import {
  buildMessageEvent,
  buildMessageItem,
  buildRolloutRecords,
  buildSessionMeta,
  buildTurnContext,
  codexExport,
  configureCodexExport,
  formatRolloutTimestamp,
  isDefaultCodexHome,
  resetCodexExportConfig,
  uuidv7,
} from "../../src/adapters/codex/export"

const T0 = Date.parse("2025-06-15T12:34:56.000Z")

function sampleSession(overrides: Partial<PortableSession> = {}): PortableSession {
  return PortableSession.parse({
    schemaVersion: "1.0.0",
    sourceHarness: "claude-code",
    sourceSessionId: "src-session-123",
    sourcePath: "/tmp/source.jsonl",
    cwd: "/home/user/project",
    title: "[claude-code] hello codex",
    createdAt: T0,
    updatedAt: T0,
    turns: [
      { role: "user", text: "hello codex", timestamp: T0 },
      { role: "assistant", text: "hi there, human", timestamp: T0 + 1000 },
      { role: "user", text: "second question", timestamp: T0 + 2000 },
    ],
    droppedTurns: 0,
    sourceMetadata: { model_provider: "openai" },
    ...overrides,
  })
}

function readRecords(file: string): any[] {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
}

let home: string

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-home-"))
  fs.mkdirSync(path.join(home, "sessions"), { recursive: true })
  configureCodexExport({ codexHome: home, mode: "rollout", appendHistory: false })
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
  resetCodexExportConfig()
})

// ---------------------------------------------------------------------------
// Unit — builders, timestamp, uuidv7
// ---------------------------------------------------------------------------

describe("uuidv7", () => {
  test("has v7 version nibble and RFC variant, canonical shape", () => {
    const id = uuidv7(T0)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  test("encodes the millisecond timestamp in the 48-bit prefix", () => {
    const id = uuidv7(T0)
    const prefixHex = id.replace(/-/g, "").slice(0, 12)
    expect(parseInt(prefixHex, 16)).toBe(T0)
  })
  test("is unique across calls", () => {
    const set = new Set(Array.from({ length: 100 }, () => uuidv7()))
    expect(set.size).toBe(100)
  })
})

describe("formatRolloutTimestamp", () => {
  test("YYYY-MM-DDTHH-MM-SS with colons replaced", () => {
    expect(formatRolloutTimestamp(T0)).toBe("2025-06-15T12-34-56")
  })
})

describe("record builders", () => {
  test("session_meta carries ownership + provenance fields", () => {
    const rec = buildSessionMeta(sampleSession(), "id-1", T0, "hello-sessions/test")
    expect(rec.type).toBe("session_meta")
    expect(rec.payload.session_id).toBe("id-1")
    expect(rec.payload.id).toBe("id-1")
    expect(rec.payload.originator).toBe("hello-sessions")
    // "cli" (not "import") so codex's resume picker reconciles threads.source
    // to a listable value instead of "unknown". See export.ts buildSessionMeta.
    expect(rec.payload.source).toBe("cli")
    expect(rec.payload.cwd).toBe("/home/user/project")
    expect(rec.payload.cli_version).toBe("hello-sessions/test")
    expect(rec.payload.model_provider).toBe("openai")
    expect(rec.timestamp).toBe(new Date(T0).toISOString())
    // S8: provenance stamp used by teardown()'s scan (no adapter-level ledger).
    expect(rec.payload.imported_source_session_id).toBe("src-session-123")
    expect(rec.payload.imported_source_harness).toBe("claude-code")
  })

  test("model_provider defaults to openai when metadata lacks it", () => {
    const s = sampleSession({ sourceMetadata: {} })
    expect(buildSessionMeta(s, "id-1", T0).payload.model_provider).toBe("openai")
  })

  test("model_provider honors metadata override", () => {
    const s = sampleSession({ sourceMetadata: { model_provider: "anthropic" } })
    expect(buildSessionMeta(s, "id-1", T0).payload.model_provider).toBe("anthropic")
  })

  test("turn_context carries cwd + workspace roots", () => {
    const rec = buildTurnContext(sampleSession(), T0)
    expect(rec.type).toBe("turn_context")
    expect(rec.payload.cwd).toBe("/home/user/project")
    expect(rec.payload.workspace_roots).toEqual(["/home/user/project"])
  })

  test("user message uses input_text, assistant uses output_text", () => {
    const u = buildMessageItem("user", "hi", T0)
    const a = buildMessageItem("assistant", "yo", T0)
    expect(u.payload).toMatchObject({ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] })
    expect(a.payload).toMatchObject({ type: "message", role: "assistant", content: [{ type: "output_text", text: "yo" }] })
  })

  test("event_msg mirror carries user_message/agent_message — the field codex derives preview from", () => {
    const u = buildMessageEvent("user", "hello there", T0)
    const a = buildMessageEvent("assistant", "hi back", T0)
    expect(u.type).toBe("event_msg")
    expect(u.payload).toMatchObject({ type: "user_message", message: "hello there" })
    expect(a.payload).toMatchObject({ type: "agent_message", message: "hi back" })
  })

  test("rollout emits a user_message event so codex populates a non-empty preview", () => {
    const recs = buildRolloutRecords(sampleSession(), "id-1", T0)
    const firstUserEvent = recs.find(
      (r) => r.type === "event_msg" && (r.payload as { type?: string }).type === "user_message",
    )
    expect(firstUserEvent).toBeDefined()
    expect((firstUserEvent!.payload as { message?: string }).message).toBeTruthy()
    // response_item message is still present (round-trip fidelity for our importer).
    expect(recs.some((r) => r.type === "response_item")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC1 — schema-valid rollout: leading session_meta, one turn_context, one message/turn
// ---------------------------------------------------------------------------

describe("write() rollout shape (AC1)", () => {
  test("produces rollout-<ts>-<uuidv7>.jsonl in the date shard with correct record order", async () => {
    const session = sampleSession()
    const res = await codexExport.write(session)
    expect(res.skipped).toBe(false)

    const expectedFile = path.join(
      home,
      "sessions",
      "2025",
      "06",
      "15",
      `rollout-2025-06-15T12-34-56-${res.destSessionId}.jsonl`,
    )
    expect(fs.existsSync(expectedFile)).toBe(true)
    expect(res.destSessionId).toMatch(/^[0-9a-f-]{36}$/)

    const records = readRecords(expectedFile)
    expect(records[0].type).toBe("session_meta")
    expect(records[0].payload.originator).toBe("hello-sessions")
    expect(records.filter((r) => r.type === "turn_context").length).toBe(1)

    const messages = records.filter((r) => r.type === "response_item")
    expect(messages.length).toBe(session.turns.length)
    expect(messages[0].payload).toMatchObject({ role: "user", content: [{ type: "input_text", text: "hello codex" }] })
    expect(messages[1].payload).toMatchObject({
      role: "assistant",
      content: [{ type: "output_text", text: "hi there, human" }],
    })
    expect(messages[2].payload).toMatchObject({ role: "user", content: [{ type: "input_text", text: "second question" }] })

    // Every record has an ISO-ms envelope timestamp.
    for (const r of records) expect(typeof r.timestamp).toBe("string")
  })
})

// ---------------------------------------------------------------------------
// AC2 — re-import via S2 yields turn/text parity, droppedTurns == 0 (conditional)
// ---------------------------------------------------------------------------

describe("re-import parity via S2 (AC2)", () => {
  test("S2 codex import round-trips turn count + per-turn text", async () => {
    const importFile = path.join(import.meta.dir, "../../src/adapters/codex/import.ts")
    if (!fs.existsSync(importFile)) {
      console.warn("[S5 AC2] SKIPPED — S2 codex import (src/adapters/codex/import.ts) not present yet.")
      return
    }

    const mod: any = await import("../../src/adapters/codex/import")
    const importer = mod.codexImport ?? Object.values(mod).find((v: any) => v?.harness === "codex" && typeof v?.parse === "function")
    if (!importer) {
      console.warn("[S5 AC2] SKIPPED — codex import module present but no ImportAdapter export found.")
      return
    }

    const session = sampleSession()
    const res = await codexExport.write(session)
    const file = path.join(
      home,
      "sessions",
      "2025",
      "06",
      "15",
      `rollout-2025-06-15T12-34-56-${res.destSessionId}.jsonl`,
    )

    const reparsed: PortableSession = await importer.parse({
      harness: "codex",
      sourceSessionId: res.destSessionId,
      sourcePath: file,
      title: "",
    })

    expect(reparsed.turns.length).toBe(session.turns.length)
    expect(reparsed.droppedTurns).toBe(0)
    reparsed.turns.forEach((t, i) => {
      expect(t.role).toBe(session.turns[i]!.role)
      expect(t.text).toBe(session.turns[i]!.text)
    })
    expect(reparsed.cwd).toBe(session.cwd)
  })
})

// ---------------------------------------------------------------------------
// AC4 (revised for S8) — write() is unconditional; existingDestId updates in place
// ---------------------------------------------------------------------------

describe("write() is unconditional; existingDestId updates in place (AC4, S8 revision)", () => {
  test("two calls with no opts create two independent rollout files (no adapter-level skip)", async () => {
    const session = sampleSession()
    const first = await codexExport.write(session)
    const shardDir = path.join(home, "sessions", "2025", "06", "15")
    const filesAfterFirst = fs.readdirSync(shardDir).filter((f) => f.startsWith("rollout-"))

    const second = await codexExport.write(session)
    expect(second.skipped).toBe(false)
    expect(second.destSessionId).not.toBe(first.destSessionId)

    const filesAfterSecond = fs.readdirSync(shardDir).filter((f) => f.startsWith("rollout-"))
    expect(filesAfterSecond.length).toBe(filesAfterFirst.length + 1)
  })

  test("opts.existingDestId overwrites the SAME rollout file in place, keeping the id", async () => {
    const session = sampleSession()
    const first = await codexExport.write(session)
    const shardDir = path.join(home, "sessions", "2025", "06", "15")

    const grown = sampleSession({
      turns: [...session.turns, { role: "assistant", text: "one more turn", timestamp: T0 + 3000 }],
    })
    const second = await codexExport.write(grown, { existingDestId: first.destSessionId })
    expect(second.skipped).toBe(false)
    expect(second.destSessionId).toBe(first.destSessionId)

    const rollouts = fs.readdirSync(shardDir).filter((f) => f.startsWith("rollout-"))
    expect(rollouts.length).toBe(1) // same file rewritten, not a second one
    expect(rollouts[0]).toContain(second.destSessionId)

    const records = readRecords(path.join(shardDir, rollouts[0]!))
    expect(records.filter((r) => r.type === "response_item").length).toBe(grown.turns.length)
  })
})

// ---------------------------------------------------------------------------
// AC5 — teardown fully removes artifact (found via provenance scan, not a ledger)
// ---------------------------------------------------------------------------

describe("teardown (AC5, S8: scan-based)", () => {
  test("removes the rollout file; a subsequent write is a fresh create", async () => {
    const session = sampleSession()
    const res = await codexExport.write(session)
    const file = path.join(
      home,
      "sessions",
      "2025",
      "06",
      "15",
      `rollout-2025-06-15T12-34-56-${res.destSessionId}.jsonl`,
    )
    expect(fs.existsSync(file)).toBe(true)

    await codexExport.teardown(session.sourceSessionId)
    expect(fs.existsSync(file)).toBe(false)

    const again = await codexExport.write(session)
    expect(again.skipped).toBe(false)
    expect(again.destSessionId).not.toBe(res.destSessionId)
  })

  test("refuses to delete a rollout it does not own (no originator marker)", async () => {
    const session = sampleSession()
    const res = await codexExport.write(session)
    const file = path.join(
      home,
      "sessions",
      "2025",
      "06",
      "15",
      `rollout-2025-06-15T12-34-56-${res.destSessionId}.jsonl`,
    )
    // Overwrite with a foreign rollout (no hello-sessions originator, no provenance stamp).
    fs.writeFileSync(file, JSON.stringify({ type: "session_meta", payload: { originator: "codex" } }) + "\n")

    await codexExport.teardown(session.sourceSessionId)
    expect(fs.existsSync(file)).toBe(true) // preserved — not ours to delete
  })
})

// ---------------------------------------------------------------------------
// AC6 — CODEX_HOME redirection + detect
// ---------------------------------------------------------------------------

describe("detect + CODEX_HOME (AC6)", () => {
  test("detect true when sessions dir is writable under the configured home", async () => {
    expect(await codexExport.detect()).toBe(true)
  })

  test("detect false when the configured home does not exist", async () => {
    configureCodexExport({ codexHome: path.join(os.tmpdir(), "definitely-missing-codex-" + Date.now()) })
    expect(await codexExport.detect()).toBe(false)
  })

  test("write stays entirely under the temp home (never ~/.codex)", async () => {
    const res = await codexExport.write(sampleSession())
    expect(res.skipped).toBe(false)
    // Everything is under `home`.
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
      )
    const files = walk(home)
    expect(files.some((f) => f.includes(path.join("sessions", "2025", "06", "15")))).toBe(true)
    for (const f of files) expect(f.startsWith(home)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Safe write — symlink refusal
// ---------------------------------------------------------------------------

describe("safe write (symlink refusal)", () => {
  test("refuses when a shard component is a symlink", async () => {
    // Make sessions/2025 a symlink to an outside dir.
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "codex-outside-"))
    const yearDir = path.join(home, "sessions", "2025")
    fs.symlinkSync(outside, yearDir)
    try {
      await expect(codexExport.write(sampleSession())).rejects.toThrow(/symlink/)
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })
})

// ---------------------------------------------------------------------------
// Native-import dedupe ledger (external_agent_session_imports.json) — keyed on
// the ORIGINAL Claude source so Codex's own import skips our ports (no dupes).
// ---------------------------------------------------------------------------

describe("claude-source import ledger", () => {
  const registryFile = () => path.join(home, "external_agent_session_imports.json")

  /** Write a fake Claude source .jsonl and return its path + known sha/mtime. */
  function makeClaudeSource(content = '{"type":"user","text":"hi"}\n'): {
    src: string
    sha: string
    mtimeNs: string
  } {
    const src = path.join(home, "claude-src.jsonl")
    fs.writeFileSync(src, content)
    const sha = crypto.createHash("sha256").update(fs.readFileSync(src)).digest("hex")
    const mtimeNs = fs.statSync(src, { bigint: true }).mtimeNs.toString()
    return { src, sha, mtimeNs }
  }

  test("registers keyed on the Claude source in {records:[]} shape; teardown reverts", async () => {
    const { src, sha, mtimeNs } = makeClaudeSource()
    const session = sampleSession({ sourceHarness: "claude-code", sourcePath: src })
    const res = await codexExport.write(session)

    expect(fs.existsSync(registryFile())).toBe(true)
    const parsed = JSON.parse(fs.readFileSync(registryFile(), "utf8"))
    expect(Array.isArray(parsed.records)).toBe(true) // Codex's real on-disk shape
    const rec = parsed.records.find((e: any) => e.imported_thread_id === res.destSessionId)
    expect(rec).toBeDefined()
    expect(rec.source_path).toBe(src) // the CLAUDE source, not our rollout
    expect(rec.content_sha256).toBe(sha) // sha256 of the raw source bytes
    expect(rec.source_modified_at).toBe(Number(mtimeNs)) // exact ns, no truncation
    expect(typeof rec.imported_at).toBe("number")

    await codexExport.teardown(session.sourceSessionId)
    const after = JSON.parse(fs.readFileSync(registryFile(), "utf8"))
    expect(after.records.some((e: any) => e.imported_thread_id === res.destSessionId)).toBe(false)
  })

  test("no-op for non-claude sources (nothing to dedupe against)", async () => {
    const session = sampleSession({ sourceHarness: "opencode", sourcePath: "/tmp/whatever.jsonl" })
    await codexExport.write(session)
    expect(fs.existsSync(registryFile())).toBe(false)
  })

  test("merges into Codex's existing records without truncating their ns mtimes", async () => {
    // Seed a pre-existing Codex record with an out-of-safe-range source_modified_at.
    const codexNs = "1783474926066218716"
    fs.writeFileSync(
      registryFile(),
      `{\n "records": [\n  {\n   "source_path": "/x.jsonl",\n   "content_sha256": "abc",\n   "imported_thread_id": "codex-1",\n   "imported_at": 1783475075,\n   "source_modified_at": ${codexNs}\n  }\n ]\n}`,
    )
    const { src } = makeClaudeSource()
    await codexExport.write(sampleSession({ sourceHarness: "claude-code", sourcePath: src }))

    // Codex's record must survive verbatim (exact ns preserved as a raw integer).
    const rawText = fs.readFileSync(registryFile(), "utf8")
    expect(rawText).toContain(`"source_modified_at": ${codexNs}`) // exact, not 1783474926066218800
    const parsed = JSON.parse(fs.readFileSync(registryFile(), "utf8"))
    expect(parsed.records.length).toBe(2)
    expect(parsed.records.some((e: any) => e.imported_thread_id === "codex-1")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// history.jsonl mirror (optional) + teardown revert
// ---------------------------------------------------------------------------

describe("history.jsonl mirror", () => {
  test("appends user turns when enabled and prunes them on teardown", async () => {
    configureCodexExport({ appendHistory: true })
    const session = sampleSession()
    const res = await codexExport.write(session)
    const historyFile = path.join(home, "history.jsonl")
    const lines = fs.readFileSync(historyFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    expect(lines.length).toBe(2) // two user turns
    expect(lines.every((l) => l.session_id === res.destSessionId)).toBe(true)

    await codexExport.teardown(session.sourceSessionId)
    const after = fs.readFileSync(historyFile, "utf8").split("\n").filter(Boolean)
    expect(after.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Desktop deep link safety — never fires from a redirected (test) home.
// ---------------------------------------------------------------------------

describe("desktop deep link gate", () => {
  test("isDefaultCodexHome: true only for ~/.codex", () => {
    expect(isDefaultCodexHome(path.join(os.homedir(), ".codex"))).toBe(true)
    expect(isDefaultCodexHome("/tmp/codex-home-xyz")).toBe(false)
    expect(isDefaultCodexHome(home)).toBe(false)
  })

  test("write() into a redirected home never spawns `open` (even if opted in)", async () => {
    // Double gate: the mktemp home is non-default AND we don't want the env
    // opt-in to matter here — a redirected store must stay inert regardless.
    const prev = process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP
    process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
    const spy = spyOn(childProcess, "spawn")
    try {
      await codexExport.write(sampleSession())
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
      if (prev === undefined) delete process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP
      else process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = prev
    }
  })
})
