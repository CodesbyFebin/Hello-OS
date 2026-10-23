// Unit tests for the Codex desktop deep-link (best-effort, macOS-only,
// fire-and-forget). Covers URL encoding, per-directory dedupe, and the platform
// + opt-in gates. No real `open` process is ever spawned — `child_process.spawn`
// is spied. Twin of opencode-open-project.test.ts.

import { test, expect, describe, beforeEach, afterEach, spyOn } from "bun:test"
import * as childProcess from "child_process"
import {
  buildOpenThreadUrl,
  createDirectoryDedupe,
  openThreadInDesktopApp,
  shouldOpenThreadOnce,
  _resetDedupeTracker,
} from "../../src/adapters/codex/open-project"

const ORIGINAL_PLATFORM = process.platform
const PREV_OPEN_ENV = process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP

function setPlatform(value: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value, configurable: true })
}

afterEach(() => {
  setPlatform(ORIGINAL_PLATFORM)
  if (PREV_OPEN_ENV === undefined) delete process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP
  else process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = PREV_OPEN_ENV
  _resetDedupeTracker()
})

describe("buildOpenThreadUrl", () => {
  test("builds codex://threads/<id> for a normal uuid", () => {
    expect(buildOpenThreadUrl("019f3db7-113b-75e7-a769-2b150fbb99b9")).toBe(
      "codex://threads/019f3db7-113b-75e7-a769-2b150fbb99b9",
    )
  })

  test("percent-encodes stray characters in the id path segment", () => {
    // A well-formed uuid never needs encoding, but the id must never be
    // concatenated raw — a space or slash has to encode into the path.
    expect(buildOpenThreadUrl("a b/c")).toBe("codex://threads/a%20b%2Fc")
  })
})

describe("createDirectoryDedupe", () => {
  test("first call for a directory is true, later calls are false", () => {
    const seen = createDirectoryDedupe()
    expect(seen("/tmp/a")).toBe(true)
    expect(seen("/tmp/a")).toBe(false)
    expect(seen("/tmp/a")).toBe(false)
  })

  test("distinct directories each fire once", () => {
    const seen = createDirectoryDedupe()
    expect(seen("/tmp/a")).toBe(true)
    expect(seen("/tmp/b")).toBe(true)
    expect(seen("/tmp/a")).toBe(false)
  })

  test("separate factories keep independent state", () => {
    const a = createDirectoryDedupe()
    const b = createDirectoryDedupe()
    expect(a("/tmp/x")).toBe(true)
    expect(b("/tmp/x")).toBe(true)
  })
})

describe("shouldOpenThreadOnce (module-scope tracker)", () => {
  beforeEach(() => _resetDedupeTracker())

  test("dedupes per project dir across the run and resets on the test hook", () => {
    expect(shouldOpenThreadOnce("/tmp/proj")).toBe(true)
    expect(shouldOpenThreadOnce("/tmp/proj")).toBe(false)
    _resetDedupeTracker()
    expect(shouldOpenThreadOnce("/tmp/proj")).toBe(true)
  })
})

describe("openThreadInDesktopApp", () => {
  test("does nothing unless the opt-in env is set (default: never launches the GUI)", () => {
    // Regression guard: an unguarded write() must never spawn deep links during
    // `bun test`. Default is inert.
    delete process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP
    setPlatform("darwin")
    const spy = spyOn(childProcess, "spawn")
    openThreadInDesktopApp("thread-1")
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test("does nothing (no spawn) on non-darwin platforms even when opted in", () => {
    process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
    setPlatform("linux")
    const spy = spyOn(childProcess, "spawn")
    openThreadInDesktopApp("thread-1")
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test("on darwin, opted in, spawns `open` with the codex://threads deep link", () => {
    process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
    setPlatform("darwin")
    const spy = spyOn(childProcess, "spawn").mockImplementation((() => ({
      on() {},
      unref() {},
    })) as unknown as typeof childProcess.spawn)

    openThreadInDesktopApp("019f3db7-113b-75e7-a769-2b150fbb99b9")

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toBe("open")
    expect(spy.mock.calls[0]![1]).toEqual(["codex://threads/019f3db7-113b-75e7-a769-2b150fbb99b9"])
    spy.mockRestore()
  })

  test("swallows async spawn errors (best-effort, never throws)", () => {
    process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
    setPlatform("darwin")
    const spy = spyOn(childProcess, "spawn").mockImplementation((() => {
      const handlers: Record<string, (err: Error) => void> = {}
      return {
        on(event: string, cb: (err: Error) => void) {
          handlers[event] = cb
          if (event === "error") cb(new Error("spawn open ENOENT"))
        },
        unref() {},
      }
    }) as unknown as typeof childProcess.spawn)

    expect(() => openThreadInDesktopApp("thread-1")).not.toThrow()
    spy.mockRestore()
  })
})
