import { afterEach, describe, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { detectHarnesses, type DetectEnv, type HarnessCapability } from "../src/detect"

// --- temp-HOME scaffolding --------------------------------------------------

const roots: string[] = []
const locked: string[] = [] // dirs whose write bit we removed; restore before rm

function tmpHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "sp-detect-"))
  roots.push(dir)
  return dir
}

function mkdirp(...parts: string[]): string {
  const p = join(...parts)
  mkdirSync(p, { recursive: true })
  return p
}

function touch(path: string): string {
  writeFileSync(path, "")
  return path
}

function lockDir(path: string): void {
  chmodSync(path, 0o555) // r-x: exists + readable, not writable
  locked.push(path)
}

afterEach(() => {
  for (const p of locked.splice(0)) {
    try {
      chmodSync(p, 0o755)
    } catch {}
  }
  for (const r of roots.splice(0)) {
    try {
      rmSync(r, { recursive: true, force: true })
    } catch {}
  }
})

function cap(caps: HarnessCapability[], h: HarnessCapability["harness"]): HarnessCapability {
  const found = caps.find((c) => c.harness === h)
  if (!found) throw new Error(`no capability for ${h}`)
  return found
}

/** An env with nothing findable: empty HOME + empty PATH, no overrides. */
function emptyEnv(home: string): DetectEnv {
  return { HOME: home, PATH: "", CODEX_HOME: undefined, XDG_DATA_HOME: undefined, OPENCODE_DB: undefined }
}

// ===========================================================================
// AC1 — one capability per known harness, never throws
// ===========================================================================

describe("detectHarnesses shape (AC1)", () => {
  test("returns exactly one capability per known harness and does not throw", async () => {
    const caps = await detectHarnesses(emptyEnv(tmpHome()))
    expect(caps.map((c) => c.harness).sort()).toEqual(["claude-code", "codex", "opencode"])
    for (const c of caps) {
      expect(typeof c.installed).toBe("boolean")
      expect(typeof c.canImport).toBe("boolean")
      expect(typeof c.canExport).toBe("boolean")
    }
  })
})

// ===========================================================================
// AC5 — absent harness (empty HOME) yields all-false, no error
// ===========================================================================

describe("absent harnesses (AC5)", () => {
  test("empty HOME + empty PATH => every harness all-false with an explanatory note", async () => {
    const caps = await detectHarnesses(emptyEnv(tmpHome()))
    for (const c of caps) {
      expect(c.installed).toBe(false)
      expect(c.canImport).toBe(false)
      expect(c.canExport).toBe(false)
      expect(c.sourcePath).toBeUndefined()
      expect(c.note).toBeTruthy()
    }
  })
})

// ===========================================================================
// Unit: per-harness capability logic with faked filesystem/PATH (AC2/AC3)
// ===========================================================================

describe("claude-code capability logic", () => {
  test("projects present + writable => import + export true, sourcePath set", async () => {
    const home = tmpHome()
    const projects = mkdirp(home, ".claude", "projects")
    const c = cap(await detectHarnesses(emptyEnv(home)), "claude-code")
    expect(c.installed).toBe(true)
    expect(c.canImport).toBe(true)
    expect(c.canExport).toBe(true)
    expect(c.sourcePath).toBe(projects)
  })

  test("~/.claude present but no projects/ => installed, not importable, export via create (AC3)", async () => {
    const home = tmpHome()
    mkdirp(home, ".claude")
    const c = cap(await detectHarnesses(emptyEnv(home)), "claude-code")
    expect(c.installed).toBe(true)
    expect(c.canImport).toBe(false)
    expect(c.canExport).toBe(true) // ~/.claude writable => can create projects/
    expect(c.note).toContain("projects/")
  })

  test("projects present but read-only => export false with explaining note (AC3)", async () => {
    const home = tmpHome()
    const projects = mkdirp(home, ".claude", "projects")
    lockDir(projects)
    const c = cap(await detectHarnesses(emptyEnv(home)), "claude-code")
    expect(c.canImport).toBe(true)
    expect(c.canExport).toBe(false)
    expect(c.note).toContain("not writable")
  })
})

describe("codex capability logic + CODEX_HOME override (AC4)", () => {
  test("sessions/ present under ~/.codex => import + export true", async () => {
    const home = tmpHome()
    const sessions = mkdirp(home, ".codex", "sessions")
    const c = cap(await detectHarnesses(emptyEnv(home)), "codex")
    expect(c.canImport).toBe(true)
    expect(c.canExport).toBe(true)
    expect(c.sourcePath).toBe(sessions)
  })

  test("CODEX_HOME override is honored (AC4)", async () => {
    const home = tmpHome() // ~/.codex intentionally absent under HOME
    const codexHome = tmpHome()
    const sessions = mkdirp(codexHome, "sessions")
    const env: DetectEnv = { HOME: home, PATH: "", CODEX_HOME: codexHome }
    const c = cap(await detectHarnesses(env), "codex")
    expect(c.installed).toBe(true)
    expect(c.canImport).toBe(true)
    expect(c.sourcePath).toBe(sessions)
  })
})

describe("opencode capability logic + env overrides (AC3/AC4)", () => {
  test("CLI on PATH, no DB => installed via CLI, import+export true", async () => {
    const home = tmpHome()
    const bin = mkdirp(tmpHome(), "bin")
    const cli = touch(join(bin, "opencode"))
    chmodSync(cli, 0o755)
    const env: DetectEnv = { HOME: home, PATH: bin, XDG_DATA_HOME: undefined, OPENCODE_DB: undefined }
    const c = cap(await detectHarnesses(env), "opencode")
    expect(c.installed).toBe(true)
    expect(c.canImport).toBe(true)
    expect(c.canExport).toBe(true)
  })

  test("no CLI but writable DB => export via Drizzle fallback, note mentions landmine (AC3)", async () => {
    const home = tmpHome()
    const dataHome = tmpHome()
    const dbDir = mkdirp(dataHome, "opencode")
    touch(join(dbDir, "opencode.db"))
    const env: DetectEnv = { HOME: home, PATH: "", XDG_DATA_HOME: dataHome, OPENCODE_DB: undefined }
    const c = cap(await detectHarnesses(env), "opencode")
    expect(c.installed).toBe(true)
    expect(c.canImport).toBe(true)
    expect(c.canExport).toBe(true)
    expect(c.note).toContain("fallback")
    expect(c.note).toContain("OPENCODE_DISABLE_CHANNEL_DB")
  })

  test("prefers real opencode.db over dev-clone opencode-local.db (channel landmine)", async () => {
    const home = tmpHome()
    const dataHome = tmpHome()
    const dbDir = mkdirp(dataHome, "opencode")
    touch(join(dbDir, "opencode-local.db"))
    touch(join(dbDir, "opencode.db"))
    const env: DetectEnv = { HOME: home, PATH: "", XDG_DATA_HOME: dataHome }
    const c = cap(await detectHarnesses(env), "opencode")
    expect(c.sourcePath).toBe(join(dbDir, "opencode.db"))
  })

  test("OPENCODE_DB override points at an explicit DB file (AC4)", async () => {
    const home = tmpHome()
    const dbFile = touch(join(mkdirp(tmpHome(), "custom"), "my.db"))
    const env: DetectEnv = { HOME: home, PATH: "", OPENCODE_DB: dbFile }
    const c = cap(await detectHarnesses(env), "opencode")
    expect(c.installed).toBe(true)
    expect(c.sourcePath).toBe(dbFile)
  })

  test("OPENCODE_DB override pointing at a missing file => not found", async () => {
    const home = tmpHome()
    const env: DetectEnv = { HOME: home, PATH: "", OPENCODE_DB: join(tmpHome(), "nope.db") }
    const c = cap(await detectHarnesses(env), "opencode")
    expect(c.installed).toBe(false)
    expect(c.canExport).toBe(false)
  })
})

// ===========================================================================
// Integration: fixture HOME, all present vs all absent
// ===========================================================================

describe("integration: fixture HOME (all present / all absent)", () => {
  test("all-present fixture => all three harnesses import+export true", async () => {
    const home = tmpHome()
    mkdirp(home, ".claude", "projects")
    mkdirp(home, ".codex", "sessions")
    const dbDir = mkdirp(home, ".local", "share", "opencode")
    touch(join(dbDir, "opencode.db"))
    const env: DetectEnv = { HOME: home, PATH: "" } // no CLI; opencode via DB
    const caps = await detectHarnesses(env)
    for (const c of caps) {
      expect(c.installed).toBe(true)
      expect(c.canImport).toBe(true)
      expect(c.canExport).toBe(true)
    }
  })

  test("all-absent fixture => nothing installed", async () => {
    const caps = await detectHarnesses(emptyEnv(tmpHome()))
    expect(caps.every((c) => !c.installed)).toBe(true)
  })
})

// ===========================================================================
// E2E: real machine — detection must be safe and internally consistent on any
// developer or CI machine; exact local installations are intentionally unknown.
// ===========================================================================

describe("E2E: real machine matrix (AC2)", () => {
  test("detectHarnesses() on real env reflects actual conditions without throwing", async () => {
    const caps = await detectHarnesses() // real process.env
    expect(caps).toHaveLength(3)

    const cc = cap(caps, "claude-code")
    const cx = cap(caps, "codex")
    const oc = cap(caps, "opencode")

    // On this machine all three are installed; sanity-check the invariants that
    // must hold on ANY machine (so this passes wherever it runs).
    for (const c of caps) {
      if (c.canImport) expect(c.installed).toBe(true)
      if (c.canExport) expect(c.installed).toBe(true)
      if (c.canImport) expect(c.sourcePath).toBeTruthy()
    }

    expect(cc.harness).toBe("claude-code")
    expect(cx.harness).toBe("codex")
    expect(oc.harness).toBe("opencode")
  })
})
