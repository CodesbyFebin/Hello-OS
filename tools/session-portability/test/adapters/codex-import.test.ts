import { test, expect, describe, afterEach } from "bun:test"
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { codexImport } from "../../src/adapters/codex/import"
import { PortableSession } from "../../src/ir"
import type { SessionRef } from "../../src/adapter"
import { registerImport, getImport, _resetRegistry } from "../../src/registry"

const FIXTURE = new URL("../fixtures/codex-sample.jsonl", import.meta.url)
const fixturePath = decodeURIComponent(FIXTURE.pathname)

const ORIGINAL_CODEX_HOME = process.env.CODEX_HOME

afterEach(() => {
  if (ORIGINAL_CODEX_HOME === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = ORIGINAL_CODEX_HOME
  _resetRegistry()
})

function refFor(path: string, sessionId = "unknown"): SessionRef {
  return { harness: "codex", sourceSessionId: sessionId, sourcePath: path, title: "" }
}

/** Build a Codex-style CODEX_HOME with one rollout file under sessions/Y/M/D/. */
async function seedRollout(
  home: string,
  datePath: string,
  fileName: string,
  records: unknown[],
): Promise<string> {
  const dir = join(home, "sessions", datePath)
  await mkdir(dir, { recursive: true })
  const file = join(dir, fileName)
  await writeFile(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8")
  return file
}

describe("codexImport.parse — fixture", () => {
  test("AC1: parse() output passes PortableSession.parse()", async () => {
    const session = await codexImport.parse(refFor(fixturePath))
    // parse() already validates internally; re-validate to prove the contract.
    expect(() => PortableSession.parse(session)).not.toThrow()
    expect(session.schemaVersion).toBe("1.0.0")
    expect(session.sourceHarness).toBe("codex")
    expect(session.sourceSessionId).toBe("019f1aa6-8bb8-7e81-9217-000000000001")
    expect(session.cwd).toBe("/Users/demo/project")
    expect(session.title).toBe("input part A input part B")
    expect(session.sourceMetadata).toMatchObject({
      cli_version: "0.142.4",
      model_provider: "openai",
      originator: "codex-tui",
    })
  })

  test("AC2: user/assistant turns extracted in order; input_text/output_text joined", async () => {
    const s = await codexImport.parse(refFor(fixturePath))
    expect(s.turns).toEqual([
      expect.objectContaining({ role: "user", text: "input part A\ninput part B" }),
      expect.objectContaining({ role: "assistant", text: "output part A\noutput part B" }),
      expect.objectContaining({ role: "user", text: "second question" }),
      expect.objectContaining({ role: "assistant", text: "second answer" }),
    ])
    // Timestamps carried and monotonic.
    const ts = s.turns.map((t) => t.timestamp!)
    expect(ts.every((n, i) => i === 0 || n >= ts[i - 1]!)).toBe(true)
  })

  test("AC3: reasoning + custom_tool_call(_output) counted in droppedTurns, not stored", async () => {
    const s = await codexImport.parse(refFor(fixturePath))
    // reasoning(1) + custom_tool_call(1) + custom_tool_call_output(1) = 3
    expect(s.droppedTurns).toBe(3)
    // none of the dropped payloads leaked into turns
    const joined = s.turns.map((t) => t.text).join(" ")
    expect(joined).not.toContain("ls")
    expect(joined).not.toContain("file.txt")
  })

  test("AC4: developer excluded and no double-counting with event_msg mirror", async () => {
    const s = await codexImport.parse(refFor(fixturePath))
    // 4 real turns only — developer skipped, event_msg mirrors NOT re-added.
    expect(s.turns).toHaveLength(4)
    expect(s.turns.some((t) => t.text.includes("AGENTS.md"))).toBe(false)
  })

  test("invariant: turns.length + droppedTurns === raw conversational turns", async () => {
    const txt = await readFile(fixturePath, "utf8")
    const raw = txt
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((r) => {
        if (r.type !== "response_item") return false
        const t = r.payload?.type
        if (t === "message") return r.payload.role === "user" || r.payload.role === "assistant"
        return t === "reasoning" || t === "custom_tool_call" || t === "custom_tool_call_output"
      }).length
    const s = await codexImport.parse(refFor(fixturePath))
    expect(s.turns.length + s.droppedTurns).toBe(raw)
  })
})

describe("codexImport.parse — event_msg fallback guard", () => {
  test("session with only event_msg falls back to user_message/agent_message", async () => {
    const home = await mkdtemp(join(tmpdir(), "codex-fallback-"))
    const file = await seedRollout(home, "2026/06/30", "rollout-2026-06-30T10-00-00-eventonly.jsonl", [
      { timestamp: "2026-06-30T10:00:00.000Z", type: "session_meta", payload: { session_id: "evt-only-1", cwd: "/tmp/x", timestamp: "2026-06-30T10:00:00.000Z" } },
      { timestamp: "2026-06-30T10:00:01.000Z", type: "event_msg", payload: { type: "user_message", message: "hello from event" } },
      { timestamp: "2026-06-30T10:00:02.000Z", type: "event_msg", payload: { type: "agent_message", message: "hi back from event" } },
    ])
    const s = await codexImport.parse(refFor(file))
    expect(s.droppedTurns).toBe(0)
    expect(s.turns).toEqual([
      expect.objectContaining({ role: "user", text: "hello from event" }),
      expect.objectContaining({ role: "assistant", text: "hi back from event" }),
    ])
  })

  test("fallback does NOT fire when response_item turns exist (no double count)", async () => {
    // The main fixture has both response_item messages and event_msg mirrors.
    const s = await codexImport.parse(refFor(fixturePath))
    expect(s.turns).toHaveLength(4) // not 6
  })
})

describe("codexImport.detect + discover", () => {
  test("detect() true when CODEX_HOME/sessions exists, false otherwise", async () => {
    const withSessions = await mkdtemp(join(tmpdir(), "codex-detect-yes-"))
    await mkdir(join(withSessions, "sessions"), { recursive: true })
    process.env.CODEX_HOME = withSessions
    expect(await codexImport.detect()).toBe(true)

    const empty = await mkdtemp(join(tmpdir(), "codex-detect-no-"))
    process.env.CODEX_HOME = empty
    expect(await codexImport.detect()).toBe(false)
  })

  test("AC5: discover() lists rollouts newest-first with session_id", async () => {
    const home = await mkdtemp(join(tmpdir(), "codex-discover-"))
    await seedRollout(home, "2026/06/28", "rollout-2026-06-28T09-00-00-old.jsonl", [
      { timestamp: "2026-06-28T09:00:00.000Z", type: "session_meta", payload: { session_id: "sess-old", cwd: "/tmp/a", timestamp: "2026-06-28T09:00:00.000Z" } },
      { timestamp: "2026-06-28T09:00:01.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "old question" }] } },
      { timestamp: "2026-06-28T09:00:02.000Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "old answer" }] } },
    ])
    await seedRollout(home, "2026/06/30", "rollout-2026-06-30T18-00-00-new.jsonl", [
      { timestamp: "2026-06-30T18:00:00.000Z", type: "session_meta", payload: { session_id: "sess-new", cwd: "/tmp/b", timestamp: "2026-06-30T18:00:00.000Z" } },
      { timestamp: "2026-06-30T18:00:01.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "new question" }] } },
      { timestamp: "2026-06-30T18:00:02.000Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "new answer" }] } },
    ])
    process.env.CODEX_HOME = home

    const refs = await codexImport.discover()
    expect(refs.map((r) => r.sourceSessionId)).toEqual(["sess-new", "sess-old"])
    expect(refs[0]!.harness).toBe("codex")
    expect(refs[0]!.title).toBe("new question")
    expect(refs[0]!.updatedAt).toBeGreaterThan(refs[1]!.updatedAt!)
    // parse() from a discovered ref carries the authoritative cwd.
    const parsed = await codexImport.parse(refs[0]!)
    expect(parsed.cwd).toBe("/tmp/b")
  })

  test("discover() skips aborted sessions with no turns", async () => {
    const home = await mkdtemp(join(tmpdir(), "codex-aborted-"))
    await seedRollout(home, "2026/06/30", "rollout-2026-06-30T11-00-00-aborted.jsonl", [
      { timestamp: "2026-06-30T11:00:00.000Z", type: "session_meta", payload: { session_id: "aborted", cwd: "/tmp/c", timestamp: "2026-06-30T11:00:00.000Z" } },
      { timestamp: "2026-06-30T11:00:01.000Z", type: "event_msg", payload: { type: "task_started" } },
    ])
    process.env.CODEX_HOME = home
    expect(await codexImport.discover()).toHaveLength(0)
  })

  test("detect() false when CODEX_HOME points nowhere", async () => {
    process.env.CODEX_HOME = join(tmpdir(), "codex-does-not-exist-" + Date.now())
    expect(await codexImport.detect()).toBe(false)
    expect(await codexImport.discover()).toHaveLength(0)
  })
})

describe("codexImport registration (AC6)", () => {
  test("registerImport(codexImport) is retrievable as the codex import adapter", () => {
    registerImport(codexImport)
    expect(getImport("codex")).toBe(codexImport)
    expect(codexImport.harness).toBe("codex")
  })
})

describe("codexImport — real rollout integration", () => {
  test("AC1 (real): a real ~/.codex rollout parses into a valid PortableSession", async () => {
    if (ORIGINAL_CODEX_HOME === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = ORIGINAL_CODEX_HOME

    if (!(await codexImport.detect())) {
      console.log("[skip] no ~/.codex/sessions present")
      return
    }
    const refs = await codexImport.discover()
    if (refs.length === 0) {
      console.log("[skip] no real rollouts discovered")
      return
    }
    const session = await codexImport.parse(refs[0]!)
    expect(() => PortableSession.parse(session)).not.toThrow()
    expect(session.sourceHarness).toBe("codex")
    expect(session.sourceSessionId.length).toBeGreaterThan(0)
    expect(session.cwd.length).toBeGreaterThan(0)
    expect(session.turns.length).toBeGreaterThan(0)
    expect(session.title.startsWith("[codex]")).toBe(false) // no provenance prefix in the display title
    expect(session.droppedTurns).toBeGreaterThanOrEqual(0)
  })
})
