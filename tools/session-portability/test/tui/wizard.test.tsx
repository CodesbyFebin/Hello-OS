// Tests for the 5-step Memport wizard (Direction B / Marker redesign):
//   - Unit: the pure helpers in src/tui/wizard.ts
//   - Integration: the full App walked end-to-end (source → destination →
//     select → import → done → y restarts at source) against a mock
//     orchestrator, via @opentui's headless test renderer.

import { describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"

import type { HarnessCapability } from "../../src/detect"
import type { HarnessId, PortableSession } from "../../src/ir"
import type { PorterEvent } from "../../src/core/events"
import { App, type AppOrchestrator } from "../../src/tui/app"
import { SelectScreen } from "../../src/tui/screens/select"
import {
  confettiSpans,
  countSessions,
  firstEnabledIndex,
  formatFinalElapsed,
  formatTickingElapsed,
  groupSessionsByProject,
  nextEnabledIndex,
  progressTrail,
  projectDisplay,
  resolveImportIds,
  selectAllSessions,
  sessionActivity,
  shortenHome,
  stepStates,
  toggleSessionSelection,
  TRAIL_CELLS,
  truncateEnd,
} from "../../src/tui/wizard"

// --- fixtures ----------------------------------------------------------------

function makeSession(overrides: Partial<PortableSession> = {}): PortableSession {
  return {
    schemaVersion: "1.0.0",
    sourceHarness: "claude-code",
    sourceSessionId: "s1",
    sourcePath: "/Users/dev/.claude/projects/-Users-dev-repo-a/s1.jsonl",
    cwd: "/Users/dev/repo/a",
    title: "fix the flaky test",
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    turns: [
      { role: "user", text: "why is this test flaky" },
      { role: "assistant", text: "let's look at the timeout" },
    ],
    droppedTurns: 0,
    sourceMetadata: {},
    ...overrides,
  }
}

// --- unit: step tracker --------------------------------------------------------

describe("stepStates", () => {
  test("step 1: current then all upcoming", () => {
    expect(stepStates(1)).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming"])
  })
  test("step 3: completed, completed, current, upcoming, upcoming", () => {
    expect(stepStates(3)).toEqual(["completed", "completed", "current", "upcoming", "upcoming"])
  })
  test("step 5: everything before Done completed", () => {
    expect(stepStates(5)).toEqual(["completed", "completed", "completed", "completed", "current"])
  })
})

// --- unit: paths, counts, grouping ----------------------------------------------

describe("shortenHome / projectDisplay", () => {
  test("substitutes ~ for the home prefix only", () => {
    expect(shortenHome("/Users/dev/repo", "/Users/dev")).toBe("~/repo")
    expect(shortenHome("/Users/devious/repo", "/Users/dev")).toBe("/Users/devious/repo")
    expect(shortenHome("/Users/dev", "/Users/dev")).toBe("~")
  })

  test("splits a cwd into project name + ~-shortened parent", () => {
    expect(projectDisplay("/Users/dev/Desktop/Projects/raincheck", "/Users/dev")).toEqual({
      name: "raincheck",
      parent: "~/Desktop/Projects",
    })
  })
})

describe("countSessions", () => {
  test("counts distinct projects and total messages", () => {
    const sessions = [
      makeSession({ sourceSessionId: "a1", cwd: "/repo/a" }),
      makeSession({ sourceSessionId: "a2", cwd: "/repo/a" }),
      makeSession({ sourceSessionId: "b1", cwd: "/repo/b", turns: [{ role: "user", text: "hi" }] }),
    ]
    expect(countSessions(sessions)).toEqual({ projects: 2, messages: 5 })
  })
})

describe("sessionActivity", () => {
  test("prefers updatedAt", () => {
    expect(sessionActivity(makeSession({ updatedAt: 500, createdAt: 100, turns: [{ role: "user", text: "x", timestamp: 300 }] }))).toBe(500)
  })

  test("falls back to the last timestamped turn when updatedAt is absent", () => {
    const s = makeSession({
      updatedAt: undefined,
      createdAt: 100,
      turns: [
        { role: "user", text: "x", timestamp: 300 },
        { role: "assistant", text: "y" },
      ],
    })
    expect(sessionActivity(s)).toBe(300)
  })

  test("falls back to createdAt, then 0", () => {
    expect(sessionActivity(makeSession({ updatedAt: undefined, createdAt: 100, turns: [{ role: "user", text: "x" }] }))).toBe(100)
    expect(sessionActivity(makeSession({ updatedAt: undefined, createdAt: undefined, turns: [{ role: "user", text: "x" }] }))).toBe(0)
  })
})

describe("groupSessionsByProject", () => {
  test("orders projects and sessions by most-recent activity", () => {
    const a1 = makeSession({ sourceSessionId: "a1", cwd: "/repo/a", updatedAt: 100 })
    const b1 = makeSession({ sourceSessionId: "b1", cwd: "/repo/b", updatedAt: 500 })
    const a2 = makeSession({ sourceSessionId: "a2", cwd: "/repo/a", updatedAt: 300 })
    const grouped = groupSessionsByProject([a1, b1, a2])
    // /repo/a's newest session (a2 @300) is older than /repo/b (b1 @500), so b first.
    expect(grouped.map(([cwd]) => cwd)).toEqual(["/repo/b", "/repo/a"])
    // Within /repo/a, newest-first: a2 (300) before a1 (100).
    expect(grouped[1]?.[1].map((s) => s.sourceSessionId)).toEqual(["a2", "a1"])
  })
})

// --- unit: selection & cursors ---------------------------------------------------

describe("selection helpers", () => {
  test("toggle adds and removes", () => {
    const one = toggleSessionSelection(new Set(), "x")
    expect(one.has("x")).toBe(true)
    expect(toggleSessionSelection(one, "x").size).toBe(0)
  })

  test("selectAllSessions selects every id", () => {
    const sessions = [makeSession({ sourceSessionId: "a" }), makeSession({ sourceSessionId: "b" })]
    expect([...selectAllSessions(sessions)].sort()).toEqual(["a", "b"])
  })

  test("selectAllSessions skips already-imported ids", () => {
    const sessions = [makeSession({ sourceSessionId: "a" }), makeSession({ sourceSessionId: "b" })]
    expect([...selectAllSessions(sessions, new Set(["a"]))]).toEqual(["b"])
  })
})

describe("resolveImportIds (fzf-style ↵ fallback)", () => {
  const sessions = [makeSession({ sourceSessionId: "a" }), makeSession({ sourceSessionId: "b" }), makeSession({ sourceSessionId: "c" })]
  const allSelectable = () => true

  test("empty selection imports the focused row only", () => {
    expect(resolveImportIds(sessions, new Set(), 1, allSelectable)).toEqual(["b"])
  })

  test("empty selection with a non-selectable focused row imports nothing", () => {
    const notC = (s: PortableSession) => s.sourceSessionId !== "c"
    expect(resolveImportIds(sessions, new Set(), 2, notC)).toEqual([])
  })

  test("explicit selection wins over the cursor and keeps list order", () => {
    expect(resolveImportIds(sessions, new Set(["c", "a"]), 1, allSelectable)).toEqual(["a", "c"])
  })

  test("empty list imports nothing", () => {
    expect(resolveImportIds([], new Set(), 0, allSelectable)).toEqual([])
  })
})

describe("nextEnabledIndex / firstEnabledIndex", () => {
  const enabled = [true, false, false, true]

  test("skips disabled rows in both directions, wrapping", () => {
    expect(nextEnabledIndex(0, 1, enabled)).toBe(3)
    expect(nextEnabledIndex(3, 1, enabled)).toBe(0)
    expect(nextEnabledIndex(0, -1, enabled)).toBe(3)
  })

  test("all-disabled list leaves the cursor put", () => {
    expect(nextEnabledIndex(1, 1, [false, false])).toBe(1)
  })

  test("firstEnabledIndex finds the first selectable row", () => {
    expect(firstEnabledIndex([false, true, true])).toBe(1)
    expect(firstEnabledIndex([false, false])).toBe(0)
  })
})

// --- unit: progress trail & elapsed ----------------------------------------------

describe("progressTrail", () => {
  test("empty at 0, head at the left", () => {
    const trail = progressTrail(0, 250)
    expect(trail.filled).toBe("")
    expect(trail.head).toBe("●")
    expect(trail.rest.length).toBe(TRAIL_CELLS - 1)
  })

  test("full at total, no remainder", () => {
    const trail = progressTrail(250, 250)
    expect(trail.filled.length).toBe(TRAIL_CELLS - 1)
    expect(trail.rest).toBe("")
  })

  test("always sums to TRAIL_CELLS cells", () => {
    for (const done of [0, 1, 100, 142, 250]) {
      const trail = progressTrail(done, 250)
      expect(trail.filled.length + 1 + trail.rest.length).toBe(TRAIL_CELLS)
    }
  })

  test("zero total renders an empty trail instead of dividing by zero", () => {
    const trail = progressTrail(0, 0)
    expect(trail.filled).toBe("")
    expect(trail.rest.length).toBe(TRAIL_CELLS - 1)
  })
})

describe("elapsed formatting", () => {
  test("ticking shows whole seconds, then minutes", () => {
    expect(formatTickingElapsed(12_400)).toBe("12s")
    expect(formatTickingElapsed(65_000)).toBe("1m 5s")
  })
  test("final shows one decimal under a minute", () => {
    expect(formatFinalElapsed(3_210)).toBe("3.2s")
    expect(formatFinalElapsed(65_000)).toBe("1m 5s")
  })
})

// --- unit: truncation & confetti ---------------------------------------------------

describe("truncateEnd", () => {
  test("short strings pass through, long ones get an ellipsis at exactly max chars", () => {
    expect(truncateEnd("short", 10)).toBe("short")
    expect(truncateEnd("abcdefghij", 5)).toBe("abcd…")
    expect(truncateEnd("abcdefghij", 5).length).toBe(5)
  })
})

describe("confettiSpans", () => {
  test("is deterministic per seed and spans always cover the full width", () => {
    const a = confettiSpans(60, 7)
    const b = confettiSpans(60, 7)
    expect(a).toEqual(b)
    expect(a.map((s) => s.text).join("").length).toBe(60)
  })

  test("different seeds scatter differently", () => {
    expect(confettiSpans(60, 1)).not.toEqual(confettiSpans(60, 2))
  })

  test("contains only the handoff's glyphs and spaces", () => {
    const line = confettiSpans(60, 3).map((s) => s.text).join("")
    expect([...line].every((ch) => " *✦˚·".includes(ch))).toBe(true)
  })
})

// --- integration: the full wizard, end to end ---------------------------------------

interface MockWorld {
  orchestrator: AppOrchestrator
  emit: (event: PorterEvent) => void
  exportCalls: Array<{ dest: HarnessId; sessionIds: string[] }>
}

/** Sources/destinations all three harnesses; claude-code has sessions across
 *  two projects, codex has none. `exportSessions` emits a full synchronous
 *  export:* batch so step 4 completes and lands on step 5 on its own. */
function createMockWorld(sessions: PortableSession[]): MockWorld {
  const listeners = new Set<(event: PorterEvent) => void>()
  const emit = (event: PorterEvent) => {
    for (const listener of [...listeners]) listener(event)
  }
  const exportCalls: MockWorld["exportCalls"] = []
  const orchestrator: AppOrchestrator = {
    async listSources() {
      return ["claude-code", "codex", "opencode"]
    },
    async listDestinations() {
      return ["claude-code", "codex", "opencode"]
    },
    async importAll(harness) {
      return harness === "claude-code" ? sessions : []
    },
    async listExported() {
      return []
    },
    async exportSessions(dest, batch) {
      exportCalls.push({ dest, sessionIds: batch.map((s) => s.sourceSessionId) })
      emit({ type: "export:start", harness: dest, total: batch.length })
      batch.forEach((session, i) => {
        emit({
          type: "export:progress",
          harness: dest,
          sourceSessionId: session.sourceSessionId,
          current: i + 1,
          total: batch.length,
        })
      })
      emit({ type: "export:done", harness: dest, current: batch.length, total: batch.length })
      return []
    },
    events: {
      on(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
  }
  return { orchestrator, emit, exportCalls }
}

const CAPS: HarnessCapability[] = [
  {
    harness: "claude-code",
    installed: true,
    canImport: true,
    canExport: true,
    sourcePath: "/Users/dev/.claude/projects",
  },
  { harness: "codex", installed: true, canImport: false, canExport: true, sourcePath: "/Users/dev/.codex/sessions" },
  { harness: "opencode", installed: true, canImport: true, canExport: true, sourcePath: "/Users/dev/.local/share/opencode/opencode.db" },
]

const FIXTURE_SESSIONS = [
  makeSession({ sourceSessionId: "a1", cwd: "/Users/dev/repo/a", title: "design-consultation" }),
  makeSession({ sourceSessionId: "a2", cwd: "/Users/dev/repo/a", title: "plan-eng-review" }),
  makeSession({
    sourceSessionId: "b1",
    cwd: "/Users/dev/repo/b",
    title: "does claude code only save 30 days of sessions?",
    turns: [
      { role: "user", text: "q" },
      { role: "assistant", text: "a" },
      { role: "user", text: "q2" },
    ],
  }),
]

describe("App (rendered, full wizard)", () => {
  test("walks Source → Destination → Select → Import → Done, then y restarts at Source", async () => {
    const world = createMockWorld(FIXTURE_SESSIONS)
    const setup = await testRender(
      // Wide enough that the 70%-of-terminal frame still has room for a full
      // conversation title in step 3's preview (see select.tsx's previewMaxChars).
      () => <App orchestrator={world.orchestrator} onExit={() => {}} detect={async () => CAPS} />,
      { width: 140, height: 44 },
    )
    try {
      // Step 1 — welcome & source, with the up-front scan's counts inline.
      let frame = await setup.waitForFrame(
        (f) => f.includes("Where are we importing from?") && f.includes("2 projects ∙ 7 messages"),
      )
      expect(frame).toContain("HELLO OS")
      expect(frame).toContain("Port your session chats between coding agents.")
      expect(frame).toContain("session contents are not uploaded")
      expect(frame).toContain("never overwritten or deleted")
      expect(frame).toContain("MIT licensed")
      expect(frame).toContain("github.com/CodesbyFebin/Hello-OS")
      expect(frame).toContain("◼ Source")
      expect(frame).toContain("Claude Code")
      expect(frame).toContain("2 projects ∙ 7 messages")
      expect(frame).toContain("nothing here yet")
      expect(frame).toContain("scanned your machine in")
      expect(frame).toContain("↑↓ choose ∙ ↵ continue ∙ q quit")

      // Claude Code is the only detected source; cursor already there.
      setup.mockInput.pressEnter()

      // Step 2 — destination, any installed harness but the chosen source.
      frame = await setup.waitForFrame((f) => f.includes("Where are we moving your memories to?"))
      expect(frame).toContain("✔ Source")
      expect(frame).toContain("◼ Destination")
      expect(frame).toContain("source: ")
      expect(frame).toContain("Claude Code") // the chosen source, shown as context
      expect(frame).toContain("~/.config/opencode")
      expect(frame).toContain("Codex")

      // Choose OpenCode (second remaining option) as the destination.
      setup.mockInput.pressArrow("down")
      setup.mockInput.pressEnter()

      // Step 3 — select chats: grouped rows, nothing selected by default so ↵
      // falls back to importing just the focused chat (fzf-style).
      frame = await setup.waitForFrame((f) => f.includes("none selected"))
      expect(frame).toContain("Chats")
      expect(frame).toContain("Coming Soon:")
      expect(frame).toContain("▍a")
      expect(frame).toContain("▍b")
      expect(frame).toContain("design-consultation")
      expect(frame).toContain("does claude code only save 30 days of sessions?")
      expect(frame).toContain("2 messages")
      expect(frame).toContain("↵ import this chat")
      expect(frame).toContain("space toggle")
      expect(frame).toContain("a select all")

      // `a` selects every chat; the action label switches to the explicit set.
      setup.mockInput.pressKey("a")
      frame = await setup.waitForFrame((f) => f.includes("all 3 selected"))
      expect(frame).toContain("∙ 7 messages")
      expect(frame).toContain("↵ import 3 selected")

      // Toggle the cursor row off and back on — summary tracks it.
      setup.mockInput.pressKey(" ")
      frame = await setup.waitForFrame((f) => f.includes("2 of 3 selected"))
      expect(frame).toContain("∙ 5 messages")
      setup.mockInput.pressKey(" ")
      await setup.waitForFrame((f) => f.includes("all 3 selected"))

      // ↵ import → step 4 runs the batch (mock completes synchronously) → step 5.
      setup.mockInput.pressEnter()
      frame = await setup.waitForFrame((f) => f.includes("Chat sessions ported!"))
      expect(world.exportCalls).toEqual([{ dest: "opencode", sessionIds: ["a1", "a2", "b1"] }])
      expect(frame).toContain("7 messages ∙ 2 projects → ")
      expect(frame).toContain("OpenCode")
      // The fixture home (/Users/dev) isn't the test runner's real home, so
      // shortenHome leaves the capability path as-is here.
      expect(frame).toContain("saved to /Users/dev/.local/share/opencode/opencode.db")
      expect(frame).toContain("Import more? ")
      expect(frame).toContain("ctrl+c to exit")

      // y → back to step 1, Source, to start over (reusing the same scan).
      setup.mockInput.pressKey("y")
      await setup.waitForFrame((f) => f.includes("Where are we importing from?"))
    } finally {
      if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    }
  })

  test("esc on step 2 goes back to step 1; q on step 1 quits", async () => {
    const world = createMockWorld(FIXTURE_SESSIONS)
    let exited = false
    const setup = await testRender(
      () => <App orchestrator={world.orchestrator} onExit={() => (exited = true)} detect={async () => CAPS} />,
      { width: 100, height: 40 },
    )
    try {
      await setup.waitForFrame((f) => f.includes("Where are we importing from?") && f.includes("scanned your machine in"))
      setup.mockInput.pressEnter()
      await setup.waitForFrame((f) => f.includes("Where are we moving your memories to?"))

      // A lone ESC byte is held briefly by the key parser for escape-sequence
      // disambiguation; wait on the wall clock, not frames.
      setup.mockInput.pressEscape()
      await new Promise((resolve) => setTimeout(resolve, 500))
      await setup.renderOnce()
      const frame = await setup.waitForFrame((f) => f.includes("Where are we importing from?"))
      expect(frame).toContain("◼ Source")

      setup.mockInput.pressKey("q")
      await setup.waitFor(() => exited)
      expect(exited).toBe(true)
    } finally {
      if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    }
  })

  test("source screen omits harnesses that aren't installed", async () => {
    // OpenCode is absent from this machine: listSources returns only the two
    // installed harnesses, so it must not appear as a "nothing here yet" row.
    const base = createMockWorld(FIXTURE_SESSIONS)
    const orchestrator: AppOrchestrator = {
      ...base.orchestrator,
      async listSources() {
        return ["claude-code", "codex"]
      },
      async listDestinations() {
        return ["claude-code", "codex"]
      },
    }
    const setup = await testRender(
      () => <App orchestrator={orchestrator} onExit={() => {}} detect={async () => CAPS} />,
      { width: 120, height: 40 },
    )
    try {
      // Step 1 lists only installed sources.
      let frame = await setup.waitForFrame(
        (f) => f.includes("Where are we importing from?") && f.includes("scanned your machine in"),
      )
      expect(frame).toContain("Claude Code")
      expect(frame).not.toContain("OpenCode")

      // Choose Claude Code as source → step 2 destination lists the rest.
      setup.mockInput.pressEnter()
      frame = await setup.waitForFrame((f) => f.includes("Where are we moving your memories to?"))
      expect(frame).toContain("Codex")
      expect(frame).not.toContain("OpenCode")
    } finally {
      if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    }
  })

  // The frame is 70% of the terminal on each axis (see chrome.useFrameSize),
  // so a title's available preview room scales with terminal width.
  describe("Select screen's title preview scales with terminal width", () => {
    const LONG_TITLE = "does claude code only save 30 days of sessions?"

    function renderSelect(width: number, height: number) {
      const session = makeSession({ title: LONG_TITLE })
      return testRender(
        () => <SelectScreen source="claude-code" dest="opencode" sessions={[session]} onConfirm={() => {}} onBack={() => {}} />,
        { width, height },
      )
    }

    test("narrow terminal truncates a long conversation title", async () => {
      const setup = await renderSelect(90, 30)
      try {
        const frame = await setup.waitForFrame((f) => f.includes("does claude code"))
        expect(frame).not.toContain(LONG_TITLE)
        expect(frame).toContain("…")
      } finally {
        if (!setup.renderer.isDestroyed) setup.renderer.destroy()
      }
    })

    test("wide terminal shows the full conversation title", async () => {
      const setup = await renderSelect(200, 30)
      try {
        const frame = await setup.waitForFrame((f) => f.includes(LONG_TITLE))
        expect(frame).toContain(LONG_TITLE)
      } finally {
        if (!setup.renderer.isDestroyed) setup.renderer.destroy()
      }
    })
  })
})
