// Worktree -> parent-project remapping. A conversation started inside a git
// worktree (Conductor names them "nairobi", "banjul", ... under
// ~/conductor/workspaces/<project>/<name>) carries that worktree path as its
// `cwd`. Since `cwd` is the ONE field every export adapter uses to file a session
// under a harness project (claude-code: ~/.claude/projects/<encode(cwd)>/, codex:
// rollout cwd, opencode: `opencode import` child cwd), an unremapped worktree
// session lands under a throwaway "banjul" project instead of the real repo.
//
// This module resolves a worktree cwd back to its parent working tree so the port
// files the conversation under the original project. It is applied ONCE at the hub
// (core/orchestrator.exportSessions), so all three harnesses inherit the fix and
// no adapter changes. The original path is preserved in
// `sourceMetadata.originalCwd` (with `worktreeSource` provenance) so the remap is
// auditable and reversible.
//
// Resolution order (see docs — 2026-07-08 brainstorm):
//   1. git  — `git rev-parse` on a LIVE worktree (local, no network). Works for
//             ANY git worktree, Conductor or hand-made `git worktree add`.
//   2. conductor.db — the worktree was DELETED (Conductor removes worktrees as
//             part of its flow) but its `workspace_path -> repos.root_path`
//             mapping survives in the app's SQLite db (archived rows are kept).
//   3. none — not a worktree / unresolvable -> leave cwd unchanged.
//
// Everything here is read-only and best-effort: a missing git binary, a deleted
// cwd, or an absent/locked conductor.db all degrade to "leave cwd unchanged",
// never a throw.

import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { Database } from "bun:sqlite"

import type { PortableSession } from "../ir"

/** Set to "1" to disable remapping and keep the raw worktree cwd. */
export const KEEP_WORKTREE_ENV = "HELLO_SESSIONS_KEEP_WORKTREE_CWD"

/** Override the conductor.db path (tests / sandbox point this at a temp db). */
export const CONDUCTOR_DB_ENV = "HELLO_SESSIONS_CONDUCTOR_DB"

export type WorktreeSource = "git" | "conductor" | "none"

export interface ProjectRootResolution {
  /** The resolved project root (== input cwd when `source` is "none"). */
  root: string
  source: WorktreeSource
}

export interface ResolveDeps {
  /** Run git in `cwd`, returning stdout, or null on any failure. Injectable for tests. */
  runGit?: (args: string[], cwd: string) => string | null
  /** Look up a deleted worktree's parent repo, or null. Injectable for tests. */
  lookupConductorRepo?: (cwd: string) => string | null
}

function defaultRunGit(args: string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    return null
  }
}

/** conductor.db location: $HELLO_SESSIONS_CONDUCTOR_DB, else the macOS app-support path. */
export function defaultConductorDbPath(): string {
  return (
    process.env[CONDUCTOR_DB_ENV] ??
    path.join(os.homedir(), "Library", "Application Support", "com.conductor.app", "conductor.db")
  )
}

/**
 * Durable fallback for a worktree that no longer exists on disk: Conductor keeps
 * a `workspaces(workspace_path, repository_id)` -> `repos(id, root_path)` mapping
 * in SQLite, and archived (deleted) workspaces keep their rows — so the parent
 * repo is recoverable long after the worktree directory is gone. Read-only,
 * swallows every failure (absent db, locked, schema drift).
 */
function defaultLookupConductorRepo(cwd: string): string | null {
  const dbPath = defaultConductorDbPath()
  if (!fs.existsSync(dbPath)) return null
  let db: Database | undefined
  try {
    db = new Database(dbPath, { readonly: true })
    const row = db
      .query(
        "SELECT r.root_path AS root FROM workspaces w " +
          "JOIN repos r ON r.id = w.repository_id " +
          "WHERE w.workspace_path = ? AND r.root_path IS NOT NULL LIMIT 1",
      )
      .get(cwd) as { root?: string } | null
    return row?.root ?? null
  } catch {
    return null
  } finally {
    try {
      db?.close()
    } catch {}
  }
}

/**
 * Resolve a cwd to its parent project root. Returns `{ root: cwd, source: "none" }`
 * when cwd is not a linked worktree or cannot be resolved.
 */
export function resolveProjectRoot(cwd: string, deps: ResolveDeps = {}): ProjectRootResolution {
  if (!cwd) return { root: cwd, source: "none" }
  const runGit = deps.runGit ?? defaultRunGit
  const lookupConductor = deps.lookupConductorRepo ?? defaultLookupConductorRepo

  // 1. git — live worktree. `--git-common-dir` is the SHARED .git of the whole
  // repo; `--git-dir` is THIS checkout's git dir. They differ iff cwd is a linked
  // worktree, in which case the parent working tree is the dir containing the
  // common .git.
  const gitOut = runGit(["rev-parse", "--path-format=absolute", "--git-common-dir", "--git-dir"], cwd)
  if (gitOut) {
    const lines = gitOut.split("\n").map((l) => l.trim()).filter(Boolean)
    if (lines.length >= 2) {
      const [commonDir, gitDir] = lines as [string, string]
      if (path.resolve(gitDir) !== path.resolve(commonDir)) {
        const root = path.dirname(commonDir)
        if (root && root !== cwd) return { root, source: "git" }
      }
      // Main worktree (or an ordinary non-worktree repo): cwd is already canonical.
      return { root: cwd, source: "none" }
    }
  }

  // 2. conductor.db — worktree deleted but recorded.
  const conductorRoot = lookupConductor(cwd)
  if (conductorRoot && conductorRoot !== cwd) return { root: conductorRoot, source: "conductor" }

  // 3. give up.
  return { root: cwd, source: "none" }
}

/**
 * Build a remap function that rewrites `session.cwd` in place to its parent
 * project root, stamping `sourceMetadata.originalCwd` + `worktreeSource` when a
 * remap happens. The returned closure memoizes resolutions per distinct input
 * cwd, so importing a whole store shells out to git only once per unique worktree
 * directory (dozens of sessions in one worktree share a single git call). Each
 * remap is idempotent (a session already stamped is left alone, so remapping at
 * import then again at export is free) and a no-op when KEEP_WORKTREE_ENV is set.
 */
export function createCwdRemapper(deps: ResolveDeps = {}): (session: PortableSession) => ProjectRootResolution {
  const cache = new Map<string, ProjectRootResolution>()
  return (session: PortableSession): ProjectRootResolution => {
    if (process.env[KEEP_WORKTREE_ENV] === "1") return { root: session.cwd, source: "none" }

    const meta = session.sourceMetadata as Record<string, unknown>
    const prior = meta.worktreeSource
    if (typeof prior === "string") return { root: session.cwd, source: prior as WorktreeSource }

    const original = session.cwd
    if (!original) return { root: original, source: "none" }

    let res = cache.get(original)
    if (!res) {
      res = resolveProjectRoot(original, deps)
      cache.set(original, res)
    }
    if (res.source !== "none") {
      meta.originalCwd = original
      meta.worktreeSource = res.source
      session.cwd = res.root
    }
    return res
  }
}

/**
 * Remap a single session's cwd (uncached convenience over createCwdRemapper).
 * See createCwdRemapper for semantics.
 */
export function remapSessionCwd(session: PortableSession, deps: ResolveDeps = {}): ProjectRootResolution {
  return createCwdRemapper(deps)(session)
}
