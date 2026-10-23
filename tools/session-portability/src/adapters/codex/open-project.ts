// Fire-and-forget deep link that opens/focuses an imported session in the Codex
// desktop app after a rollout lands. Purely a UX nicety — it is NEVER part of
// write()'s success/failure contract. This is the Codex twin of
// opencode/open-project.ts; the two intentionally share shape and env gate.
//
// Mechanism: the Codex desktop app (com.openai.codex) registers the `codex` URL
// scheme and routes `codex://threads/<conversationId>` to open/focus that thread
// (it's the app's own "Open in app" action). Codex is thread-centric — there is
// NO `open-project?directory=` route like OpenCode's — so to "open a project" we
// open one of its threads, which boots/focuses the app on that conversation.
// The conversationId is our destSessionId (== the rollout uuid == threads.id).
//
// Non-negotiables (mirrored from the OpenCode module, a macOS-verified pattern):
//   * macOS-only — the scheme is only verified there. Early-return elsewhere.
//   * Best-effort — swallow EVERY failure (app absent, no handler, `open` missing).
//     It must never affect the write's return status.
//   * URL, not string concat — the id is percent-encoded into the path so any
//     stray character round-trips through the app's own parser.
//   * Dedupe per project directory — fire at most once per unique cwd per process
//     run so an `--all` batch doesn't spawn one window per session; we open the
//     first landed thread of each project.
//
// We reach `spawn` through the `child_process` namespace (not a destructured
// import) so tests can spy on it, and to match export.ts's runtime.

import * as childProcess from "child_process"

/**
 * Build the `codex://threads/<conversationId>` deep link. The id is percent-encoded
 * as a path segment (never string-concatenated raw) so it round-trips through the
 * desktop app's URL parser.
 */
export function buildOpenThreadUrl(conversationId: string): string {
  return `codex://threads/${encodeURIComponent(conversationId)}`
}

// Opt-in env gate. Launching the desktop app is a real, user-visible side effect
// (it spawns `open`, focuses/boots the GUI), so it must NEVER fire from an
// automated context — `bun test`, the e2e round-trips, `verify`, or any library
// use of write(). It fires ONLY when an interactive entry point (the `port` CLI
// command or the TUI import) sets HELLO_SESSIONS_OPEN_IN_DESKTOP=1. This is the same
// env var the OpenCode adapter gates on — one switch controls desktop launches
// for the whole tool.
export const OPEN_IN_DESKTOP_ENV = "HELLO_SESSIONS_OPEN_IN_DESKTOP"

/**
 * Fire-and-forget open/focus of a Codex thread in the desktop app. Opt-in (see
 * OPEN_IN_DESKTOP_ENV) and macOS only; swallows all failures (app not installed,
 * no URL handler, `open` missing). Must never affect the caller's return status.
 */
export function openThreadInDesktopApp(conversationId: string): void {
  if (process.env[OPEN_IN_DESKTOP_ENV] !== "1") return
  if (process.platform !== "darwin") return
  try {
    const child = childProcess.spawn("open", [buildOpenThreadUrl(conversationId)], { stdio: "ignore" })
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
export function shouldOpenThreadOnce(directory: string): boolean {
  return dedupe(directory)
}

/** Reset the module-scope dedupe tracker. Test hook only. */
export function _resetDedupeTracker(): void {
  dedupe = createDirectoryDedupe()
}
