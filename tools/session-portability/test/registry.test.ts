import { test, expect, describe, beforeEach } from "bun:test"
import {
  registerImport,
  registerExport,
  getImport,
  getExport,
  listImport,
  listExport,
  listInstalled,
  _resetRegistry,
} from "../src/registry"
import type { ImportAdapter, ExportAdapter } from "../src/adapter"

const fakeImport: ImportAdapter = {
  harness: "claude-code",
  detect: async () => true,
  discover: async () => [],
  parse: async () => {
    throw new Error("not implemented in S0")
  },
}

const fakeExport: ExportAdapter = {
  harness: "opencode",
  detect: async () => true,
  write: async () => ({ destSessionId: "ses_x", skipped: false }),
  teardown: async () => {},
}

describe("registry", () => {
  beforeEach(() => _resetRegistry())

  test("register + lookup import adapter by harness", () => {
    registerImport(fakeImport)
    expect(getImport("claude-code")).toBe(fakeImport)
    expect(getImport("codex")).toBeUndefined()
    expect(listImport()).toHaveLength(1)
  })

  test("register + lookup export adapter by harness", () => {
    registerExport(fakeExport)
    expect(getExport("opencode")).toBe(fakeExport)
    expect(listExport()).toHaveLength(1)
  })

  test("listInstalled reports nothing when no adapters are registered, even if a harness is detected on disk", async () => {
    // Detection alone isn't enough — listInstalled also gates on registration
    // (S7 detectHarnesses() AND an adapter in this registry), so a cleared
    // registry always yields empty lists regardless of what's actually on
    // this machine.
    const installed = await listInstalled()
    expect(installed.sources).toEqual([])
    expect(installed.destinations).toEqual([])
  })
})

describe("registry + real adapters (reconciliation integration)", () => {
  beforeEach(() => _resetRegistry())

  test("registerAllAdapters + listInstalled reflects this machine's real capabilities", async () => {
    const { registerAllAdapters } = await import("../src/adapters/index")
    registerAllAdapters()

    expect(listImport().map((a) => a.harness).sort()).toEqual(["claude-code", "codex", "opencode"])
    expect(listExport().map((a) => a.harness).sort()).toEqual(["claude-code", "codex", "opencode"])

    const installed = await listInstalled()
    // Detection varies by machine. Registered adapters are exposed only when
    // the corresponding local harness is actually detected.
    const detected = (await import("../src/detect")).detectHarnesses
    const capabilities = await detected()
    const sources = capabilities.filter((item) => item.canImport).map((item) => item.harness).sort()
    const destinations = capabilities.filter((item) => item.canExport).map((item) => item.harness).sort()
    expect(installed.sources.sort()).toEqual(sources)
    expect(installed.destinations.sort()).toEqual(destinations)
  })

  test("registerAllAdapters is idempotent (safe to call twice)", async () => {
    const { registerAllAdapters } = await import("../src/adapters/index")
    registerAllAdapters()
    registerAllAdapters()
    expect(listImport()).toHaveLength(3)
    expect(listExport()).toHaveLength(3)
  })
})
