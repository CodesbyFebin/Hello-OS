// Unit tests for the OpenCode desktop deep-link (best-effort, macOS-only,
// fire-and-forget). Covers URL encoding, per-directory dedupe, and the platform
// gate. No real `open` process is ever spawned — `child_process.spawn` is spied.

import { test, expect, describe, beforeEach, afterEach, spyOn } from "bun:test"
import * as childProcess from "child_process"
import {
  buildOpenProjectUrl,
  createDirectoryDedupe,
  openProjectInDesktopApp,
  shouldOpenProjectOnce,
  _resetDedupeTracker,
} from "../../src/adapters/opencode/open-project"

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

describe("buildOpenProjectUrl", () => {
  test("percent-encodes spaces and slashes so the app parser round-trips", () => {
    expect(buildOpenProjectUrl("/tmp/a b")).toBe("opencode://open-project?directory=%2Ftmp%2Fa+b")
    // Round-trip: the app reads it back with url.searchParams.get("directory").
    const parsed = new URL(buildOpenProjectUrl("/tmp/a b"))
    expect(parsed.searchParams.get("directory")).toBe("/tmp/a b")
  })

  test("round-trips other special characters (spaces, unicode, punctuation)", () => {
    const dir = "/Users/me/My Projects/café (v2)"
    const parsed = new URL(buildOpenProjectUrl(dir))
    expect(parsed.searchParams.get("directory")).toBe(dir)
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

describe("shouldOpenProjectOnce (module-scope tracker)", () => {
  beforeEach(() => _resetDedupeTracker())

  test("dedupes across the process run and resets on the test hook", () => {
    expect(shouldOpenProjectOnce("/tmp/proj")).toBe(true)
    expect(shouldOpenProjectOnce("/tmp/proj")).toBe(false)
    _resetDedupeTracker()
    expect(shouldOpenProjectOnce("/tmp/proj")).toBe(true)
  })
})

describe("openProjectInDesktopApp", () => {
  test("does nothing unless the opt-in env is set (default: never launches the GUI)", () => {
    // Regression guard: this is exactly the bug — an unguarded write() flooded
    // the desktop app with real deep links during `bun test`. Default must be inert.
    delete process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP
    setPlatform("darwin")
    const spy = spyOn(childProcess, "spawn")
    openProjectInDesktopApp("/tmp/proj")
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test("does nothing (no spawn) on non-darwin platforms even when opted in", () => {
    process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
    setPlatform("linux")
    const spy = spyOn(childProcess, "spawn")
    openProjectInDesktopApp("/tmp/proj")
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test("on darwin, opted in, spawns `open` with the encoded deep link", () => {
    process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
    setPlatform("darwin")
    const spy = spyOn(childProcess, "spawn").mockImplementation((() => ({
      on() {},
      unref() {},
    })) as unknown as typeof childProcess.spawn)

    openProjectInDesktopApp("/tmp/a b")

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toBe("open")
    expect(spy.mock.calls[0]![1]).toEqual(["opencode://open-project?directory=%2Ftmp%2Fa+b"])
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
          // Simulate `open` missing: emit 'error' synchronously.
          if (event === "error") cb(new Error("spawn open ENOENT"))
        },
        unref() {},
      }
    }) as unknown as typeof childProcess.spawn)

    expect(() => openProjectInDesktopApp("/tmp/proj")).not.toThrow()
    spy.mockRestore()
  })
})
