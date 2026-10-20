// Fire-and-forget deep link that opens/focuses an imported project in the
// OpenCode desktop app after a session lands. Purely a UX nicety — it is NEVER
// part of write()'s success/failure contract.
//
// Mechanism: OpenCode's desktop app registers the URL scheme
// `opencode://open-project?directory=<cwd>`. Hitting it with macOS `open`
// opens/focuses that project. That's the whole trick.
//
// Non-negotiables (ported from the Jul-1 session-passport prototype — a
// known-good, macOS-verified pattern, orphaned during the hub-and-spoke rewrite):
//   * macOS-only — the scheme is only verified there. Early-return elsewhere.
//   * Best-effort — swallow EVERY failure (app absent, no handler, `open` missing).
//     It must never affect the write's return status.
//   * URL/URLSearchParams, not string concat — project dirs can contain spaces /
//     special chars that must percent-encode so the app's own
//     `url.searchParams.get("directory")` round-trips.
//   * Dedupe per directory — fire at most once per unique project dir per process
//     run so an `--all` batch doesn't spawn one window per session.
//
// We reach `spawn` through the `child_process` namespace (not a destructured
// import) so tests can spy on it, and to match export.ts's runtime.

import * as childProcess from "child_process"

/**
 * Build the `opencode://open-project?directory=<cwd>` deep link. Uses
 * URL/URLSearchParams (never string concat) so directories with spaces or other
 * special characters percent-encode and round-trip through the app's parser.
 */
export function buildOpenProjectUrl(directory: string): string {
  const url = new URL("opencode://open-project")
  url.searchParams.set("directory", directory)
  return url.toString()
}

// Opt-in env gate. Launching the desktop app is a real, user-visible side effect
// (it spawns `open`, focuses/boots the GUI), so it must NEVER fire from an
// automated context — `bun test`, the e2e round-trips, `verify`, or any library
// use of write(). It fires ONLY when an interactive entry point (the `port` CLI
// command or the TUI import) sets HELLO_SESSIONS_OPEN_IN_DESKTOP=1. Without this gate
// a single `bun test` run floods the desktop app with dozens of real deep links
// (verified: it wedged the app with "unable to open database file").
export const OPEN_IN_DESKTOP_ENV = "HELLO_SESSIONS_OPEN_IN_DESKTOP"

/**
 * Fire-and-forget open/focus of `directory` in the OpenCode desktop app. Opt-in
 * (see OPEN_IN_DESKTOP_ENV) and macOS only; swallows all failures (app not
 * installed, no URL handler, `open` missing). Must never affect the caller's
 * return status.
 */
export function openProjectInDesktopApp(directory: string): void {
  if (process.env[OPEN_IN_DESKTOP_ENV] !== "1") return
  if (process.platform !== "darwin") return
  try {
    const child = childProcess.spawn("open", [buildOpenProjectUrl(directory)], { stdio: "ignore" })
    // Async spawn failures (e.g. `open` missing) surface as an 'error' event, not
    // a synchronous throw — absorb them so they never bubble.
    child.on("error", () => {})
    child.unref()
  } catch {
    // best-effort
  }
}

/**
 * Dedupe factory: returns a predicate that yields `true` the first time it sees a
 * directory and `false` for every later call with the same directory.
 */
export function createDirectoryDedupe(): (directory: string) => boolean {
  const seen = new Set<string>()
  return (dir) => (seen.has(dir) ? false : (seen.add(dir), true))
}

// One dedupe tracker per process run.
let dedupe = createDirectoryDedupe()

/** Returns true the first time `directory` is seen this run, false thereafter. */
export function shouldOpenProjectOnce(directory: string): boolean {
  return dedupe(directory)
}

/** Reset the module-scope dedupe tracker. Test hook only. */
export function _resetDedupeTracker(): void {
  dedupe = createDirectoryDedupe()
}
