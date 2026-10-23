// Sandbox config — single source of truth for the test-harness isolation layer.
//
// Everything the sandbox scripts know about each harness lives here: where its
// REAL store is (what backup must snapshot), where its SANDBOX counterpart is,
// which env makes the porter CLI *write* into the sandbox, and which env makes
// the *desktop app* read from it. Write-side values are verified against the
// adapters (see docs/superpowers/plans/2026-07-06-sandbox-test-harness.md).
// App-read values are best-guess pending the desktop-app isolation spike
// (docs/brain/decisions/) — terminal verification does not depend on them.
//
// `sandboxRoot()` is a function, not a constant: bun test runs every test file
// in one process, so a module-level constant would freeze the first test file's
// HELLO_SESSIONS_SANDBOX_ROOT for all of them.

import os from "node:os"
import path from "node:path"

export type HarnessId = "claude-code" | "codex" | "opencode"
export const HARNESSES: HarnessId[] = ["claude-code", "codex", "opencode"]

export function sandboxRoot(): string {
  return process.env.HELLO_SESSIONS_SANDBOX_ROOT ?? path.join(os.homedir(), ".hello-sessions-sandbox")
}

/** real → paths backup must snapshot; sandbox → their isolated counterparts. */
export function harnessStore(h: HarnessId): { real: string[]; sandbox: string[] } {
  const home = os.homedir()
  switch (h) {
    case "claude-code":
      return {
        real: [path.join(home, ".claude", "projects")],
        sandbox: [path.join(sandboxRoot(), "claude-code", "projects")],
      }
    case "codex":
      return {
        real: [path.join(home, ".codex", "sessions")],
        sandbox: [path.join(sandboxRoot(), "codex", "sessions")],
      }
    case "opencode":
      return {
        real: [path.join(home, ".local", "share", "opencode")],
        sandbox: [path.join(sandboxRoot(), "opencode")],
      }
  }
}

/** Env the porter CLI/adapters need so `port` reads/writes the sandbox. */
export function writeEnv(h: HarnessId): Record<string, string> {
  switch (h) {
    case "claude-code":
      return {
        CLAUDE_PROJECTS_ROOT: harnessStore(h).sandbox[0]!,
        CLAUDE_IMPORT_LEDGER_DIR: path.join(sandboxRoot(), "claude-code"),
      }
    case "codex":
      return { CODEX_HOME: path.join(sandboxRoot(), "codex") }
    case "opencode":
      return {
        OPENCODE_DB: path.join(sandboxRoot(), "opencode", "opencode.db"),
        OPENCODE_DISABLE_CHANNEL_DB: "1",
      }
  }
}

/** Ledger isolation for child `port` runs — pair with writeEnv() of both sides. */
export function ledgerEnv(): Record<string, string> {
  return { HELLO_SESSIONS_LEDGER_PATH: path.join(sandboxRoot(), "ledger.json") }
}

/**
 * Env the DESKTOP APP needs to read the sandbox. BEST-GUESS pending the
 * desktop-app isolation spike; do not rely on these for autonomous verification.
 */
export function appReadEnv(h: HarnessId): Record<string, string> {
  switch (h) {
    case "claude-code":
      return { CLAUDE_CONFIG_DIR: path.join(sandboxRoot(), "claude-code") }
    case "codex":
      return { CODEX_HOME: path.join(sandboxRoot(), "codex") }
    case "opencode":
      return { XDG_DATA_HOME: sandboxRoot() }
  }
}

/** Direct-binary launch (GUI apps don't inherit Dock env). Verify per spike. */
export function appLaunch(h: HarnessId): { bin: string; args: string[] } {
  switch (h) {
    case "claude-code":
      return { bin: "/Applications/Claude.app/Contents/MacOS/Claude", args: [] }
    case "codex":
      return { bin: "/Applications/Codex.app/Contents/MacOS/Codex", args: [] }
    case "opencode":
      return { bin: "/Applications/OpenCode.app/Contents/MacOS/OpenCode", args: [] }
  }
}

/** Per-harness isolation strategy — provisional until the spike classifies apps. */
export const ISOLATION: Record<HarnessId, "reroute" | "backup-fallback"> = {
  "claude-code": "reroute",
  codex: "reroute",
  opencode: "reroute",
}
